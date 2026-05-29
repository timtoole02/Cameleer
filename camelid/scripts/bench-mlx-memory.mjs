#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const python = args.get('python') || process.env.PYTHON || 'python3'
const model = args.get('model') || process.env.MLX_MODEL || 'mlx-community/Llama-3.2-1B-Instruct-4bit'
const maxTokens = parsePositiveInt('max-tokens', args.get('max-tokens') || process.env.MLX_MAX_TOKENS || '8')
const repeats = parsePositiveInt('repeats', args.get('repeats') || process.env.MLX_REPEATS || '1')
const warmup = parseNonNegativeInt('warmup', args.get('warmup') || process.env.MLX_WARMUP || '0')
const sampleMs = parsePositiveInt('sample-ms', args.get('sample-ms') || process.env.MLX_MEMORY_SAMPLE_MS || '100')
const messagePrefix = args.get('message-prefix') || process.env.MLX_MESSAGE_PREFIX || 'memory profile'
const systemPrompt = args.get('system-prompt') ?? process.env.MLX_SYSTEM_PROMPT ?? ''
const out = args.get('out') || process.env.MLX_MEMORY_OUT

const child = spawn(python, ['-c', pythonProgram(), '--', JSON.stringify({ model, maxTokens, repeats, warmup, messagePrefix, systemPrompt })], {
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
let peak = null
const samples = []
const startedAt = Date.now()

const sampler = setInterval(() => {
  const sample = sampleProcessMemory(child.pid, Date.now() - startedAt)
  if (!sample.available) return
  samples.push(sample)
  if (!peak || sample.rss_mib > peak.rss_mib) peak = sample
}, sampleMs)

child.stdout.on('data', chunk => {
  const text = chunk.toString()
  stdout += text
  process.stdout.write(text)
})
child.stderr.on('data', chunk => {
  const text = chunk.toString()
  stderr += text
  process.stderr.write(text)
})

const code = await new Promise(resolveCode => child.on('close', resolveCode))
clearInterval(sampler)
const finalSample = sampleProcessMemory(child.pid, Date.now() - startedAt)
if (finalSample.available) samples.push(finalSample)
if (code !== 0) {
  console.error(`mlx benchmark exited with ${code}`)
  process.exit(code ?? 1)
}

const marker = '__CAMELID_MLX_BENCH_JSON__'
const line = stdout.split('\n').find(value => value.startsWith(marker))
if (!line) {
  console.error('missing MLX benchmark JSON marker')
  process.exit(1)
}
const payload = JSON.parse(line.slice(marker.length))
const report = {
  runtime: 'mlx-lm',
  model,
  max_tokens: maxTokens,
  repeats,
  warmup,
  message_prefix: messagePrefix,
  system_prompt: systemPrompt,
  sample_ms: sampleMs,
  process_memory: {
    pid: child.pid,
    peak_rss_mib: peak?.rss_mib ?? null,
    peak_vsz_mib: peak?.vsz_mib ?? null,
    peak_elapsed_ms: peak?.elapsed_ms ?? null,
    sample_count: samples.length,
    samples,
  },
  stdout_json: payload,
  stderr_tail: stderr.trim().split('\n').slice(-20),
  notes: [
    'MLX-LM benchmark process RSS is sampled externally with ps while the Python process loads the model and generates text.',
    'Measured runs reuse the loaded MLX model; download/cache time is not separated by this harness unless the model is already cached before launch.',
    'Use this as a same-host directional runtime/memory comparison, not a strict quant-equivalent comparison against Camelid GGUF Q8_0.',
  ],
}

printReport(report)
if (out) {
  await writeFile(resolve(out), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`json_out=${resolve(out)}`)
}

function pythonProgram() {
  return String.raw`
import json, sys, time, platform
from mlx_lm import load, stream_generate

cfg = json.loads(sys.argv[-1])
model_id = cfg['model']
max_tokens = int(cfg['maxTokens'])
repeats = int(cfg['repeats'])
warmup = int(cfg['warmup'])
message_prefix = cfg['messagePrefix']
system_prompt = cfg.get('systemPrompt') or ''

def message(phase, idx):
    words = ['amber', 'birch', 'cedar', 'dahlia', 'elder', 'fern', 'ginger', 'hazel']
    offset = warmup if phase == 'measure' else 0
    return f"{message_prefix} {phase} {idx + 1} {words[(idx + offset) % len(words)]}"

def render_prompt(tok, user_message):
    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    messages.append({'role': 'user', 'content': user_message})
    if hasattr(tok, 'apply_chat_template'):
        try:
            return tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        except TypeError:
            return tok.apply_chat_template(messages, tokenize=False)
    return user_message

def run_once(tok, model, phase, idx):
    user_message = message(phase, idx)
    prompt = render_prompt(tok, user_message)
    tokenized = tok.encode(prompt) if hasattr(tok, 'encode') else []
    started = time.perf_counter()
    first = None
    chunks = []
    token_ids = []
    for response in stream_generate(model, tok, prompt, max_tokens=max_tokens):
        if first is None:
            first = time.perf_counter()
        text = getattr(response, 'text', '') or ''
        if text:
            chunks.append(text)
        token = getattr(response, 'token', None)
        if token is not None:
            try:
                token_ids.append(int(token))
            except Exception:
                pass
    ended = time.perf_counter()
    return {
        'phase': phase,
        'index': idx + 1,
        'message': user_message,
        'prompt_token_count': len(tokenized),
        'generated_token_count': len(token_ids) if token_ids else None,
        'ttft_ms': None if first is None else round((first - started) * 1000, 2),
        'generate_ms': round((ended - started) * 1000, 2),
        'text': ''.join(chunks),
    }

load_started = time.perf_counter()
model_obj, tok = load(model_id)
load_ended = time.perf_counter()
warmup_runs = [run_once(tok, model_obj, 'warmup', idx) for idx in range(warmup)]
runs = [run_once(tok, model_obj, 'measure', idx) for idx in range(repeats)]

def avg(field):
    values = [run[field] for run in runs if isinstance(run.get(field), (int, float))]
    return None if not values else round(sum(values) / len(values), 2)

print('__CAMELID_MLX_BENCH_JSON__' + json.dumps({
    'model': model_id,
    'python': platform.python_version(),
    'load_ms': round((load_ended - load_started) * 1000, 2),
    'warmup_runs': warmup_runs,
    'runs': runs,
    'summary': {
        'count': len(runs),
        'avg_prompt_token_count': avg('prompt_token_count'),
        'avg_ttft_ms': avg('ttft_ms'),
        'avg_generate_ms': avg('generate_ms'),
    },
}, separators=(',', ':')))
`
}

function sampleProcessMemory(pid, elapsedMs) {
  const base = { pid, elapsed_ms: elapsedMs, available: false, rss_kib: null, rss_mib: null, vsz_kib: null, vsz_mib: null }
  if (!pid) return base
  const ps = spawnSync('ps', ['-o', 'pid=', '-o', 'rss=', '-o', 'vsz=', '-p', String(pid)], { encoding: 'utf8' })
  if (ps.status !== 0 || !ps.stdout.trim()) return base
  const fields = ps.stdout.trim().split(/\s+/).map(Number)
  const rssKiB = fields[1]
  const vszKiB = fields[2]
  return {
    ...base,
    available: Number.isFinite(rssKiB) && Number.isFinite(vszKiB),
    rss_kib: Number.isFinite(rssKiB) ? rssKiB : null,
    rss_mib: Number.isFinite(rssKiB) ? round(rssKiB / 1024) : null,
    vsz_kib: Number.isFinite(vszKiB) ? vszKiB : null,
    vsz_mib: Number.isFinite(vszKiB) ? round(vszKiB / 1024) : null,
  }
}

function parseArgs(argv) {
  const parsed = new Map()
  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx]
    if (!arg.startsWith('--')) continue
    const [key, inline] = arg.slice(2).split('=', 2)
    const value = inline ?? (argv[idx + 1]?.startsWith('--') ? 'true' : argv[++idx] ?? 'true')
    parsed.set(key, value)
  }
  return parsed
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

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

function printReport(report) {
  console.log(`runtime=${report.runtime}`)
  console.log(`model=${report.model}`)
  console.log(`max_tokens=${report.max_tokens} warmup=${report.warmup} repeats=${report.repeats}`)
  console.log(`peak_rss_mib=${report.process_memory.peak_rss_mib}`)
  console.log(`peak_vsz_mib=${report.process_memory.peak_vsz_mib}`)
  console.log(`load_ms=${report.stdout_json.load_ms}`)
  console.log(`avg_ttft_ms=${report.stdout_json.summary.avg_ttft_ms}`)
  console.log(`avg_generate_ms=${report.stdout_json.summary.avg_generate_ms}`)
  for (const run of report.stdout_json.runs) {
    console.log(`run_${run.index}=prompt_tokens:${run.prompt_token_count} ttft:${run.ttft_ms}ms generate:${run.generate_ms}ms text:${JSON.stringify(run.text)}`)
  }
}
