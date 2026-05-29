#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const apiBase = (args.get('api') || process.env.CAMELID_API_BASE || 'http://127.0.0.1:8181').replace(/\/$/, '')
const modelPath = resolve(args.get('model') || process.env.TINYLLAMA_GGUF || 'models/tinyllama-1.1b-chat-v1.0.Q8_0.gguf')
const modelId = args.get('model-id') || process.env.TINYLLAMA_MODEL_ID || 'tinyllama-q8'
const repeats = parsePositiveInt('repeats', args.get('repeats') || process.env.CAMELID_UNIQUE_CHAT_REPEATS || '6')
const warmup = parseNonNegativeInt('warmup', args.get('warmup') || process.env.CAMELID_UNIQUE_CHAT_WARMUP || '3')
const maxTokens = parsePositiveInt('max-tokens', args.get('max-tokens') || process.env.CAMELID_UNIQUE_CHAT_MAX_TOKENS || '1')
const messagePrefix = args.get('message-prefix') || process.env.CAMELID_UNIQUE_CHAT_MESSAGE_PREFIX || 'unique perf prompt'
const startBackend = args.has('start-backend') || process.env.CAMELID_START_BACKEND === '1'
const backendPid = parseOptionalPositiveInt('backend-pid', args.get('backend-pid') || process.env.CAMELID_BACKEND_PID)
const buildRelease = args.has('build') || process.env.CAMELID_UNIQUE_CHAT_BUILD === '1'
const out = args.get('out') || process.env.CAMELID_UNIQUE_CHAT_OUT

if (buildRelease) {
  const build = spawnSync('cargo', ['build', '--release'], { stdio: 'inherit' })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

let backend
try {
  if (startBackend) {
    const url = new URL(apiBase)
    backend = spawn('target/release/camelid', [
      'serve',
      '--addr',
      `${url.hostname}:${url.port || '8181'}`,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    backend.stdout.on('data', chunk => process.stderr.write(`[backend] ${chunk}`))
    backend.stderr.on('data', chunk => process.stderr.write(`[backend] ${chunk}`))
  }

  await waitForJson(`${apiBase}/v1/health`, {}, 'backend')
  const memorySamples = []
  const recordMemory = label => memorySamples.push(sampleBackendMemory(label))
  recordMemory('before_model_load')
  await fetchJson(`${apiBase}/api/models/load`, {
    method: 'POST',
    body: JSON.stringify({ path: modelPath, id: modelId }),
  })

  recordMemory('after_model_load')
  let generatedTokenTotal = 0
  let recordedFirstToken = false
  let recordedFirstTenTokens = false
  const observeRunMemory = run => {
    generatedTokenTotal += Array.isArray(run.generated_token_ids) ? run.generated_token_ids.length : 0
    if (!recordedFirstToken && generatedTokenTotal >= 1) {
      recordMemory('after_first_generated_token')
      recordedFirstToken = true
    }
    if (!recordedFirstTenTokens && generatedTokenTotal >= 10) {
      recordMemory('after_first_10_generated_tokens')
      recordedFirstTenTokens = true
    }
  }

  const warmupRuns = []
  for (let idx = 0; idx < warmup; idx += 1) {
    const run = await runChat({ idx, phase: 'warmup' })
    warmupRuns.push(run)
    observeRunMemory(run)
  }

  const runs = []
  for (let idx = 0; idx < repeats; idx += 1) {
    const run = await runChat({ idx, phase: 'measure' })
    runs.push(run)
    observeRunMemory(run)
  }

  if (!recordedFirstTenTokens) {
    recordMemory(`after_${generatedTokenTotal}_generated_tokens_total`)
  }

  const report = {
    api: apiBase,
    model: modelPath,
    model_id: modelId,
    repeats,
    warmup,
    max_tokens: maxTokens,
    message_prefix: messagePrefix,
    notes: [
      'Every warmup/measured request uses a different chat message so exact prompt-cache hits should stay false.',
      'Ordinary non-diagnostic /v1/chat/completions, temperature=0.',
      'Measured summary excludes warmup; use warmup to load weights before collecting hot-path evidence.',
      'memory_samples report backend process RSS/VSZ in MiB before model load, after model load, after the first generated token, and after the first 10 generated tokens when this script starts the backend or --backend-pid is provided; vm/swap/page-in and storage_io fields are best-effort host pressure context.',
      'forward_memory is present only when the backend is run with CAMELID_FORWARD_RSS_TIMINGS=on or CAMELID_FORWARD_MEMORY_TRACE=on; it keeps a compact per-request view of structured forward-pass RSS/KV/Q8 file-read counters.',
    ],
    memory_samples: memorySamples,
    warmup_runs: warmupRuns,
    summary: summarizeRuns(runs),
    runs,
  }

  printReport(report)
  if (out) {
    await writeFile(resolve(out), `${JSON.stringify(report, null, 2)}\n`)
    console.log(`json_out=${resolve(out)}`)
  }
} finally {
  if (backend) backend.kill('SIGTERM')
}

async function runChat({ idx, phase }) {
  const message = uniqueMessage(phase, idx)
  const started = performance.now()
  const response = await fetchJson(`${apiBase}/v1/chat/completions`, {
    method: 'POST',
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: message }],
      max_tokens: maxTokens,
      stream: false,
      temperature: 0,
    }),
  })
  const wallMs = performance.now() - started
  const diagnostics = response.camelid || {}
  const timings = diagnostics.timings_ms || {}
  const split = layerSplit(timings.layers || [])
  return {
    phase,
    index: idx + 1,
    message,
    wall_ms: round(wallMs),
    text: response.choices?.[0]?.message?.content ?? '',
    usage_prompt_tokens: response.usage?.prompt_tokens ?? null,
    prompt_token_count: diagnostics.prompt_token_ids?.length ?? null,
    generated_token_ids: diagnostics.generated_token_ids || null,
    weight_cache_hit: timings.weight_cache_hit ?? null,
    prompt_cache_hit: timings.prompt_cache_hit ?? null,
    generate_ms: finiteRound(timings.generate),
    layers_ms: finiteRound(timings.generation?.layers_total),
    logits_ms: finiteRound(timings.generation?.logits),
    forward_memory: compactForwardMemory(timings.memory),
    ...split,
  }
}

function uniqueMessage(phase, idx) {
  const words = [
    'amber', 'birch', 'cedar', 'dahlia', 'elder', 'fern', 'ginger', 'hazel', 'iris', 'juniper',
    'kestrel', 'laurel', 'maple', 'nettle', 'onyx', 'prairie', 'quartz', 'rowan', 'sage', 'thistle',
  ]
  const offset = phase === 'warmup' ? 0 : warmup
  const word = words[(idx + offset) % words.length]
  return `${messagePrefix} ${phase} ${idx + 1} ${word}`
}

function layerSplit(layers) {
  const sum = field => layers.reduce((total, layer) => total + Number(layer[field] || 0), 0)
  const ffnGate = sum('ffn_gate')
  const ffnUp = sum('ffn_up')
  const ffnActivation = sum('ffn_activation')
  const ffnDown = sum('ffn_down')
  return {
    attention_projection_ms: round(sum('attention_q') + sum('attention_k') + sum('attention_v') + sum('attention_output')),
    attention_context_ms: round(sum('attention_context')),
    ffn_gate_ms: round(ffnGate),
    ffn_up_ms: round(ffnUp),
    ffn_activation_ms: round(ffnActivation),
    ffn_down_ms: round(ffnDown),
    ffn_total_ms: round(ffnGate + ffnUp + ffnActivation + ffnDown),
  }
}

function compactForwardMemory(memory) {
  if (!memory) return null
  const q8Reads = memory.q8_file_reads || {}
  const materialization = memory.materialization || {}
  return {
    forward_passes: Number.isFinite(memory.forward_passes) ? memory.forward_passes : null,
    start_kv_position: Number.isFinite(memory.start?.kv_cache_position) ? memory.start.kv_cache_position : null,
    end_kv_position: Number.isFinite(memory.end?.kv_cache_position) ? memory.end.kv_cache_position : null,
    kv_cache_allocated_mib: bytesToMiB(memory.end?.kv_cache_allocated_bytes ?? memory.start?.kv_cache_allocated_bytes),
    start_rss_mib: kibToMiB(memory.start?.rss_kib),
    end_rss_mib: kibToMiB(memory.end?.rss_kib),
    peak_rss_mib: kibToMiB(memory.peak_rss_kib),
    peak_phase: memory.peak_phase ?? null,
    q8_file_read_calls: Number.isFinite(q8Reads.read_calls) ? q8Reads.read_calls : null,
    q8_file_read_mib: bytesToMiB(q8Reads.read_bytes),
    q8_file_cache_hits: Number.isFinite(q8Reads.cache_hits) ? q8Reads.cache_hits : null,
    q8_file_cache_hit_mib: bytesToMiB(q8Reads.cache_hit_bytes),
    q8_file_cache_misses: Number.isFinite(q8Reads.cache_misses) ? q8Reads.cache_misses : null,
    q8_file_cache_miss_mib: bytesToMiB(q8Reads.cache_miss_bytes),
    q8_file_cache_inserts: Number.isFinite(q8Reads.cache_inserts) ? q8Reads.cache_inserts : null,
    q8_file_cache_insert_mib: bytesToMiB(q8Reads.cache_insert_bytes),
    q8_file_cache_evictions: Number.isFinite(q8Reads.cache_evictions) ? q8Reads.cache_evictions : null,
    q8_file_cache_evicted_mib: bytesToMiB(q8Reads.cache_evicted_bytes),
    q8_file_cache_merges: Number.isFinite(q8Reads.cache_merges) ? q8Reads.cache_merges : null,
    q8_file_cache_merged_mib: bytesToMiB(q8Reads.cache_merged_bytes),
    dense_f32_mib: bytesToMiB(materialization.dense_f32_bytes),
    q8_f32_materialized_mib: bytesToMiB(materialization.q8_0_f32_materialized_bytes),
    q8_retained_block_mib: bytesToMiB(materialization.q8_0_retained_block_bytes),
    q8_file_backed_tensor_count: materialization.q8_0_file_backed_tensor_count ?? null,
    q8_retained_block_tensor_count: materialization.q8_0_retained_block_tensor_count ?? null,
    has_lazy_q8_0_file_backing: materialization.has_lazy_q8_0_file_backing ?? null,
    has_q8_0_f32_materialization: materialization.has_q8_0_f32_materialization ?? null,
  }
}

function kibToMiB(value) {
  return Number.isFinite(value) ? round(value / 1024) : null
}

function bytesToMiB(value) {
  return Number.isFinite(value) ? round(value / 1024 / 1024) : null
}

function summarizeRuns(runs) {
  const avg = field => average(runs.map(run => run[field]).filter(Number.isFinite))
  const avgMemory = field => average(runs.map(run => run.forward_memory?.[field]).filter(Number.isFinite))
  const maxMemory = field => maxOrNull(runs.map(run => run.forward_memory?.[field]).filter(Number.isFinite))
  const avgPrompt = average(runs.map(run => run.prompt_token_count).filter(Number.isFinite))
  const avgGenerate = avg('generate_ms')
  const memoryRuns = runs.filter(run => run.forward_memory)
  return {
    count: runs.length,
    avg_prompt_token_count: round(avgPrompt),
    all_weight_cache_hit: runs.every(run => run.weight_cache_hit === true),
    any_prompt_cache_hit: runs.some(run => run.prompt_cache_hit === true),
    all_forward_memory_reported: runs.length > 0 && memoryRuns.length === runs.length,
    forward_memory_count: memoryRuns.length,
    max_forward_peak_rss_mib: maxMemory('peak_rss_mib'),
    avg_q8_file_read_mib: round(avgMemory('q8_file_read_mib')),
    max_q8_file_read_mib: maxMemory('q8_file_read_mib'),
    avg_q8_file_read_calls: round(avgMemory('q8_file_read_calls')),
    avg_q8_file_cache_hit_mib: round(avgMemory('q8_file_cache_hit_mib')),
    avg_q8_file_cache_miss_mib: round(avgMemory('q8_file_cache_miss_mib')),
    avg_q8_file_cache_insert_mib: round(avgMemory('q8_file_cache_insert_mib')),
    avg_q8_file_cache_evicted_mib: round(avgMemory('q8_file_cache_evicted_mib')),
    avg_wall_ms: round(avg('wall_ms')),
    avg_generate_ms: round(avgGenerate),
    avg_layers_ms: round(avg('layers_ms')),
    avg_logits_ms: round(avg('logits_ms')),
    avg_attention_projection_ms: round(avg('attention_projection_ms')),
    avg_attention_context_ms: round(avg('attention_context_ms')),
    avg_ffn_gate_ms: round(avg('ffn_gate_ms')),
    avg_ffn_up_ms: round(avg('ffn_up_ms')),
    avg_ffn_activation_ms: round(avg('ffn_activation_ms')),
    avg_ffn_down_ms: round(avg('ffn_down_ms')),
    avg_ffn_total_ms: round(avg('ffn_total_ms')),
    avg_generate_ms_per_prompt_token: round(avgGenerate / avgPrompt),
  }
}

function parseArgs(argv) {
  const parsed = new Map()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const [key, inline] = arg.slice(2).split('=', 2)
    const value = inline ?? (argv[i + 1]?.startsWith('--') ? 'true' : argv[++i] ?? 'true')
    parsed.set(key, value)
  }
  return parsed
}

function maxOrNull(values) {
  return values.length ? round(Math.max(...values)) : null
}

function parsePositiveInt(name, value) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer, got ${value}`)
  return parsed
}

function parseNonNegativeInt(name, value) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative integer, got ${value}`)
  return parsed
}

function parseOptionalPositiveInt(name, value) {
  if (value == null || value === '') return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer, got ${value}`)
  return parsed
}

function sampleBackendMemory(label) {
  const pid = backendPid || backend?.pid || null
  const sample = {
    label,
    pid,
    rss_kib: null,
    rss_mib: null,
    vsz_kib: null,
    vsz_mib: null,
    swapusage: readSwapUsage(),
    vm_pressure: readVmPressure(),
    storage_io: readStorageIo(modelPath),
  }
  if (!pid) {
    return {
      ...sample,
      available: false,
      reason: 'backend pid unknown; run with --start-backend or pass --backend-pid',
    }
  }
  const ps = spawnSync('ps', ['-o', 'pid=', '-o', 'rss=', '-o', 'vsz=', '-p', String(pid)], { encoding: 'utf8' })
  if (ps.status !== 0) {
    return {
      ...sample,
      available: false,
      reason: (ps.stderr || ps.stdout || `ps exited with ${ps.status}`).trim(),
    }
  }
  const fields = ps.stdout.trim().split(/\s+/).map(Number)
  const rssKiB = fields[1]
  const vszKiB = fields[2]
  return {
    ...sample,
    available: Number.isFinite(rssKiB) && Number.isFinite(vszKiB),
    rss_kib: Number.isFinite(rssKiB) ? rssKiB : null,
    rss_mib: Number.isFinite(rssKiB) ? round(rssKiB / 1024) : null,
    vsz_kib: Number.isFinite(vszKiB) ? vszKiB : null,
    vsz_mib: Number.isFinite(vszKiB) ? round(vszKiB / 1024) : null,
  }
}

function readSwapUsage() {
  const sysctl = spawnSync('sysctl', ['-n', 'vm.swapusage'], { encoding: 'utf8' })
  return sysctl.status === 0 ? sysctl.stdout.trim() : null
}

function readVmPressure() {
  const vmStat = spawnSync('vm_stat', [], { encoding: 'utf8' })
  if (vmStat.status !== 0) return null
  const pageSizeMatch = vmStat.stdout.match(/page size of (\d+) bytes/i)
  const pageSize = pageSizeMatch ? Number(pageSizeMatch[1]) : 4096
  const pages = {}
  for (const line of vmStat.stdout.split('\n')) {
    const match = line.match(/^"?([^":]+)"?:\s+([\d.]+)/)
    if (!match) continue
    const key = match[1]
      .toLowerCase()
      .replace(/^pages\s+/, '')
      .replaceAll(' ', '_')
      .replaceAll('-', '_')
    pages[key] = Number.parseInt(match[2].replace(/\./g, ''), 10)
  }
  const toMiB = count => Number.isFinite(count) ? round((count * pageSize) / 1024 / 1024) : null
  return {
    page_size: pageSize,
    free_mib: toMiB(pages.free),
    active_mib: toMiB(pages.active),
    inactive_mib: toMiB(pages.inactive),
    speculative_mib: toMiB(pages.speculative),
    wired_mib: toMiB(pages.wired_down),
    compressor_mib: toMiB(pages.occupied_by_compressor),
    file_backed_mib: toMiB(pages.file_backed),
    anonymous_mib: toMiB(pages.anonymous),
    pageins: pages.pageins ?? null,
    pageins_mib: toMiB(pages.pageins),
    pageouts: pages.pageouts ?? null,
    pageouts_mib: toMiB(pages.pageouts),
    swapins: pages.swapins ?? null,
    swapins_mib: toMiB(pages.swapins),
    swapouts: pages.swapouts ?? null,
    swapouts_mib: toMiB(pages.swapouts),
    compressions: pages.compressions ?? null,
    decompressions: pages.decompressions ?? null,
    translation_faults: pages.translation_faults ?? null,
  }
}

function readStorageIo(path) {
  const mountPath = path || process.cwd()
  const df = spawnSync('df', ['-P', mountPath], { encoding: 'utf8' })
  const fallbackDf = df.status === 0 ? df : spawnSync('df', ['-P', dirname(mountPath)], { encoding: 'utf8' })
  if (fallbackDf.status !== 0) {
    return { available: false, path: mountPath, reason: (fallbackDf.stderr || fallbackDf.stdout || `df exited with ${fallbackDf.status}`).trim() }
  }
  const lines = fallbackDf.stdout.trim().split('\n')
  const fields = lines.at(-1)?.trim().split(/\s+/) || []
  const mountDevice = fields[0] || null
  const mountPoint = fields.slice(5).join(' ') || dirname(mountPath)
  if (!mountDevice?.startsWith('/dev/')) {
    return { available: false, path: mountPath, mount_point: mountPoint, mount_device: mountDevice, reason: 'no block device found by df' }
  }

  const info = spawnSync('diskutil', ['info', mountPoint], { encoding: 'utf8' })
  const physicalStore = info.status === 0 ? info.stdout.match(/^\s*APFS Physical Store:\s+(\S+)/m)?.[1] : null
  const wholeDevice = physicalStore
    ? physicalStore.replace(/s\d+$/, '')
    : info.status === 0
      ? info.stdout.match(/^\s*Part of Whole:\s+(\S+)/m)?.[1] || mountDevice.replace('/dev/', '').replace(/s\d+$/, '')
      : mountDevice.replace('/dev/', '').replace(/s\d+$/, '')
  const iostat = spawnSync('iostat', ['-Id', wholeDevice, '1', '1'], { encoding: 'utf8' })
  if (iostat.status !== 0) {
    return {
      available: false,
      path: mountPath,
      mount_point: mountPoint,
      mount_device: mountDevice,
      whole_device: wholeDevice,
      reason: (iostat.stderr || iostat.stdout || `iostat exited with ${iostat.status}`).trim(),
    }
  }
  const sampleLine = iostat.stdout.trim().split('\n').map(line => line.trim()).filter(Boolean).at(-1)
  const values = sampleLine?.split(/\s+/).map(Number) || []
  return {
    available: values.every(Number.isFinite) && values.length >= 3,
    path: mountPath,
    mount_point: mountPoint,
    mount_device: mountDevice,
    whole_device: wholeDevice,
    kb_per_transfer: finiteRound(values[0]),
    transfers: Number.isFinite(values[1]) ? values[1] : null,
    mb: finiteRound(values[2]),
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}: ${body?.error?.message || text}`)
  }
  return body
}

async function waitForJson(url, options, label) {
  const deadline = Date.now() + 30_000
  let lastError
  while (Date.now() < deadline) {
    try {
      return await fetchJson(url, options)
    } catch (err) {
      lastError = err
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  throw new Error(`${label} did not become reachable at ${url}: ${lastError?.message}`)
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function finiteRound(value) {
  const number = Number(value)
  return Number.isFinite(number) ? round(number) : null
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

function printReport(report) {
  console.log(`backend=${report.api}`)
  console.log(`model=${report.model}`)
  console.log(`message_prefix=${JSON.stringify(report.message_prefix)} max_tokens=${report.max_tokens} warmup=${report.warmup} repeats=${report.repeats}`)
  for (const sample of report.memory_samples || []) {
    console.log(`memory_${sample.label}=pid:${sample.pid ?? 'unknown'} available:${sample.available} rss_mib:${sample.rss_mib ?? 'n/a'} vsz_mib:${sample.vsz_mib ?? 'n/a'} pageins:${sample.vm_pressure?.pageins ?? 'n/a'} storage_mb:${sample.storage_io?.mb ?? 'n/a'} swap:${JSON.stringify(sample.swapusage)}`)
  }
  const summary = report.summary
  console.log(`summary_count=${summary.count}`)
  console.log(`avg_prompt_token_count=${summary.avg_prompt_token_count}`)
  console.log(`all_weight_cache_hit=${summary.all_weight_cache_hit}`)
  console.log(`any_prompt_cache_hit=${summary.any_prompt_cache_hit}`)
  console.log(`all_forward_memory_reported=${summary.all_forward_memory_reported}`)
  console.log(`forward_memory_count=${summary.forward_memory_count}`)
  console.log(`max_forward_peak_rss_mib=${summary.max_forward_peak_rss_mib}`)
  console.log(`avg_q8_file_read_mib=${summary.avg_q8_file_read_mib}`)
  console.log(`max_q8_file_read_mib=${summary.max_q8_file_read_mib}`)
  console.log(`avg_q8_file_read_calls=${summary.avg_q8_file_read_calls}`)
  console.log(`avg_q8_file_cache_hit_mib=${summary.avg_q8_file_cache_hit_mib}`)
  console.log(`avg_q8_file_cache_miss_mib=${summary.avg_q8_file_cache_miss_mib}`)
  console.log(`avg_q8_file_cache_insert_mib=${summary.avg_q8_file_cache_insert_mib}`)
  console.log(`avg_q8_file_cache_evicted_mib=${summary.avg_q8_file_cache_evicted_mib}`)
  console.log(`avg_wall_ms=${summary.avg_wall_ms}`)
  console.log(`avg_generate_ms=${summary.avg_generate_ms}`)
  console.log(`avg_layers_ms=${summary.avg_layers_ms}`)
  console.log(`avg_logits_ms=${summary.avg_logits_ms}`)
  console.log(`avg_attention_projection_ms=${summary.avg_attention_projection_ms}`)
  console.log(`avg_attention_context_ms=${summary.avg_attention_context_ms}`)
  console.log(`avg_ffn_gate_ms=${summary.avg_ffn_gate_ms}`)
  console.log(`avg_ffn_up_ms=${summary.avg_ffn_up_ms}`)
  console.log(`avg_ffn_activation_ms=${summary.avg_ffn_activation_ms}`)
  console.log(`avg_ffn_down_ms=${summary.avg_ffn_down_ms}`)
  console.log(`avg_ffn_total_ms=${summary.avg_ffn_total_ms}`)
  console.log(`avg_generate_ms_per_prompt_token=${summary.avg_generate_ms_per_prompt_token}`)
  for (const run of report.runs) {
    const forwardMemory = run.forward_memory
      ? ` q8_read_mib:${run.forward_memory.q8_file_read_mib} q8_cache_hit_mib:${run.forward_memory.q8_file_cache_hit_mib} q8_cache_miss_mib:${run.forward_memory.q8_file_cache_miss_mib} q8_cache_evicted_mib:${run.forward_memory.q8_file_cache_evicted_mib} peak_rss_mib:${run.forward_memory.peak_rss_mib} peak_phase:${run.forward_memory.peak_phase}`
      : ''
    console.log(`run_${run.index}=tokens:${run.prompt_token_count} wall:${run.wall_ms}ms generate:${run.generate_ms}ms layers:${run.layers_ms}ms logits:${run.logits_ms}ms ffn:${run.ffn_total_ms}ms attn_proj:${run.attention_projection_ms}ms prompt_cache:${run.prompt_cache_hit}${forwardMemory} token:${JSON.stringify(run.generated_token_ids)} text:${JSON.stringify(run.text)}`)
  }
}
