#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

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
const prompt = args.get('prompt') ?? process.env.TINYLLAMA_TOKENIZER_PROMPT ?? '<|user|>\nhello</s>\n<|assistant|>'
const addSpecial = parseBool(args.get('add-special') ?? process.env.TINYLLAMA_TOKENIZER_ADD_SPECIAL ?? 'true')
const parseSpecial = parseBool(args.get('parse-special') ?? process.env.TINYLLAMA_TOKENIZER_PARSE_SPECIAL ?? 'false')
const allowMismatch = args.has('allow-mismatch') || process.env.TINYLLAMA_TOKENIZER_ALLOW_MISMATCH === '1'
const llamaServerBin = args.get('llama-server') || process.env.TINYLLAMA_LLAMA_SERVER || 'llama-server'
const startLlamaServer = args.has('start-llama-server') || process.env.TINYLLAMA_START_LLAMA_SERVER === '1'

let child
let childSpawnError
try {
  if (startLlamaServer) {
    const url = new URL(llamaBase)
    child = spawn(llamaServerBin, [
      '--host', url.hostname,
      '--port', url.port || '8183',
      '-m', modelPath,
      '-ngl', '0',
      '-c', '512',
      '--no-warmup',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    child.once('error', err => { childSpawnError = err })
    child.stdout.on('data', chunk => process.stderr.write(`[llama-server] ${chunk}`))
    child.stderr.on('data', chunk => process.stderr.write(`[llama-server] ${chunk}`))
  }

  await waitForJson(`${backendBase}/v1/health`, {}, 'backend')
  if (startLlamaServer) {
    try {
      await waitForJson(`${llamaBase}/health`, {}, 'llama-server')
    } catch (err) {
      if (childSpawnError?.code === 'ENOENT') {
        throw new Error(`could not start llama-server binary ${JSON.stringify(llamaServerBin)}; pass --llama-server or set TINYLLAMA_LLAMA_SERVER to an executable path`)
      }
      throw err
    }
  }

  await fetchJson(`${backendBase}/api/models/load`, {
    method: 'POST',
    body: JSON.stringify({ path: modelPath, id: modelId }),
  })

  const [backend, baseline] = await Promise.all([
    fetchJson(`${backendBase}/api/models/tokenizer/encode`, {
      method: 'POST',
      body: JSON.stringify({ text: prompt, add_special: addSpecial, parse_special: parseSpecial }),
    }),
    fetchJson(`${llamaBase}/tokenize`, {
      method: 'POST',
      body: JSON.stringify({ content: prompt, add_special: addSpecial }),
    }),
  ])

  const backendTokens = backend.tokens
  const baselineTokens = baseline.tokens
  const match = JSON.stringify(backendTokens) === JSON.stringify(baselineTokens)

  console.log(`backend=${backendBase}`)
  console.log(`llama_server=${llamaBase}`)
  console.log(`model=${modelPath}`)
  console.log(`prompt=${JSON.stringify(prompt)}`)
  console.log(`add_special=${addSpecial}`)
  console.log(`backend_parse_special=${parseSpecial}`)
  console.log(`backend_tokens=${JSON.stringify(backendTokens)}`)
  console.log(`baseline_tokens=${JSON.stringify(baselineTokens)}`)
  console.log(`match=${match}`)

  if (!match) {
    const firstDiff = firstDifference(backendTokens, baselineTokens)
    console.log(`first_diff_index=${firstDiff}`)
    if (!allowMismatch) process.exitCode = 1
  }
} finally {
  if (child) child.kill('SIGTERM')
}

function parseBool(value) {
  if (value === true || value === 'true' || value === '1') return true
  if (value === false || value === 'false' || value === '0') return false
  throw new Error(`expected boolean, got ${value}`)
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

function firstDifference(left, right) {
  const max = Math.max(left.length, right.length)
  for (let i = 0; i < max; i += 1) {
    if (left[i] !== right[i]) return i
  }
  return -1
}
