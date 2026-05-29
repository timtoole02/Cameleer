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
const userMessage = args.get('message') ?? process.env.TINYLLAMA_CHAT_MESSAGE ?? 'hello'
const maxTokens = Number.parseInt(args.get('max-tokens') || process.env.TINYLLAMA_CHAT_MAX_TOKENS || '1', 10)
const allowPromptMismatch = args.has('allow-prompt-mismatch') || process.env.TINYLLAMA_CHAT_ALLOW_PROMPT_MISMATCH === '1'
const llamaServerBin = args.get('llama-server') || process.env.TINYLLAMA_LLAMA_SERVER || 'llama-server'
const startLlamaServer = args.has('start-llama-server') || process.env.TINYLLAMA_START_LLAMA_SERVER === '1'
const diagnosticsOut = args.get('diagnostics-out') || process.env.TINYLLAMA_CHAT_DIAGNOSTICS_OUT
const requireGeneratedMatch = args.has('require-generated-match') || process.env.TINYLLAMA_CHAT_REQUIRE_GENERATED_MATCH === '1'

if (!Number.isInteger(maxTokens) || maxTokens < 1) {
  throw new Error(`--max-tokens must be a positive integer, got ${args.get('max-tokens')}`)
}

const messages = [{ role: 'user', content: userMessage }]
const expectedPrompt = `<|user|>\n${userMessage}</s>\n<|assistant|>\n`

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
  try {
    await waitForJson(`${llamaBase}/health`, {}, 'llama-server')
  } catch (err) {
    if (childSpawnError?.code === 'ENOENT') {
      throw new Error(`could not start llama-server binary ${JSON.stringify(llamaServerBin)}; pass --llama-server or set TINYLLAMA_LLAMA_SERVER to an executable path`)
    }
    throw err
  }

  await fetchJson(`${backendBase}/api/models/load`, {
    method: 'POST',
    body: JSON.stringify({ path: modelPath, id: modelId }),
  })

  const chatPayload = {
    model: modelId,
    messages,
    max_tokens: maxTokens,
    stream: false,
    temperature: 0,
  }

  const [llamaChat, llamaTokens] = await Promise.all([
    fetchJson(`${llamaBase}/v1/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        ...chatPayload,
        logprobs: true,
        top_logprobs: 20,
      }),
    }),
    fetchJson(`${llamaBase}/tokenize`, {
      method: 'POST',
      body: JSON.stringify({ content: expectedPrompt, add_special: true }),
    }),
  ])
  const llamaText = llamaChat.choices?.[0]?.message?.content ?? ''
  const llamaLogprobContent = llamaChat.choices?.[0]?.logprobs?.content ?? []
  const llamaGeneratedTokensFromLogprobs = llamaLogprobContent
    .map(item => Number.isInteger(item?.id) ? item.id : null)
    .filter(token => token !== null)
  const llamaTopLogprobs = llamaLogprobContent.flatMap(item => item?.top_logprobs ?? [])
  const llamaGeneratedTokensFromText = llamaText
    ? (await fetchJson(`${llamaBase}/tokenize`, {
        method: 'POST',
        body: JSON.stringify({ content: llamaText, add_special: false }),
      })).tokens || []
    : []
  const llamaGeneratedTokens = llamaGeneratedTokensFromLogprobs.length > 0
    ? llamaGeneratedTokensFromLogprobs
    : llamaGeneratedTokensFromText
  const diagnosticTokenIds = uniqueTokenIds([
    ...llamaGeneratedTokens,
    ...llamaGeneratedTokensFromText,
    ...llamaTopLogprobs.map(item => item?.id),
  ]).slice(0, 16)
  const backendChat = await fetchJson(`${backendBase}/v1/chat/completions`, {
    method: 'POST',
    body: JSON.stringify({
      ...chatPayload,
      camelid_logit_token_ids: diagnosticTokenIds,
      camelid_dense_diagnostics: true,
    }),
  })

  const backendPromptTokens = backendChat.camelid?.prompt_token_ids || []
  const backendGeneratedTokens = backendChat.camelid?.generated_token_ids || []
  const backendDenseMetadata = backendChat.camelid?.dense_metadata || null
  const backendTopLogits = backendChat.camelid?.top_logits || []
  const backendOutputProjection = backendChat.camelid?.output_projection || []
  const backendDense = compactDenseDiagnostics(backendChat.camelid?.dense)
  const baselinePromptTokens = llamaTokens.tokens || []
  const promptMatch = JSON.stringify(backendPromptTokens) === JSON.stringify(baselinePromptTokens)
  const backendText = backendChat.choices?.[0]?.message?.content ?? ''
  const textMatch = backendText === llamaText
  const generatedTextDiffIndex = firstStringDifference(backendText, llamaText)

  console.log(`backend=${backendBase}`)
  console.log(`llama_server=${llamaBase}`)
  console.log(`model=${modelPath}`)
  console.log(`message=${JSON.stringify(userMessage)}`)
  console.log(`expected_prompt=${JSON.stringify(expectedPrompt)}`)
  console.log(`backend_prompt_tokens=${JSON.stringify(backendPromptTokens)}`)
  console.log(`llama_prompt_tokens=${JSON.stringify(baselinePromptTokens)}`)
  console.log(`prompt_tokens_match=${promptMatch}`)
  console.log(`backend_generated_tokens=${JSON.stringify(backendGeneratedTokens)}`)
  console.log(`llama_generated_tokens=${JSON.stringify(llamaGeneratedTokens)}`)
  console.log(`llama_generated_tokens_from_text=${JSON.stringify(llamaGeneratedTokensFromText)}`)
  console.log(`llama_top_logprobs=${JSON.stringify(llamaTopLogprobs)}`)
  console.log(`backend_diagnostic_token_ids=${JSON.stringify(diagnosticTokenIds)}`)
  console.log(`backend_dense_metadata=${JSON.stringify(backendDenseMetadata)}`)
  console.log(`backend_top_logits=${JSON.stringify(backendTopLogits)}`)
  console.log(`backend_output_projection=${JSON.stringify(backendOutputProjection)}`)
  console.log(`backend_dense=${JSON.stringify(backendDense)}`)
  console.log(`backend_text=${JSON.stringify(backendText)}`)
  console.log(`llama_text=${JSON.stringify(llamaText)}`)
  console.log(`generated_text_match=${textMatch}`)
  console.log(`first_generated_text_diff_index=${generatedTextDiffIndex}`)
  console.log(`backend_usage=${JSON.stringify(backendChat.usage)}`)
  console.log(`llama_usage=${JSON.stringify(llamaChat.usage)}`)

  if (diagnosticsOut) {
    const diagnosticsPath = resolve(diagnosticsOut)
    await mkdir(dirname(diagnosticsPath), { recursive: true })
    await writeFile(diagnosticsPath, `${JSON.stringify({
      backend: backendBase,
      llama_server: llamaBase,
      model: modelPath,
      message: userMessage,
      expected_prompt: expectedPrompt,
      prompt_tokens_match: promptMatch,
      generated_text_match: textMatch,
      backend_prompt_tokens: backendPromptTokens,
      llama_prompt_tokens: baselinePromptTokens,
      backend_generated_tokens: backendGeneratedTokens,
      llama_generated_tokens: llamaGeneratedTokens,
      llama_generated_tokens_from_text: llamaGeneratedTokensFromText,
      llama_top_logprobs: llamaTopLogprobs,
      backend_diagnostic_token_ids: diagnosticTokenIds,
      backend_text: backendText,
      llama_text: llamaText,
      backend_usage: backendChat.usage,
      llama_usage: llamaChat.usage,
      camelid: backendChat.camelid,
    }, null, 2)}\n`)
    console.log(`diagnostics_out=${diagnosticsPath}`)
  }

  if (!promptMatch) {
    console.log(`first_prompt_diff_index=${firstDifference(backendPromptTokens, baselinePromptTokens)}`)
    if (!allowPromptMismatch) process.exitCode = 1
  }
  if (requireGeneratedMatch && !textMatch) {
    process.exitCode = 1
  }
} finally {
  if (child) child.kill('SIGTERM')
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

function compactDenseDiagnostics(dense) {
  if (!dense) return null
  const layers = dense.layers || []
  return {
    embedding: dense.embedding,
    final_hidden: dense.final_hidden,
    final_norm: dense.final_norm,
    output_norm: dense.output_norm,
    logits: dense.logits,
    layers: layers.map(layer => ({
      layer_index: layer.layer_index,
      residual_flow_attention_input_rms: layer.residual_flow?.attention_input?.rms,
      residual_flow_attention_delta_max_abs_delta: layer.residual_flow?.attention_delta?.max_abs_delta,
      residual_flow_ffn_input_rms: layer.residual_flow?.ffn_input?.rms,
      residual_flow_ffn_delta_max_abs_delta: layer.residual_flow?.ffn_delta?.max_abs_delta,
      attention_norm_rms: layer.attention_norm?.rms,
      attention_q_rms: layer.attention_q?.rms,
      attention_q_rope_rms: layer.attention_q_rope?.rms,
      attention_k_rms: layer.attention_k?.rms,
      attention_k_rope_rms: layer.attention_k_rope?.rms,
      attention_output_rms: layer.attention_output?.rms,
      attention_residual_rms: layer.attention_residual?.rms,
      ffn_norm_rms: layer.ffn_norm?.rms,
      ffn_gate_rms: layer.ffn_gate?.rms,
      ffn_up_rms: layer.ffn_up?.rms,
      ffn_activation_rms: layer.ffn_activation?.rms,
      ffn_output_rms: layer.ffn_output?.rms,
      ffn_residual_rms: layer.ffn_residual?.rms,
    })),
  }
}

function firstDifference(left, right) {
  const max = Math.max(left.length, right.length)
  for (let i = 0; i < max; i += 1) {
    if (left[i] !== right[i]) return i
  }
  return -1
}

function uniqueTokenIds(values) {
  const out = []
  const seen = new Set()
  for (const value of values) {
    const token = Number.isInteger(value) ? value : Number.parseInt(value, 10)
    if (!Number.isInteger(token) || token < 0 || seen.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out
}

function firstStringDifference(left, right) {
  const leftChars = Array.from(left)
  const rightChars = Array.from(right)
  return firstDifference(leftChars, rightChars)
}
