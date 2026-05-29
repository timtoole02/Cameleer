#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { normalizePromptPack } from './lib/chat-parity-harness.mjs'

const args = parseArgs(process.argv.slice(2))
const packPath = args.get('pack')
const outDirArg = args.get('out-dir') || args.get('output-dir')
const modelPathArg = args.get('model')
const modelId = args.get('model-id') || process.env.LLAMA3_MODEL_ID || 'llama3-q8-pack'
const prefix = args.get('prefix') || modelId
const chatParityScript = resolve(args.get('chat-parity-script') || process.env.CAMELID_CHAT_PARITY_SCRIPT || 'scripts/chat-parity-llama3.mjs')
const backendBase = (args.get('backend') || process.env.CAMELID_API_BASE || 'http://127.0.0.1:8181').replace(/\/$/, '')
const llamaBase = (args.get('llama-url') || process.env.LLAMA3_LLAMA_SERVER_URL || 'http://127.0.0.1:8183').replace(/\/$/, '')
const waitMs = Number.parseInt(args.get('wait-ms') || process.env.LLAMA3_WAIT_MS || '120000', 10)
const llamaFlashAttn = args.get('llama-flash-attn') || process.env.LLAMA3_LLAMA_FLASH_ATTN || 'off'
validateLlamaFlashAttn(llamaFlashAttn)
const requirePromptMatch = args.has('require-prompt-match') || process.env.LLAMA3_CHAT_REQUIRE_PROMPT_MATCH === '1'
const requireGeneratedMatch = args.has('require-generated-match') || process.env.LLAMA3_CHAT_REQUIRE_GENERATED_MATCH === '1'
const passthroughFlags = [
  ['start-llama-server', args.has('start-llama-server') || process.env.LLAMA3_START_LLAMA_SERVER === '1'],
  ['backend-dense-diagnostics', args.has('backend-dense-diagnostics') || process.env.LLAMA3_CHAT_BACKEND_DENSE_DIAGNOSTICS === '1'],
]
const passthroughArgs = [
  ['llama-server', args.get('llama-server') || process.env.LLAMA3_LLAMA_SERVER],
  ['llama-tokenize', args.get('llama-tokenize') || process.env.LLAMA3_LLAMA_TOKENIZE],
]

if (!packPath) throw new Error('--pack is required')
if (!outDirArg) throw new Error('--out-dir is required')
if (!modelPathArg) throw new Error('--model is required')
if (!Number.isInteger(waitMs) || waitMs < 1) throw new Error(`--wait-ms must be a positive integer, got ${args.get('wait-ms')}`)

const pack = normalizePromptPack(JSON.parse(await readFile(resolve(packPath), 'utf8')), {
  packPath: resolve(packPath),
})
const prompts = pack.prompts

const outDir = resolve(outDirArg)
const modelPath = resolve(modelPathArg)
await mkdir(outDir, { recursive: true })

const summary = {
  schema: 'camelid.chat-parity.prompt-pack-run.v1',
  pack: {
    schema: pack.schema,
    id: pack.pack_id,
    path: resolve(packPath),
    description: pack.description,
    prompt_count: prompts.length,
    default_max_tokens: pack.defaults.max_tokens,
    default_render_mode: pack.defaults.render_mode,
    target_context_window: pack.target_context_window,
  },
  backend: backendBase,
  llama_server: llamaBase,
  model: modelPath,
  model_id: modelId,
  prefix,
  chat_parity_script: chatParityScript,
  wait_ms: waitMs,
  require_prompt_match: requirePromptMatch,
  require_generated_match: requireGeneratedMatch,
  llama_flash_attn: llamaFlashAttn,
  prompts: [],
}

let hadFailure = false
for (let index = 0; index < prompts.length; index += 1) {
  const prompt = prompts[index]
  const promptId = prompt.id
  const promptDir = join(outDir, `${prefix}-${promptId}`)
  await mkdir(promptDir, { recursive: true })

  const diagnosticsPath = join(promptDir, 'report.json')
  const stdoutPath = join(promptDir, 'stdout.log')
  const stderrPath = join(promptDir, 'stderr.log')
  const commandPath = join(promptDir, 'command.txt')
  const promptPath = join(promptDir, 'prompt.json')
  const maxTokens = prompt.max_tokens
  const commandArgs = [
    chatParityScript,
    '--backend', backendBase,
    '--llama-url', llamaBase,
    '--model', modelPath,
    '--model-id', modelId,
    '--max-tokens', String(maxTokens),
    '--wait-ms', String(waitMs),
    '--llama-flash-attn', llamaFlashAttn,
    '--diagnostics-out', diagnosticsPath,
  ]
  const renderMode = prompt.render_mode
  if (renderMode) commandArgs.push('--render-mode', renderMode)
  if (prompt.target_context_window) commandArgs.push('--llama-context', String(prompt.target_context_window))
  const hasMessages = Array.isArray(prompt.messages)
  if (hasMessages) {
    commandArgs.push('--messages-json', promptPath)
  } else {
    commandArgs.push('--message', String(prompt.message ?? ''))
  }
  if (requirePromptMatch) commandArgs.push('--require-prompt-match')
  if (requireGeneratedMatch) commandArgs.push('--require-generated-match')
  for (const [flag, enabled] of passthroughFlags) {
    if (enabled) commandArgs.push(`--${flag}`)
  }
  for (const [flag, value] of passthroughArgs) {
    if (value) commandArgs.push(`--${flag}`, String(value))
  }

  await writeFile(promptPath, `${JSON.stringify({ ...prompt, resolved_max_tokens: maxTokens }, null, 2)}\n`)
  await writeFile(commandPath, `${shellJoin(process.execPath, commandArgs)}\n`)

  const { code, stdout, stderr } = await run(process.execPath, commandArgs)
  await writeFile(stdoutPath, stdout)
  await writeFile(stderrPath, stderr)

  let report = null
  try {
    report = JSON.parse(await readFile(diagnosticsPath, 'utf8'))
  } catch {
    report = null
  }

  const result = {
    id: promptId,
    message: prompt.message ?? '',
    messages: Array.isArray(prompt.messages) ? prompt.messages : null,
    render_mode: renderMode,
    note: prompt.note ?? null,
    max_tokens: maxTokens,
    target_context_window: prompt.target_context_window,
    artifact_dir: promptDir,
    report_path: diagnosticsPath,
    stdout_path: stdoutPath,
    stderr_path: stderrPath,
    command_path: commandPath,
    exit_code: code,
    prompt_tokens_match: report?.prompt_tokens_match ?? null,
    generated_tokens_match: report?.generated_tokens_match ?? null,
    generated_text_match: report?.generated_text_match ?? null,
    reference_prompt_token_count: report?.reference_prompt_token_count ?? null,
    reference_context: report?.reference_context ?? null,
    first_generated_token_diff_index: report?.first_generated_token_diff_index ?? null,
    first_generated_text_diff_index: report?.first_generated_text_diff_index ?? null,
  }
  if (code !== 0) hadFailure = true
  if (requirePromptMatch && result.prompt_tokens_match === false) hadFailure = true
  if (requireGeneratedMatch && result.generated_tokens_match === false) hadFailure = true
  summary.prompts.push(result)
}

summary.passed = !hadFailure
summary.prompt_tokens_all_match = summary.prompts.every(prompt => prompt.prompt_tokens_match === true)
summary.generated_tokens_all_match = summary.prompts.every(prompt => prompt.generated_tokens_match === true)
summary.generated_text_all_match = summary.prompts.every(prompt => prompt.generated_text_match === true)
await writeFile(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

console.log(`pack=${resolve(packPath)}`)
console.log(`out_dir=${outDir}`)
console.log(`model=${modelPath}`)
console.log(`model_id=${modelId}`)
console.log(`prompt_count=${summary.prompts.length}`)
console.log(`prompt_tokens_all_match=${summary.prompt_tokens_all_match}`)
console.log(`generated_tokens_all_match=${summary.generated_tokens_all_match}`)
console.log(`generated_text_all_match=${summary.generated_text_all_match}`)
console.log(`summary_json=${join(outDir, 'summary.json')}`)

if (hadFailure) process.exitCode = 1

function validateLlamaFlashAttn(value) {
  if (!['off', 'on', 'auto'].includes(value)) {
    throw new Error(`--llama-flash-attn must be off, on, or auto, got ${value}`)
  }
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

function run(command, commandArgs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => {
      resolvePromise({ code: code ?? 1, stdout, stderr })
    })
  })
}

function shellJoin(command, args) {
  return [command, ...args].map(shellEscape).join(' ')
}

function shellEscape(value) {
  if (/^[A-Za-z0-9_/:=.,-]+$/.test(value)) return value
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}
