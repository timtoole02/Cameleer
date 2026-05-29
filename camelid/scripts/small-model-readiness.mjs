#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const manifestPath = resolve(args.get('manifest') || 'SMALL_MODEL_CANDIDATES.json')
const inspectBin = resolve(args.get('inspect-bin') || './target/release/camelid')
const outPath = args.get('out') ? resolve(args.get('out')) : null
const markdownOutPath = args.get('markdown-out') ? resolve(args.get('markdown-out')) : null
const budgetBytes = parseByteBudget(
  args.get('budget') ||
  process.env.CAMELID_MAX_CPU_WEIGHT_MATERIALIZATION_BYTES ||
  String(24 * 1024 * 1024 * 1024),
)
const q8RuntimeBlockBytes = Number.parseInt(args.get('q8-runtime-block-bytes') || '36', 10)
const supportedCpuStorageTypes = new Set(['F32', 'F16', 'BF16', 'Q8_0'])

if (!Number.isInteger(q8RuntimeBlockBytes) || q8RuntimeBlockBytes <= 0) {
  throw new Error(`--q8-runtime-block-bytes must be a positive integer, got ${args.get('q8-runtime-block-bytes')}`)
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const candidates = manifest.candidate_order || []
const startedAt = new Date().toISOString()
const rows = []

for (const candidate of candidates) {
  rows.push(await inspectCandidate(candidate))
}

const report = {
  schema: 'camelid.small-model-readiness-report.v1',
  generated_at: startedAt,
  manifest: manifestPath,
  inspect_bin: inspectBin,
  materialization_budget_bytes: budgetBytes,
  q8_runtime_block_bytes: q8RuntimeBlockBytes,
  candidates: rows,
}

if (outPath) {
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`)
}
if (markdownOutPath) {
  await mkdir(dirname(markdownOutPath), { recursive: true })
  await writeFile(markdownOutPath, renderMarkdown(report))
}
console.log(JSON.stringify(report, null, 2))

async function inspectCandidate(candidate) {
  const row = {
    model_id: candidate.model_id,
    path: candidate.path,
    family_manifest: candidate.family,
    quant_manifest: candidate.quant,
    tokenizer_manifest: candidate.tokenizer,
    chat_template_manifest: candidate.chat_template,
    expected_support_row: candidate.expected_support_row,
    load_harness: candidate.load_harness,
    parity_harness: candidate.parity_harness,
  }

  const candidatePath = resolve(candidate.path)
  row.resolved_path = candidatePath
  try {
    const fileStat = await stat(candidatePath)
    row.present = true
    row.file_size_bytes = fileStat.size
  } catch (err) {
    row.present = false
    row.readiness = 'missing_artifact'
    row.notes = [`candidate file is not present locally: ${err.code || err.message}`]
    return row
  }

  let inspect
  try {
    const { stdout } = await run(inspectBin, ['inspect', candidatePath])
    inspect = JSON.parse(stdout)
  } catch (err) {
    row.readiness = 'inspect_failed'
    row.notes = [err.message]
    return row
  }

  const metadata = inspect.metadata || {}
  const tensors = inspect.tensors || []
  const tensorMap = new Map(tensors.map(t => [t.name, t]))
  const config = llamaConfig(metadata, tensorMap)
  const binding = bindLlama(config, tensorMap)
  const storage = summarizeStorage(tensors)
  const tokenizer = chooseTokenizerAndTemplate(metadata)
  const materialization = binding.ok
    ? estimateMaterialization(binding.bound, q8RuntimeBlockBytes)
    : null
  const materializationWithinBudget = materialization
    ? materialization.estimated_bytes <= budgetBytes
    : false
  const unsupportedStorageTypes = Object.keys(storage.counts).filter(type => !supportedCpuStorageTypes.has(type))

  row.inspect = {
    version: inspect.version,
    tensor_count: inspect.tensor_count,
    metadata_count: inspect.metadata_count,
    alignment: inspect.alignment,
    data_start_offset: inspect.data_start_offset,
  }
  row.metadata_binding = {
    architecture: metadata['general.architecture'] ?? null,
    general_name: metadata['general.name'] ?? null,
    general_file_type: metadata['general.file_type'] ?? null,
    config,
    ok: config.ok,
    errors: config.errors,
  }
  row.tensor_binding = {
    ok: binding.ok,
    output_is_tied_embedding: binding.output_is_tied_embedding ?? null,
    bound_layer_count: binding.bound?.layers?.length ?? 0,
    errors: binding.errors,
  }
  row.storage = storage
  row.tokenizer_template_choice = tokenizer
  row.materialization_budget = {
    default_budget_bytes: budgetBytes,
    estimated_bytes: materialization?.estimated_bytes ?? null,
    estimated_mib: materialization ? bytesToMiB(materialization.estimated_bytes) : null,
    within_budget: materializationWithinBudget,
    largest_tensors: materialization?.largest_tensors ?? [],
    decision: materializationDecision(candidate, materialization, materializationWithinBudget, unsupportedStorageTypes),
  }
  row.load_generation_readiness = readiness(config, binding, unsupportedStorageTypes, materializationWithinBudget)
  row.parity_decision = parityDecision(candidate, row.load_generation_readiness, tokenizer)
  row.readiness = row.load_generation_readiness.status
  row.notes = row.load_generation_readiness.notes
  return row
}

function llamaConfig(metadata, tensorMap) {
  const errors = []
  if (metadata['general.architecture'] !== 'llama') {
    errors.push(`unsupported architecture ${JSON.stringify(metadata['general.architecture'])}`)
  }
  const required = {
    context_length: metadata['llama.context_length'],
    embedding_length: metadata['llama.embedding_length'],
    block_count: metadata['llama.block_count'],
    feed_forward_length: metadata['llama.feed_forward_length'],
    attention_head_count: metadata['llama.attention.head_count'],
  }
  for (const [key, value] of Object.entries(required)) {
    if (!Number.isInteger(value) || value <= 0) errors.push(`missing/invalid llama.${key}`)
  }
  const embeddingLength = required.embedding_length
  const tokenEmbedding = tensorMap.get('token_embd.weight')
  const inferredVocabSize = Array.isArray(tokenEmbedding?.dimensions) && tokenEmbedding.dimensions.length >= 2
    ? tokenEmbedding.dimensions[1]
    : null
  const vocabSize = metadata['llama.vocab_size'] ?? inferredVocabSize
  if (!Number.isInteger(vocabSize) || vocabSize <= 0) errors.push('missing/invalid llama.vocab_size and unable to infer from token_embd.weight')
  const attentionHeadCountKv = metadata['llama.attention.head_count_kv'] ?? required.attention_head_count
  if (Number.isInteger(required.attention_head_count) && Number.isInteger(embeddingLength)) {
    if (embeddingLength % required.attention_head_count !== 0) {
      errors.push(`embedding length ${embeddingLength} is not divisible by attention head count ${required.attention_head_count}`)
    }
  }
  if (Number.isInteger(attentionHeadCountKv) && Number.isInteger(required.attention_head_count)) {
    if (attentionHeadCountKv <= 0) errors.push('attention kv head count must be greater than zero')
    if (required.attention_head_count % attentionHeadCountKv !== 0) {
      errors.push(`attention head count ${required.attention_head_count} is not a multiple of kv head count ${attentionHeadCountKv}`)
    }
  }
  const headDim = Number.isInteger(embeddingLength) && Number.isInteger(required.attention_head_count)
    ? embeddingLength / required.attention_head_count
    : null
  return {
    ok: errors.length === 0,
    errors,
    context_length: required.context_length ?? null,
    embedding_length: embeddingLength ?? null,
    block_count: required.block_count ?? null,
    feed_forward_length: required.feed_forward_length ?? null,
    attention_head_count: required.attention_head_count ?? null,
    attention_head_count_kv: attentionHeadCountKv ?? null,
    head_dim: Number.isInteger(headDim) ? headDim : null,
    kv_width: Number.isInteger(headDim) && Number.isInteger(attentionHeadCountKv) ? headDim * attentionHeadCountKv : null,
    rope_dimension_count: metadata['llama.rope.dimension_count'] ?? null,
    rope_freq_base: metadata['llama.rope.freq_base'] ?? null,
    rms_norm_epsilon: metadata['llama.attention.layer_norm_rms_epsilon'] ?? 1e-5,
    vocab_size: vocabSize ?? null,
    file_type: metadata['general.file_type'] ?? null,
  }
}

function bindLlama(config, tensorMap) {
  const errors = []
  if (!config.ok) return { ok: false, errors: ['metadata config did not bind cleanly', ...config.errors] }
  const requireTensor = (name, expectedShape) => {
    const tensor = tensorMap.get(name)
    if (!tensor) {
      errors.push(`missing tensor ${name}`)
      return null
    }
    if (expectedShape && JSON.stringify(tensor.dimensions) !== JSON.stringify(expectedShape)) {
      errors.push(`${name} shape ${JSON.stringify(tensor.dimensions)} != expected ${JSON.stringify(expectedShape)}`)
    }
    return tensor
  }
  const tokenEmbedding = requireTensor('token_embd.weight', [config.embedding_length, config.vocab_size])
  const outputNorm = requireTensor('output_norm.weight', [config.embedding_length])
  const explicitOutput = tensorMap.get('output.weight')
  const output = explicitOutput || tokenEmbedding
  if (output) requireShape(output, [config.embedding_length, config.vocab_size], 'output.weight/token_embd.weight', errors)

  const layers = []
  for (let i = 0; i < config.block_count; i += 1) {
    layers.push({
      attention_norm: requireTensor(`blk.${i}.attn_norm.weight`, [config.embedding_length]),
      attention_q: requireTensor(`blk.${i}.attn_q.weight`, [config.embedding_length, config.embedding_length]),
      attention_k: requireTensor(`blk.${i}.attn_k.weight`, [config.embedding_length, config.kv_width]),
      attention_v: requireTensor(`blk.${i}.attn_v.weight`, [config.embedding_length, config.kv_width]),
      attention_output: requireTensor(`blk.${i}.attn_output.weight`, [config.embedding_length, config.embedding_length]),
      ffn_norm: requireTensor(`blk.${i}.ffn_norm.weight`, [config.embedding_length]),
      ffn_gate: requireTensor(`blk.${i}.ffn_gate.weight`, [config.embedding_length, config.feed_forward_length]),
      ffn_up: requireTensor(`blk.${i}.ffn_up.weight`, [config.embedding_length, config.feed_forward_length]),
      ffn_down: requireTensor(`blk.${i}.ffn_down.weight`, [config.feed_forward_length, config.embedding_length]),
    })
  }
  return {
    ok: errors.length === 0,
    errors,
    output_is_tied_embedding: !explicitOutput,
    bound: { token_embedding: tokenEmbedding, output_norm: outputNorm, output, output_is_tied_embedding: !explicitOutput, layers },
  }
}

function requireShape(tensor, expectedShape, label, errors) {
  if (JSON.stringify(tensor.dimensions) !== JSON.stringify(expectedShape)) {
    errors.push(`${label} shape ${JSON.stringify(tensor.dimensions)} != expected ${JSON.stringify(expectedShape)}`)
  }
}

function summarizeStorage(tensors) {
  const counts = {}
  let nBytes = 0
  for (const tensor of tensors) {
    counts[tensor.tensor_type] = (counts[tensor.tensor_type] || 0) + 1
    nBytes += tensor.n_bytes || 0
  }
  return { counts, tensor_payload_bytes: nBytes, unsupported_for_cpu_f32_load: Object.keys(counts).filter(type => !supportedCpuStorageTypes.has(type)) }
}

function chooseTokenizerAndTemplate(metadata) {
  const tokenizerModel = metadata['tokenizer.ggml.model'] ?? null
  const pre = metadata['tokenizer.ggml.pre'] ?? null
  const chatTemplate = metadata['tokenizer.chat_template'] ?? ''
  if (pre === 'llama-bpe' || tokenizerModel === 'gpt2') {
    return {
      tokenizer: 'llama-bpe',
      tokenizer_metadata: { model: tokenizerModel, pre },
      chat_template_choice: 'llama3-compact-header-eot-current-camelid',
      metadata_template_present: Boolean(chatTemplate),
      metadata_template_note: chatTemplate.includes('Cutting Knowledge Date')
        ? 'GGUF includes full Llama 3 instruct template with default dated system header; current parity harness intentionally uses Camelid compact header/eot rendering.'
        : 'BPE tokenizer detected; use compact Llama 3 header/eot prompt unless runtime template support is expanded.',
    }
  }
  if (tokenizerModel === 'llama') {
    return {
      tokenizer: 'llama-spm',
      tokenizer_metadata: { model: tokenizerModel, pre },
      chat_template_choice: chatTemplate.includes('<|user|>') ? 'tinyllama-marker-chat-template' : 'llama-spm-template-from-metadata-or-fixture',
      metadata_template_present: Boolean(chatTemplate),
      metadata_template_note: 'SPM tokenizer detected; TinyLlama marker template is the current supported parity gate when the metadata template matches.',
    }
  }
  return {
    tokenizer: 'unknown',
    tokenizer_metadata: { model: tokenizerModel, pre },
    chat_template_choice: 'unsupported-until-tokenizer-binding-added',
    metadata_template_present: Boolean(chatTemplate),
    metadata_template_note: 'No supported tokenizer binding detected.',
  }
}

function estimateMaterialization(binding, q8BlockBytes) {
  const tensors = [binding.token_embedding, binding.output_norm]
  if (!binding.output_is_tied_embedding) tensors.push(binding.output)
  for (const layer of binding.layers) {
    tensors.push(layer.attention_norm, layer.attention_q, layer.attention_k, layer.attention_v, layer.attention_output, layer.ffn_norm, layer.ffn_gate, layer.ffn_up, layer.ffn_down)
  }
  const estimates = tensors.filter(Boolean).map(tensor => {
    const elements = tensor.dimensions.reduce((acc, dim) => acc * dim, 1)
    const f32Bytes = elements * 4
    const retainedSourceBytes = tensor.tensor_type === 'Q8_0' ? Math.ceil(elements / 32) * q8BlockBytes : 0
    return { name: tensor.name, tensor_type: tensor.tensor_type, dimensions: tensor.dimensions, estimated_bytes: f32Bytes + retainedSourceBytes }
  })
  const estimatedBytes = estimates.reduce((acc, item) => acc + item.estimated_bytes, 0)
  return { estimated_bytes: estimatedBytes, largest_tensors: estimates.sort((a, b) => b.estimated_bytes - a.estimated_bytes).slice(0, 8) }
}

function materializationDecision(candidate, materialization, withinBudget, unsupportedStorageTypes) {
  if (!materialization) return 'blocked: tensor binding did not complete'
  if (unsupportedStorageTypes.length > 0) return `blocked: unsupported tensor storage ${unsupportedStorageTypes.join(', ')}`
  if (!withinBudget) return 'blocked: eager f32+retained-source estimate exceeds materialization budget; wait for lazy/on-demand Q8 or higher-RAM VM'
  if (/8b/i.test(candidate.model_id) || /8B/.test(candidate.path)) {
    return 'do-not-run-generation-by-default: large-model row remains blocked despite descriptor readiness unless lazy-Q8 or higher-RAM evidence is explicit'
  }
  return 'safe-to-load-and-try-short-deterministic-generation-with-existing-harness'
}

function readiness(config, binding, unsupportedStorageTypes, withinBudget) {
  const notes = []
  if (!config.ok) notes.push(...config.errors)
  if (!binding.ok) notes.push(...binding.errors)
  if (unsupportedStorageTypes.length > 0) notes.push(`unsupported CPU storage types: ${unsupportedStorageTypes.join(', ')}`)
  if (!withinBudget) notes.push('materialization estimate exceeds configured budget')
  if (notes.length === 0) return { status: 'load_and_generation_candidate', notes: ['metadata/config binding, tensor binding, storage, and budget checks passed'] }
  if (config.ok && binding.ok && unsupportedStorageTypes.length === 0 && !withinBudget) return { status: 'metadata_load_only_budget_blocked', notes }
  return { status: 'blocked_before_generation', notes }
}

function parityDecision(candidate, loadReadiness, tokenizer) {
  const harness = candidate.parity_harness || ''
  if (harness.includes('do not run')) return 'not-run-by-policy-from-manifest'
  if (loadReadiness.status !== 'load_and_generation_candidate') return 'not-ready-for-generation-parity'
  if (tokenizer.tokenizer === 'llama-spm' && harness.includes('chat-parity-tinyllama')) return 'run TinyLlama tokenizer/chat harness; require generated match to protect baseline'
  if (tokenizer.tokenizer === 'llama-bpe' && harness.includes('chat-parity-llama3')) return 'run compact Llama 3 prompt-token + generated-token harness against llama.cpp when reference server is available'
  return 'manual parity harness binding required'
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# Small-Model Readiness Report')
  lines.push('')
  lines.push(`Generated: ${report.generated_at}`)
  lines.push(`Materialization budget: ${report.materialization_budget_bytes} bytes (${bytesToMiB(report.materialization_budget_bytes)} MiB)`)
  lines.push('')
  lines.push('| Model | Present | Tokenizer/template | Binding | Materialization | Readiness | Parity decision |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const row of report.candidates) {
    const tokenizer = row.tokenizer_template_choice?.tokenizer || row.tokenizer_manifest || 'n/a'
    const template = row.tokenizer_template_choice?.chat_template_choice || row.chat_template_manifest || 'n/a'
    const binding = row.tensor_binding ? (row.tensor_binding.ok ? 'PASS' : `FAIL: ${row.tensor_binding.errors.join('; ')}`) : 'N/A'
    const materialization = row.materialization_budget?.estimated_mib != null
      ? `${row.materialization_budget.estimated_mib} MiB; ${row.materialization_budget.decision}`
      : 'N/A'
    lines.push(`| ${escapePipe(row.model_id)} | ${row.present ? 'yes' : 'no'} | ${escapePipe(`${tokenizer}; ${template}`)} | ${escapePipe(binding)} | ${escapePipe(materialization)} | ${escapePipe(row.readiness)} | ${escapePipe(row.parity_decision || 'N/A')} |`)
  }
  lines.push('')
  lines.push('This report is an inventory/readiness gate. It does not promote support without the model-specific tokenizer/generation parity artifacts named in the matrix.')
  return `${lines.join('\n')}\n`
}

function parseArgs(argv) {
  const parsed = new Map()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const [key, inline] = arg.slice(2).split('=', 2)
    const next = argv[i + 1]
    const value = inline ?? (next && !next.startsWith('--') ? argv[++i] : 'true')
    parsed.set(key, value)
  }
  return parsed
}

function parseByteBudget(value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)(b|bytes|kib|mib|gib|kb|mb|gb)?$/i)
  if (!match) throw new Error(`invalid byte budget ${JSON.stringify(value)}`)
  const amount = Number.parseFloat(match[1])
  const unit = (match[2] || 'bytes').toLowerCase()
  const multiplier = {
    b: 1,
    bytes: 1,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
  }[unit]
  return Math.floor(amount * multiplier)
}

function bytesToMiB(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

function escapePipe(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

async function run(command, commandArgs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) {
        resolvePromise({ stdout, stderr })
      } else {
        reject(new Error(`${command} ${commandArgs.join(' ')} exited ${code}: ${stderr || stdout}`))
      }
    })
  })
}
