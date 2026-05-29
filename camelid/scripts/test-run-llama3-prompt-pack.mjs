#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const requestedRoot = process.env.CAMELID_PARITY_TEST_ROOT ? resolve(process.env.CAMELID_PARITY_TEST_ROOT) : null
const tempRoot = requestedRoot ?? mkdtempSync(join(tmpdir(), 'camelid-pack-test-'))
const outDir = join(tempRoot, 'out')
const packPath = join(tempRoot, 'pack.json')
const stubPath = join(tempRoot, 'stub-chat-parity.mjs')
const modelPath = join(tempRoot, 'model.gguf')
mkdirSync(tempRoot, { recursive: true })
mkdirSync(outDir, { recursive: true })
writeFileSync(modelPath, '')

writeFileSync(stubPath, `#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const diagnosticsOut = resolve(args.get('diagnostics-out'))
const messagesJson = args.get('messages-json')
const prompt = messagesJson ? JSON.parse(readFileSync(resolve(messagesJson), 'utf8')) : null
mkdirSync(dirname(diagnosticsOut), { recursive: true })
writeFileSync(diagnosticsOut, JSON.stringify({
  prompt_tokens_match: true,
  generated_tokens_match: true,
  generated_text_match: true,
  reference_prompt_token_count: prompt?.messages?.length ?? 1,
  reference_context: args.get('llama-context') ? Number.parseInt(args.get('llama-context'), 10) : null,
  stub_args: Object.fromEntries(args.entries()),
  prompt,
}, null, 2) + "\\n")

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
`)

writeFileSync(packPath, JSON.stringify({
  schema: 'camelid.llama3.prompt-pack.v1',
  pack_id: 'runner-test-pack',
  target_context_window: 512,
  defaults: {
    max_tokens: 5,
    render_mode: 'compact',
  },
  prompts: [
    {
      id: 'messages-shape',
      messages: [
        { role: 'system', content: 'Stay brief.' },
        { role: 'user', content: 'Say blue.' },
      ],
    },
    {
      id: 'single-message',
      message: 'hello',
      max_tokens: 7,
      target_context_window: 640,
    },
  ],
}, null, 2) + '\n')

const command = [
  process.execPath,
  join(repoRoot, 'scripts/run-llama3-prompt-pack.mjs'),
  '--chat-parity-script', stubPath,
  '--backend', 'http://127.0.0.1:8181',
  '--llama-url', 'http://127.0.0.1:8183',
  '--pack', packPath,
  '--out-dir', outDir,
  '--model', modelPath,
  '--model-id', 'runner-test-model',
  '--backend-dense-diagnostics',
]
const run = spawnSync(command[0], command.slice(1), {
  cwd: repoRoot,
  encoding: 'utf8',
})
assert.equal(run.status, 0, run.stderr || run.stdout)
assert.match(run.stdout, /summary_json=/)

const summary = JSON.parse(readFileSync(join(outDir, 'summary.json'), 'utf8'))
assert.equal(summary.chat_parity_script, resolve(stubPath))
assert.equal(summary.pack.id, 'runner-test-pack')
assert.equal(summary.prompt_tokens_all_match, true)
assert.equal(summary.generated_tokens_all_match, true)
assert.equal(summary.llama_flash_attn, 'off')
assert.equal(summary.prompts.length, 2)
assert.equal(summary.prompts[0].target_context_window, 512)
assert.equal(summary.prompts[0].reference_context, 512)
assert.equal(summary.prompts[1].target_context_window, 640)
assert.equal(summary.prompts[1].reference_context, 640)

const firstReport = JSON.parse(readFileSync(summary.prompts[0].report_path, 'utf8'))
assert.equal(firstReport.stub_args['render-mode'], 'compact')
assert.equal(firstReport.stub_args['llama-context'], '512')
assert.equal(firstReport.stub_args['llama-flash-attn'], 'off')
assert.equal(firstReport.stub_args['backend-dense-diagnostics'], 'true')
assert.ok(firstReport.stub_args['messages-json'])
assert.equal(firstReport.prompt.messages[0].role, 'system')

const secondReport = JSON.parse(readFileSync(summary.prompts[1].report_path, 'utf8'))
assert.equal(secondReport.stub_args['message'], 'hello')
assert.equal(secondReport.stub_args['max-tokens'], '7')
assert.equal(secondReport.stub_args['llama-context'], '640')

console.log('run-llama3-prompt-pack self-test passed')
