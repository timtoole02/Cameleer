#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const apiBase = (args.get('api') || process.env.CAMELID_API_BASE || 'http://127.0.0.1:8181').replace(/\/$/, '')
const modelPath = resolve(args.get('model') || process.env.LLAMA3_GGUF || '$CAMELID_MODEL_DIR/Meta-Llama-3-8B-Instruct-Q8_0.gguf')
const modelId = args.get('model-id') || process.env.LLAMA3_MODEL_ID || 'llama3-8b-q8'
const out = args.get('out') || process.env.LLAMA3_TOKENIZER_FIXTURE_OUT
const expectedPath = args.get('expected') || process.env.LLAMA3_TOKENIZER_EXPECTED_JSON
const startBackend = args.has('start-backend') || process.env.CAMELID_START_BACKEND === '1'
const buildRelease = args.has('build') || process.env.CAMELID_TOKENIZER_FIXTURE_BUILD === '1'

const cases = [
  {
    name: 'quick_brown_fox',
    text: 'The quick brown fox jumps over the lazy dog.',
    add_special: true,
    parse_special: false,
  },
  {
    name: 'begin_text_hows_it_going',
    text: "<|begin_of_text|>hello how's it going?",
    add_special: false,
    parse_special: true,
  },
]

if (buildRelease) {
  const build = spawnSync('cargo', ['build', '--release', '--bin', 'camelid'], { stdio: 'inherit' })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

let expected = null
if (expectedPath) {
  expected = JSON.parse(await readFile(resolve(expectedPath), 'utf8'))
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
  const load = await fetchJson(`${apiBase}/api/models/load`, {
    method: 'POST',
    body: JSON.stringify({ path: modelPath, id: modelId }),
  })

  const results = []
  for (const testCase of cases) {
    const body = await fetchJson(`${apiBase}/api/models/tokenizer/encode`, {
      method: 'POST',
      body: JSON.stringify({
        text: testCase.text,
        add_special: testCase.add_special,
        parse_special: testCase.parse_special,
      }),
    })
    const expectedCase = expected?.cases?.[testCase.name]
    const expectedTokens = Array.isArray(expectedCase) ? expectedCase : expectedCase?.tokens
    const matchesExpected = Array.isArray(expectedTokens)
      ? arraysEqual(body.tokens, expectedTokens)
      : null
    results.push({
      ...testCase,
      tokens: body.tokens,
      expected_tokens: expectedTokens ?? null,
      matches_expected: matchesExpected,
      token_count: body.tokens.length,
    })
  }

  const report = {
    model: modelPath,
    model_id: modelId,
    api: apiBase,
    tokenizer: load.tokenizer ?? null,
    generation_ready: load.generation_ready ?? null,
    notes: [
      'This script records Camelid Llama 3 tokenizer IDs for the two Phase 12 parity prompts.',
      'If --expected is omitted, results are evidence artifacts only and must not be treated as tokenizer parity against llama.cpp.',
      'Use --expected fixtures/tokenizer/llama3-reference-tokenizer.json (or {"cases":{"quick_brown_fox":[...],"begin_text_hows_it_going":[...]}}) to make this a bit-for-bit parity gate.',
    ],
    cases: results,
    expected_source: expectedPath ? resolve(expectedPath) : null,
    all_expected_match: expectedPath ? results.every(item => item.matches_expected === true) : null,
  }

  console.log(JSON.stringify(report, null, 2))
  if (out) {
    await writeFile(resolve(out), `${JSON.stringify(report, null, 2)}\n`)
    console.error(`json_out=${resolve(out)}`)
  }
  if (expectedPath && !report.all_expected_match) process.exitCode = 1
} finally {
  if (backend) backend.kill('SIGTERM')
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

function arraysEqual(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index])
}
