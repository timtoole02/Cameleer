#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const modelPath = resolve(args.get('model') || process.env.MISTRAL_GGUF || '$CAMELID_MODEL_DIR/mistral-7b-instruct-v0.3-q8_0.gguf')
const llamaTokenizeBin = resolve(args.get('llama-tokenize') || process.env.MISTRAL_LLAMA_TOKENIZE || 'target/reference/llama.cpp/build/bin/llama-tokenize')
const out = args.get('out')

const promptCases = [
  {
    id: 'single_user_turn',
    messages: [{ role: 'user', content: 'Hello' }],
  },
  {
    id: 'system_and_user_turn',
    messages: [
      { role: 'system', content: ' Be brief. ' },
      { role: 'user', content: ' Hello there. ' },
    ],
  },
  {
    id: 'assistant_turn_then_next_user',
    messages: [
      { role: 'user', content: 'Complete cam' },
      { role: 'assistant', content: ' elid ' },
      { role: 'user', content: 'Now say hi' },
    ],
  },
]

const encodedPromptCases = []
for (const testCase of promptCases) {
  const renderedPrompt = renderMistralInstructPrompt(testCase.messages)
  const expectedTokens = await tokenizeWithLlamaCpp({
    text: renderedPrompt,
    add_special: false,
    parse_special: true,
  })
  encodedPromptCases.push({
    id: testCase.id,
    messages: testCase.messages,
    rendered_prompt: renderedPrompt,
    add_special: false,
    parse_special: true,
    expected_tokens: expectedTokens,
  })
}

const helloTokens = await tokenizeWithLlamaCpp({
  text: 'hello',
  add_special: true,
  parse_special: false,
})

const report = {
  target_row: 'mistral_7b_instruct_v0_3_q8_0',
  model_name: 'Mistral-7B-Instruct-v0.3',
  quantization: 'Q8_0',
  status: 'reference_capture',
  notes: 'Tokenizer/chat-template reference pack generated from llama.cpp llama-tokenize for the exact chosen GGUF row. Do not promote support from this file alone.',
  reference: {
    tool: 'llama.cpp llama-tokenize --ids',
    binary: '<llama.cpp>/llama-tokenize',
    model: 'Mistral-7B-Instruct-v0.3-Q8_0.gguf',
    local_paths_redacted: true,
    generated_at_utc: new Date().toISOString(),
  },
  expected_artifacts: {
    gguf_sha256: 'capture separately with sha256sum on the exact GGUF file',
    tokenizer_fixture_id: 'mistral-instruct-v0.3-tokenizer-v1',
    chat_template_fixture_id: 'mistral-instruct-v0.3-chat-template-pack-v1',
    prompt_token_reference_source: 'llama.cpp llama-tokenize --ids',
    prompt_cases: [
      {
        id: 'hello',
        text: 'hello',
        add_special: true,
        parse_special: false,
        expected_tokens: helloTokens,
      },
      ...encodedPromptCases,
    ],
  },
}

const json = `${JSON.stringify(report, null, 2)}\n`
console.log(json)
if (out) await writeFile(resolve(out), json)

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

function renderMistralInstructPrompt(messages) {
  const normalized = messages
    .map(message => ({ role: message.role, content: normalize(message.content) }))
    .filter(message => message.content.length > 0)

  const systemPreamble = []
  while (normalized[0]?.role === 'system') systemPreamble.push(normalized.shift().content)
  const systemText = systemPreamble.join('\n\n').trim()

  let prompt = ''
  let pendingSystem = systemText
  for (const message of normalized) {
    if (message.role === 'user') {
      const body = pendingSystem ? `${pendingSystem}\n\n${message.content}` : message.content
      prompt += `<s>[INST] ${body} [/INST]`
      pendingSystem = ''
    } else if (message.role === 'assistant') {
      prompt += ` ${message.content}</s>`
    }
  }

  if (!prompt && pendingSystem) prompt = `<s>[INST] ${pendingSystem} [/INST]`
  return prompt
}

function normalize(text) {
  return String(text).trim()
}

async function tokenizeWithLlamaCpp(testCase) {
  const llamaArgs = ['-m', modelPath, '--ids', '--log-disable', '-p', testCase.text]
  if (!testCase.add_special) llamaArgs.push('--no-bos')
  if (!testCase.parse_special) llamaArgs.push('--no-parse-special')
  const { stdout } = await run(llamaTokenizeBin, llamaArgs)
  return JSON.parse(stdout.trim())
}

async function run(command, commandArgs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) resolvePromise({ stdout, stderr })
      else reject(new Error(`${command} exited ${code}: ${stderr || stdout}`))
    })
  })
}
