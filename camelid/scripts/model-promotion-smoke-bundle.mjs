#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const args = parseArgs(process.argv.slice(2))

if (args.has('help') || args.has('h')) {
  console.log(`Usage: node scripts/model-promotion-smoke-bundle.mjs [options]

Capture one exact-row API/WebUI promotion smoke bundle against a running Camelid backend/frontend.

Required options:
  --model <path>                       Exact GGUF model path to load
  --out-dir <path>                     Output artifact directory

Common options:
  --api <url>                          Camelid API base (default: CAMELID_API_BASE or http://127.0.0.1:8181)
  --frontend <url>                     Frontend URL (default: CAMELID_FRONTEND_URL or http://127.0.0.1:4175)
  --model-id <id>                      Runtime model id to load (default: CAMELID_SMOKE_MODEL_ID or smoke-model)
  --message <text>                     Prompt/chat message (default: hello)
  --max-tokens <n>                     Positive token budget (default: 1)
  --temperature <number>               Sampling temperature (default: 0)
  --skip-frontend                      Capture API artifacts only
  --allow-guarded-chat                 Let frontend smoke pass guarded-chat state instead of requiring generation
  --frontend-script <path>             Frontend smoke script (default: frontend/scripts/smoke.mjs)
  --timings-script <path>              Timing summary script (default: scripts/summarize-generation-timings.mjs)
  --expect-compatibility-row <id>      Assert exact frontend/API compatibility row
  --expect-compatibility-status <text> Assert exact compatibility status
  --expect-contract-supported <bool>   Assert frontend contract support state
  --expect-webui-chat <state>          Assert WebUI chat state, e.g. enabled
  --help, -h                           Print this help without writing files
`)
  process.exit(0)
}

const apiBase = (args.get('api') || args.get('backend') || process.env.CAMELID_API_BASE || 'http://127.0.0.1:8181').replace(/\/$/, '')
const frontendUrl = (args.get('frontend') || process.env.CAMELID_FRONTEND_URL || 'http://127.0.0.1:4175').replace(/\/$/, '')
const modelPath = args.get('model') ? resolve(args.get('model')) : null
const modelId = args.get('model-id') || process.env.CAMELID_SMOKE_MODEL_ID || 'smoke-model'
const outDir = args.get('out-dir') ? resolve(args.get('out-dir')) : null
const message = args.get('message') ?? 'hello'
const maxTokens = parsePositiveInt('max-tokens', args.get('max-tokens') || '1')
const temperature = Number.parseFloat(args.get('temperature') || '0')
const skipFrontend = args.has('skip-frontend')
const allowGuardedChat = args.has('allow-guarded-chat')
const frontendScript = resolve(args.get('frontend-script') || 'frontend/scripts/smoke.mjs')
const timingsScript = resolve(args.get('timings-script') || 'scripts/summarize-generation-timings.mjs')
const expectCompatibilityRow = args.get('expect-compatibility-row') || ''
const expectCompatibilityStatus = args.get('expect-compatibility-status') || ''
const expectContractSupported = args.get('expect-contract-supported') || ''
const expectWebUiChat = args.get('expect-webui-chat') || ''

if (!modelPath) throw new Error('--model is required')
if (!outDir) throw new Error('--out-dir is required')
if (!Number.isFinite(temperature)) throw new Error(`--temperature must be numeric, got ${args.get('temperature')}`)

await mkdir(outDir, { recursive: true })

const summary = {
  schema: 'camelid.model-promotion.smoke-bundle.v1',
  generated_utc: new Date().toISOString(),
  api_base: apiBase,
  frontend_url: frontendUrl,
  model_path: modelPath,
  model_id: modelId,
  message,
  max_tokens: maxTokens,
  temperature,
  allow_guarded_chat: allowGuardedChat,
  skip_frontend: skipFrontend,
  steps: {},
  passed: false,
}

try {
  const healthBefore = await tryFetchJson(`${apiBase}/v1/health`)
  await recordStep('health_before', healthBefore, join(outDir, 'health-before.json'))

  const loadRequest = { path: modelPath, id: modelId }
  await writeJson(join(outDir, 'load.request.json'), loadRequest)
  const loadResponse = await fetchJson(`${apiBase}/api/models/load`, {
    method: 'POST',
    body: JSON.stringify(loadRequest),
  })
  await recordStep('load', loadResponse, join(outDir, 'load.response.json'))

  const current = await fetchJson(`${apiBase}/api/models/current`)
  await recordStep('current_model', current, join(outDir, 'current-model.json'))

  const models = await fetchJson(`${apiBase}/v1/models`)
  await recordStep('v1_models', models, join(outDir, 'v1-models.json'))

  const capabilities = await tryFetchJson(`${apiBase}/api/capabilities`)
  await recordStep('capabilities', capabilities, join(outDir, 'capabilities.json'))

  const completionRequest = {
    model: modelId,
    prompt: message,
    max_tokens: maxTokens,
    stream: false,
    temperature,
  }
  await writeJson(join(outDir, 'completion.request.json'), completionRequest)
  const completionResponsePath = join(outDir, 'completion.response.json')
  const completionResponse = await fetchJson(`${apiBase}/v1/completions`, {
    method: 'POST',
    body: JSON.stringify(completionRequest),
  })
  await recordStep('v1_completions', completionResponse, completionResponsePath)

  const chatRequest = {
    model: modelId,
    messages: [{ role: 'user', content: message }],
    max_tokens: maxTokens,
    stream: false,
    temperature,
  }
  await writeJson(join(outDir, 'chat.request.json'), chatRequest)
  const chatResponsePath = join(outDir, 'chat.response.json')
  const chatResponse = await fetchJson(`${apiBase}/v1/chat/completions`, {
    method: 'POST',
    body: JSON.stringify(chatRequest),
  })
  await recordStep('v1_chat_completions', chatResponse, chatResponsePath)

  const timingsReportPath = join(outDir, 'generation-timings.summary.json')
  const timingsCommand = [
    process.execPath,
    timingsScript,
    '--out', timingsReportPath,
    completionResponsePath,
    chatResponsePath,
  ]
  await writeFile(join(outDir, 'generation-timings.command.txt'), `${shellJoin(timingsCommand)}\n`)
  const timingsRun = await run(timingsCommand[0], timingsCommand.slice(1))
  await writeFile(join(outDir, 'generation-timings.stdout.log'), timingsRun.stdout)
  await writeFile(join(outDir, 'generation-timings.stderr.log'), timingsRun.stderr)
  const timingsSummary = {
    command: timingsCommand,
    exit_code: timingsRun.code,
    summary_path: timingsReportPath,
  }
  if (timingsRun.code !== 0) {
    timingsSummary.__error = `generation timing summary exited ${timingsRun.code}`
  }
  await recordStep('generation_timings', timingsSummary, join(outDir, 'generation-timings.run.json'))

  const healthAfter = await tryFetchJson(`${apiBase}/v1/health`)
  await recordStep('health_after', healthAfter, join(outDir, 'health-after.json'))

  if (!skipFrontend) {
    const frontendCommand = [
      process.execPath,
      frontendScript,
      '--api', apiBase,
      '--frontend', frontendUrl,
      '--model', modelPath,
      '--model-id', modelId,
      '--chat-repeats', '1',
      '--require-generation',
    ]
    if (allowGuardedChat) {
      frontendCommand.pop()
      frontendCommand.push('--allow-guarded-chat')
    }
    if (expectCompatibilityRow) frontendCommand.push('--expect-compatibility-row', expectCompatibilityRow)
    if (expectCompatibilityStatus) frontendCommand.push('--expect-compatibility-status', expectCompatibilityStatus)
    if (expectContractSupported) frontendCommand.push('--expect-contract-supported', expectContractSupported)
    if (expectWebUiChat) frontendCommand.push('--expect-webui-chat', expectWebUiChat)
    await writeFile(join(outDir, 'frontend.command.txt'), `${shellJoin(frontendCommand)}\n`)
    const frontendRun = await run(frontendCommand[0], frontendCommand.slice(1))
    await writeFile(join(outDir, 'frontend.stdout.log'), frontendRun.stdout)
    await writeFile(join(outDir, 'frontend.stderr.log'), frontendRun.stderr)
    const frontendSummary = {
      command: frontendCommand,
      exit_code: frontendRun.code,
      mode: allowGuardedChat ? 'allow_guarded_chat' : 'require_generation',
    }
    await recordStep('frontend_smoke', frontendSummary, join(outDir, 'frontend.summary.json'))
    if (frontendRun.code !== 0) {
      throw new Error(`frontend smoke exited ${frontendRun.code}`)
    }
  }

  summary.passed = true
} catch (error) {
  summary.error = error instanceof Error ? error.message : String(error)
} finally {
  await writeJson(join(outDir, 'summary.json'), summary)
}

if (!summary.passed) process.exitCode = 1

async function recordStep(name, payload, path) {
  await writeJson(path, payload)
  summary.steps[name] = {
    ok: !payload?.__error,
    path,
  }
  if (payload?.__error) throw new Error(`${name}: ${payload.__error}`)
}

async function tryFetchJson(url, options = {}) {
  try {
    return await fetchJson(url, options)
  } catch (error) {
    return { __error: error instanceof Error ? error.message : String(error), url }
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

async function writeJson(path, payload) {
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`)
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

function parsePositiveInt(name, value) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer, got ${value}`)
  return parsed
}

function run(command, commandArgs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => resolvePromise({ code: code ?? 1, stdout, stderr }))
  })
}

function shellJoin(parts) {
  return parts.map(shellEscape).join(' ')
}

function shellEscape(value) {
  if (/^[A-Za-z0-9_/:=.,-]+$/.test(value)) return value
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}
