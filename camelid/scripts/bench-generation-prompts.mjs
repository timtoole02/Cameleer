#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inline] = arg.slice(2).split('=', 2)
  const value = inline ?? (process.argv[i + 1]?.startsWith('--') ? 'true' : process.argv[++i] ?? 'true')
  args.set(key, value)
}

const apiBase = (args.get('api') || args.get('backend') || process.env.CAMELID_API_BASE || 'http://127.0.0.1:8181').replace(/\/$/, '')
const modelPath = resolve(args.get('model') || process.env.TINYLLAMA_GGUF || 'models/tinyllama-1.1b-chat-v1.0.Q8_0.gguf')
const modelId = args.get('model-id') || process.env.TINYLLAMA_MODEL_ID || 'tinyllama-q8'
const userMessage = args.get('message') ?? process.env.TINYLLAMA_CHAT_MESSAGE ?? 'hello'
const repeats = parsePositiveInt('repeats', args.get('repeats') || process.env.CAMELID_PROMPT_BENCH_REPEATS || '4')
const maxTokens = parsePositiveInt('max-tokens', args.get('max-tokens') || process.env.CAMELID_PROMPT_BENCH_MAX_TOKENS || '1')
const startBackend = args.has('start-backend') || process.env.CAMELID_START_BACKEND === '1'
const buildRelease = args.has('build') || process.env.CAMELID_PROMPT_BENCH_BUILD === '1'
const out = args.get('out') || args.get('output') || process.env.CAMELID_PROMPT_BENCH_OUT

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
  await fetchJson(`${apiBase}/api/models/load`, {
    method: 'POST',
    body: JSON.stringify({ path: modelPath, id: modelId }),
  })

  const renderedTinyLlamaChat = `<|user|>\n${userMessage}</s>\n<|assistant|>\n`
  const cases = [
    {
      name: 'completion_short_text',
      endpoint: '/v1/completions',
      tokenizeText: userMessage,
      body: { model: modelId, prompt: userMessage, max_tokens: maxTokens, stream: false, temperature: 0 },
    },
    {
      name: 'completion_rendered_chat_prompt',
      endpoint: '/v1/completions',
      tokenizeText: renderedTinyLlamaChat,
      body: { model: modelId, prompt: renderedTinyLlamaChat, max_tokens: maxTokens, stream: false, temperature: 0 },
    },
    {
      name: 'chat_template_hello',
      endpoint: '/v1/chat/completions',
      tokenizeText: renderedTinyLlamaChat,
      body: { model: modelId, messages: [{ role: 'user', content: userMessage }], max_tokens: maxTokens, stream: false, temperature: 0 },
    },
  ]

  const results = []
  for (const benchCase of cases) {
    const encoded = await fetchJson(`${apiBase}/api/models/tokenizer/encode`, {
      method: 'POST',
      body: JSON.stringify({ text: benchCase.tokenizeText, add_special: true, parse_special: false }),
    })
    const runs = []
    for (let idx = 0; idx < repeats; idx += 1) {
      const started = performance.now()
      const response = await fetchJson(`${apiBase}${benchCase.endpoint}`, {
        method: 'POST',
        body: JSON.stringify(benchCase.body),
      })
      const wall_ms = performance.now() - started
      const diagnostics = response.camelid || {}
      runs.push({
        index: idx + 1,
        wall_ms,
        text: response.choices?.[0]?.message?.content ?? response.choices?.[0]?.text ?? '',
        usage: response.usage || null,
        prompt_token_ids: diagnostics.prompt_token_ids || null,
        generated_token_ids: diagnostics.generated_token_ids || null,
        timings_ms: diagnostics.timings_ms || null,
      })
    }
    results.push(summarizeCase(benchCase, encoded.tokens || [], runs))
  }

  const report = {
    api: apiBase,
    model: modelPath,
    model_id: modelId,
    message: userMessage,
    max_tokens: maxTokens,
    repeats,
    cases: results,
    notes: [
      'Warm averages exclude run 1 so the active model CPU weight cache is hot.',
      'generation_ms_per_prompt_token uses backend generate_ms divided by prompt token count; for max_tokens=1 this approximates the current sequential prefill cost.',
      'completion_rendered_chat_prompt and chat_template_hello should have matching prompt_token_ids; this is the apples-to-apples chat-template path check.',
    ],
  }

  printReport(report)
  if (out) {
    await writeFile(resolve(out), `${JSON.stringify(report, null, 2)}\n`)
    console.log(`json_out=${resolve(out)}`)
  }
} finally {
  if (backend) backend.kill('SIGTERM')
}

function parsePositiveInt(name, value) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer, got ${value}`)
  return parsed
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

function summarizeCase(benchCase, encodedPromptTokenIds, runs) {
  const warmRuns = runs.slice(1)
  const avg = values => values.reduce((sum, value) => sum + value, 0) / values.length
  const warmGenerate = warmRuns.map(run => Number(run.timings_ms?.generate)).filter(Number.isFinite)
  const warmLayers = warmRuns.map(run => Number(run.timings_ms?.generation?.layers_total)).filter(Number.isFinite)
  const warmLogits = warmRuns.map(run => Number(run.timings_ms?.generation?.logits)).filter(Number.isFinite)
  const promptTokenCount = encodedPromptTokenIds.length
  return {
    name: benchCase.name,
    endpoint: benchCase.endpoint,
    prompt_token_count: promptTokenCount,
    encoded_prompt_token_ids: encodedPromptTokenIds,
    observed_prompt_token_ids_match: runs.every(run => Array.isArray(run.prompt_token_ids))
      ? runs.every(run => JSON.stringify(run.prompt_token_ids) === JSON.stringify(encodedPromptTokenIds))
      : null,
    first_run: compactRun(runs[0], promptTokenCount),
    warm_avg_ms: {
      wall: avg(warmRuns.map(run => run.wall_ms)),
      generate: warmGenerate.length ? avg(warmGenerate) : null,
      layers: warmLayers.length ? avg(warmLayers) : null,
      logits: warmLogits.length ? avg(warmLogits) : null,
      generation_per_prompt_token: warmGenerate.length ? avg(warmGenerate) / promptTokenCount : null,
    },
    runs: runs.map(run => compactRun(run, promptTokenCount)),
  }
}

function compactRun(run, promptTokenCount) {
  const generate = Number(run.timings_ms?.generate)
  return {
    index: run.index,
    wall_ms: round(run.wall_ms),
    generated_token_ids: run.generated_token_ids,
    text: run.text,
    usage_prompt_tokens: run.usage?.prompt_tokens ?? null,
    weight_cache_hit: run.timings_ms?.weight_cache_hit,
    prompt_cache_hit: run.timings_ms?.prompt_cache_hit,
    generate_ms: Number.isFinite(generate) ? round(generate) : null,
    layers_ms: finiteRound(run.timings_ms?.generation?.layers_total),
    logits_ms: finiteRound(run.timings_ms?.generation?.logits),
    generate_ms_per_prompt_token: Number.isFinite(generate) ? round(generate / promptTokenCount) : null,
  }
}

function finiteRound(value) {
  const number = Number(value)
  return Number.isFinite(number) ? round(number) : null
}

function round(value) {
  return Math.round(value * 100) / 100
}

function printReport(report) {
  console.log(`backend=${report.api}`)
  console.log(`model=${report.model}`)
  console.log(`message=${JSON.stringify(report.message)} max_tokens=${report.max_tokens} repeats=${report.repeats}`)
  for (const result of report.cases) {
    console.log(`\ncase=${result.name}`)
    console.log(`  endpoint=${result.endpoint}`)
    console.log(`  prompt_tokens=${result.prompt_token_count}`)
    console.log(`  prompt_token_ids=${JSON.stringify(result.encoded_prompt_token_ids)}`)
    console.log(`  observed_prompt_token_ids_match=${result.observed_prompt_token_ids_match}`)
    console.log(`  warm_wall_avg_ms=${round(result.warm_avg_ms.wall)}`)
    console.log(`  warm_backend_generate_avg_ms=${formatNumber(result.warm_avg_ms.generate)}`)
    console.log(`  warm_backend_layers_avg_ms=${formatNumber(result.warm_avg_ms.layers)}`)
    console.log(`  warm_backend_logits_avg_ms=${formatNumber(result.warm_avg_ms.logits)}`)
    console.log(`  warm_generate_ms_per_prompt_token=${formatNumber(result.warm_avg_ms.generation_per_prompt_token)}`)
    for (const run of result.runs) {
      console.log(`  run_${run.index}=wall:${run.wall_ms}ms generate:${formatMs(run.generate_ms)} layers:${formatMs(run.layers_ms)} logits:${formatMs(run.logits_ms)} weight_cache:${run.weight_cache_hit ?? 'n/a'} prompt_cache:${run.prompt_cache_hit ?? 'n/a'} usage_prompt:${run.usage_prompt_tokens ?? 'n/a'} token:${JSON.stringify(run.generated_token_ids)} text:${JSON.stringify(run.text)}`)
    }
  }
}

function formatNumber(value) {
  return Number.isFinite(value) ? round(value) : 'n/a'
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value}ms` : 'n/a'
}
