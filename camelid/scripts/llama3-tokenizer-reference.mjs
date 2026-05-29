#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const modelPath = resolve(args.get('model') || process.env.LLAMA3_GGUF || '$CAMELID_MODEL_DIR/Meta-Llama-3-8B-Instruct-Q8_0.gguf')
const llamaTokenizeBin = resolve(args.get('llama-tokenize') || process.env.LLAMA3_LLAMA_TOKENIZE || 'target/reference/llama.cpp/build/bin/llama-tokenize')
const out = args.get('out')

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

const encodedCases = {}
for (const testCase of cases) {
  const tokens = await tokenizeWithLlamaCpp(testCase)
  encodedCases[testCase.name] = {
    text: testCase.text,
    add_special: testCase.add_special,
    parse_special: testCase.parse_special,
    tokens,
  }
}

const report = {
  reference: {
    tool: 'llama.cpp llama-tokenize --ids',
    binary: llamaTokenizeBin,
    model: modelPath,
    generated_at_utc: new Date().toISOString(),
  },
  cases: encodedCases,
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

async function tokenizeWithLlamaCpp(testCase) {
  const llamaArgs = [
    '-m', modelPath,
    '--ids',
    '--log-disable',
    '-p', testCase.text,
  ]
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
      if (code === 0) {
        resolvePromise({ stdout, stderr })
      } else {
        reject(new Error(`${command} exited ${code}: ${stderr || stdout}`))
      }
    })
  })
}
