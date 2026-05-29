#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inline] = arg.slice(2).split('=', 2)
  const value = inline ?? (process.argv[i + 1]?.startsWith('--') ? 'true' : process.argv[++i] ?? 'true')
  args.set(key, value)
}

const backendBase = (args.get('backend') || process.env.CAMELID_API_BASE || 'http://127.0.0.1:8181').replace(/\/$/, '')
const llamaBase = (args.get('llama-url') || process.env.TINYLLAMA_LLAMA_SERVER_URL || 'http://127.0.0.1:8183').replace(/\/$/, '')
const modelPath = resolve(args.get('model') || process.env.TINYLLAMA_GGUF || 'models/tinyllama-1.1b-chat-v1.0.Q8_0.gguf')
const modelId = args.get('model-id') || process.env.TINYLLAMA_MODEL_ID || 'tinyllama-q8'
const backendBin = resolve(args.get('backend-bin') || process.env.CAMELID_BIN || 'target/release/camelid')
const llamaServerBin = args.get('llama-server') || process.env.TINYLLAMA_LLAMA_SERVER || 'llama-server'
const startLlamaServer = args.has('start-llama-server') || process.env.TINYLLAMA_START_LLAMA_SERVER === '1'
const userMessage = args.get('message') ?? process.env.TINYLLAMA_CHAT_MESSAGE ?? 'hello'
const maxTokens = Number.parseInt(args.get('max-tokens') || process.env.TINYLLAMA_CHAT_MAX_TOKENS || '1', 10)
const layerArg = args.get('layers') || process.env.TINYLLAMA_ZERO_DELTA_LAYERS || 'auto'
const branches = parseBranches(args.get('branches') || process.env.TINYLLAMA_ZERO_DELTA_BRANCHES || 'attention,ffn')
const outPath = args.get('out') || process.env.TINYLLAMA_ZERO_DELTA_MATRIX_OUT
const keepDiagnostics = args.has('keep-diagnostics') || process.env.TINYLLAMA_ZERO_DELTA_KEEP_DIAGNOSTICS === '1'
const diagnosticsDir = resolve(args.get('diagnostics-dir') || process.env.TINYLLAMA_ZERO_DELTA_DIAGNOSTICS_DIR || 'target/zero-delta-layer-matrix')
const expectedPrompt = `<|user|>\n${userMessage}</s>\n<|assistant|>\n`

if (!Number.isInteger(maxTokens) || maxTokens < 1) {
  throw new Error(`--max-tokens must be a positive integer, got ${args.get('max-tokens')}`)
}

let llamaChild
try {
  if (keepDiagnostics) await mkdir(diagnosticsDir, { recursive: true })
  if (startLlamaServer) llamaChild = startLlama()
  await waitForJson(`${llamaBase}/health`, {}, 'llama-server')
  const llamaBaseline = await llamaReference()

  const base = await runVariant({ name: 'base', attention: 'none', ffn: 'none', llamaBaseline })
  const layerCount = resolveLayerCount(layerArg, base)
  const variants = [base]

  for (const branch of branches) {
    variants.push(await runVariant({
      name: `${branch}-all`,
      attention: branch === 'attention' ? 'all' : 'none',
      ffn: branch === 'ffn' ? 'all' : 'none',
      llamaBaseline,
    }))
    for (let layer = 0; layer < layerCount; layer += 1) {
      variants.push(await runVariant({
        name: `${branch}-${layer}`,
        attention: branch === 'attention' ? String(layer) : 'none',
        ffn: branch === 'ffn' ? String(layer) : 'none',
        llamaBaseline,
      }))
    }
  }

  const summary = {
    backend: backendBase,
    llama_server: llamaBase,
    model: modelPath,
    model_id: modelId,
    message: userMessage,
    expected_prompt: expectedPrompt,
    layer_count: layerCount,
    branches,
    llama_text: llamaBaseline.text,
    llama_generated_tokens_from_text: llamaBaseline.generatedTokens,
    variants,
  }

  printSummary(summary)
  if (outPath) {
    await writeFile(resolve(outPath), `${JSON.stringify(summary, null, 2)}\n`)
    console.log(`matrix_out=${resolve(outPath)}`)
  }
} finally {
  if (llamaChild) llamaChild.kill('SIGTERM')
}

async function llamaReference() {
  const chatPayload = chatRequest([])
  const [chat, tokens] = await Promise.all([
    fetchJson(`${llamaBase}/v1/chat/completions`, { method: 'POST', body: JSON.stringify(chatPayload) }),
    fetchJson(`${llamaBase}/tokenize`, { method: 'POST', body: JSON.stringify({ content: expectedPrompt, add_special: true }) }),
  ])
  const text = chat.choices?.[0]?.message?.content ?? ''
  const generatedTokens = text
    ? (await fetchJson(`${llamaBase}/tokenize`, { method: 'POST', body: JSON.stringify({ content: text, add_special: false }) })).tokens || []
    : []
  return { chat, promptTokens: tokens.tokens || [], text, generatedTokens }
}

async function runVariant({ name, attention, ffn, llamaBaseline }) {
  const backendChild = startBackend({ attention, ffn })
  try {
    await waitForJson(`${backendBase}/v1/health`, {}, `backend ${name}`)
    await fetchJson(`${backendBase}/api/models/load`, { method: 'POST', body: JSON.stringify({ path: modelPath, id: modelId }) })
    const chat = await fetchJson(`${backendBase}/v1/chat/completions`, {
      method: 'POST',
      body: JSON.stringify(chatRequest(llamaBaseline.generatedTokens)),
    })
    const promptTokens = chat.camelid?.prompt_token_ids || []
    const generatedTokens = chat.camelid?.generated_token_ids || []
    const text = chat.choices?.[0]?.message?.content ?? ''
    const topLogits = chat.camelid?.top_logits || []
    const targetToken = llamaBaseline.generatedTokens[0]
    const targetLogit = topLogits.find(item => item.token_id === targetToken) || null
    const denseMetadata = chat.camelid?.dense_metadata || null
    const row = {
      name,
      zero_attention_delta: attention,
      zero_ffn_delta: ffn,
      prompt_tokens_match: JSON.stringify(promptTokens) === JSON.stringify(llamaBaseline.promptTokens),
      generated_text_match: text === llamaBaseline.text,
      backend_text: text,
      backend_generated_tokens: generatedTokens,
      selected_token_id: generatedTokens[0] ?? null,
      selected_top_logit: topLogits[0] || null,
      known_good_token_id: targetToken ?? null,
      known_good_backend_logit: targetLogit,
      dense_metadata: {
        zero_attention_delta: denseMetadata?.zero_attention_delta,
        zero_ffn_delta: denseMetadata?.zero_ffn_delta,
      },
      layer_count: chat.camelid?.dense?.layers?.length ?? null,
    }
    if (keepDiagnostics) {
      const file = resolve(diagnosticsDir, `${name}.json`)
      await writeFile(file, `${JSON.stringify({ ...row, camelid: chat.camelid }, null, 2)}\n`)
      row.diagnostics_out = file
    }
    console.log(`${name}: token=${row.selected_token_id} text=${JSON.stringify(text)} known_good_rank=${targetLogit?.rank ?? 'n/a'} prompt_match=${row.prompt_tokens_match}`)
    return row
  } finally {
    backendChild.kill('SIGTERM')
    await onceExit(backendChild, 5_000).catch(() => backendChild.kill('SIGKILL'))
  }
}

function chatRequest(logitTokenIds) {
  return {
    model: modelId,
    messages: [{ role: 'user', content: userMessage }],
    max_tokens: maxTokens,
    stream: false,
    temperature: 0,
    camelid_logit_token_ids: logitTokenIds,
    camelid_dense_diagnostics: true,
  }
}

function startBackend({ attention, ffn }) {
  const url = new URL(backendBase)
  const child = spawn(backendBin, ['serve', '--addr', `${url.hostname}:${url.port || '8181'}`], {
    env: {
      ...process.env,
      CAMELID_ZERO_ATTENTION_DELTA: attention,
      CAMELID_ZERO_FFN_DELTA: ffn,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', chunk => process.stderr.write(`[backend] ${chunk}`))
  child.stderr.on('data', chunk => process.stderr.write(`[backend] ${chunk}`))
  return child
}

function startLlama() {
  const url = new URL(llamaBase)
  const child = spawn(llamaServerBin, [
    '--host', url.hostname,
    '--port', url.port || '8183',
    '-m', modelPath,
    '-ngl', '0',
    '-c', '512',
    '--no-warmup',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', chunk => process.stderr.write(`[llama-server] ${chunk}`))
  child.stderr.on('data', chunk => process.stderr.write(`[llama-server] ${chunk}`))
  return child
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}: ${body?.error?.message || text}`)
  return body
}

async function waitForJson(url, options, label) {
  const deadline = Date.now() + 30_000
  let lastError
  while (Date.now() < deadline) {
    try { return await fetchJson(url, options) } catch (err) { lastError = err; await sleep(500) }
  }
  throw new Error(`${label} did not become reachable at ${url}: ${lastError?.message}`)
}

function resolveLayerCount(value, base) {
  if (value === 'auto') {
    const count = base.layer_count
    if (!Number.isInteger(count) || count < 1) throw new Error('could not infer layer count from base diagnostics; pass --layers N')
    return count
  }
  const count = Number.parseInt(value, 10)
  if (!Number.isInteger(count) || count < 1) throw new Error(`--layers must be auto or a positive integer, got ${value}`)
  return count
}

function parseBranches(value) {
  const parsed = value.split(',').map(item => item.trim()).filter(Boolean)
  for (const branch of parsed) {
    if (branch !== 'attention' && branch !== 'ffn') throw new Error(`unsupported branch ${branch}; expected attention, ffn, or both comma-separated`)
  }
  return parsed.length ? parsed : ['attention', 'ffn']
}

function printSummary(summary) {
  console.log('name,branch_selector,token,text,known_good_token,known_good_rank,prompt_match')
  for (const row of summary.variants) {
    const selector = `attn=${row.zero_attention_delta};ffn=${row.zero_ffn_delta}`
    console.log(`${row.name},${selector},${row.selected_token_id},${JSON.stringify(row.backend_text)},${row.known_good_token_id},${row.known_good_backend_logit?.rank ?? ''},${row.prompt_tokens_match}`)
  }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function onceExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    sleep(timeoutMs).then(() => { throw new Error('timeout waiting for child exit') }),
  ])
}
