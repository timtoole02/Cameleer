#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const argv = process.argv.slice(2)
const relayArgs = [...argv]
if (!hasFlag(argv, 'render-mode')) relayArgs.push('--render-mode', 'mistral_instruct')
if (!hasFlag(argv, 'model') && process.env.MISTRAL_GGUF) relayArgs.push('--model', process.env.MISTRAL_GGUF)
if (!hasFlag(argv, 'model-id') && process.env.MISTRAL_MODEL_ID) relayArgs.push('--model-id', process.env.MISTRAL_MODEL_ID)
if (!hasFlag(argv, 'llama-url') && process.env.MISTRAL_LLAMA_SERVER_URL) relayArgs.push('--llama-url', process.env.MISTRAL_LLAMA_SERVER_URL)
if (!hasFlag(argv, 'llama-server') && process.env.MISTRAL_LLAMA_SERVER) relayArgs.push('--llama-server', process.env.MISTRAL_LLAMA_SERVER)
if (!hasFlag(argv, 'llama-tokenize') && process.env.MISTRAL_LLAMA_TOKENIZE) relayArgs.push('--llama-tokenize', process.env.MISTRAL_LLAMA_TOKENIZE)
if (!hasFlag(argv, 'messages-json') && process.env.MISTRAL_CHAT_MESSAGES_JSON) relayArgs.push('--messages-json', process.env.MISTRAL_CHAT_MESSAGES_JSON)
if (!hasFlag(argv, 'message') && process.env.MISTRAL_CHAT_MESSAGE) relayArgs.push('--message', process.env.MISTRAL_CHAT_MESSAGE)
if (!hasFlag(argv, 'max-tokens') && process.env.MISTRAL_CHAT_MAX_TOKENS) relayArgs.push('--max-tokens', process.env.MISTRAL_CHAT_MAX_TOKENS)
if (!hasFlag(argv, 'diagnostics-out') && process.env.MISTRAL_CHAT_DIAGNOSTICS_OUT) relayArgs.push('--diagnostics-out', process.env.MISTRAL_CHAT_DIAGNOSTICS_OUT)
if (!hasFlag(argv, 'llama-context') && process.env.MISTRAL_LLAMA_CONTEXT) relayArgs.push('--llama-context', process.env.MISTRAL_LLAMA_CONTEXT)
if (!hasFlag(argv, 'wait-ms') && process.env.MISTRAL_WAIT_MS) relayArgs.push('--wait-ms', process.env.MISTRAL_WAIT_MS)

const child = spawn(process.execPath, [resolve('scripts/chat-parity-llama3.mjs'), ...relayArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    LLAMA3_GGUF: process.env.LLAMA3_GGUF || process.env.MISTRAL_GGUF,
    LLAMA3_MODEL_ID: process.env.LLAMA3_MODEL_ID || process.env.MISTRAL_MODEL_ID,
    LLAMA3_LLAMA_SERVER_URL: process.env.LLAMA3_LLAMA_SERVER_URL || process.env.MISTRAL_LLAMA_SERVER_URL,
    LLAMA3_LLAMA_SERVER: process.env.LLAMA3_LLAMA_SERVER || process.env.MISTRAL_LLAMA_SERVER,
    LLAMA3_LLAMA_TOKENIZE: process.env.LLAMA3_LLAMA_TOKENIZE || process.env.MISTRAL_LLAMA_TOKENIZE,
    LLAMA3_CHAT_MESSAGES_JSON: process.env.LLAMA3_CHAT_MESSAGES_JSON || process.env.MISTRAL_CHAT_MESSAGES_JSON,
    LLAMA3_CHAT_MESSAGE: process.env.LLAMA3_CHAT_MESSAGE || process.env.MISTRAL_CHAT_MESSAGE,
    LLAMA3_CHAT_MAX_TOKENS: process.env.LLAMA3_CHAT_MAX_TOKENS || process.env.MISTRAL_CHAT_MAX_TOKENS,
    LLAMA3_CHAT_DIAGNOSTICS_OUT: process.env.LLAMA3_CHAT_DIAGNOSTICS_OUT || process.env.MISTRAL_CHAT_DIAGNOSTICS_OUT,
    LLAMA3_LLAMA_CONTEXT: process.env.LLAMA3_LLAMA_CONTEXT || process.env.MISTRAL_LLAMA_CONTEXT,
    LLAMA3_WAIT_MS: process.env.LLAMA3_WAIT_MS || process.env.MISTRAL_WAIT_MS,
  },
})

child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
child.once('error', (err) => {
  console.error(err)
  process.exit(1)
})

function hasFlag(args, flag) {
  return args.some((arg) => arg === `--${flag}` || arg.startsWith(`--${flag}=`))
}
