#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inline] = arg.slice(2).split('=', 2)
  const value = inline ?? (process.argv[i + 1]?.startsWith('--') ? 'true' : process.argv[++i] ?? 'true')
  args.set(key, value)
}

if (!args.has('diagnostics') || !args.has('tensor-dump')) {
  console.error('usage: node scripts/correlate-prompt-token-rows.mjs --diagnostics <chat-parity.json> --tensor-dump <tensor-dump.json> [--json-out <path>]')
  console.error('expects a tensor dump created with camelid tensor-dump --tensor token_embd.weight --token <prompt-token-id> ...')
  process.exit(2)
}

const diagnosticsPath = resolve(args.get('diagnostics'))
const tensorDumpPath = resolve(args.get('tensor-dump'))
const jsonOut = args.get('json-out')

const diagnostics = JSON.parse(await readFile(diagnosticsPath, 'utf8'))
const tensorDump = JSON.parse(await readFile(tensorDumpPath, 'utf8'))
const promptTokens = diagnostics.backend_prompt_tokens || diagnostics.camelid?.prompt_token_ids || []
if (!Array.isArray(promptTokens) || promptTokens.length === 0) {
  throw new Error(`${diagnosticsPath} does not contain backend prompt token ids`)
}
const embedding = tensorDump.tensors?.find(tensor => tensor.name === 'token_embd.weight')
if (!embedding) throw new Error(`${tensorDumpPath} does not contain token_embd.weight`)
const rows = new Map((embedding.decoded?.logical_token_rows || []).map(row => [row.token_id, row]))

const sequence = promptTokens.map((tokenId, position) => {
  const row = rows.get(tokenId) || null
  return {
    position,
    token_id: tokenId,
    row_start: row?.start ?? null,
    row_len: row?.len ?? null,
    source_layout: row?.source_layout ?? null,
    first_values: row?.first_values ?? null,
    max_abs_window_start: row?.max_abs_window_start ?? null,
    max_abs_window: row?.max_abs_window ?? null,
    q8_0_blocks: row?.q8_0_blocks ?? [],
  }
})
const missing = sequence.filter(item => item.row_start === null).map(item => item.token_id)
const summary = {
  diagnostics: diagnosticsPath,
  tensor_dump: tensorDumpPath,
  prompt_token_count: promptTokens.length,
  unique_prompt_token_count: new Set(promptTokens).size,
  missing_unique_token_rows: [...new Set(missing)].sort((a, b) => a - b),
  sequence,
}

console.log(`diagnostics=${diagnosticsPath}`)
console.log(`tensor_dump=${tensorDumpPath}`)
console.log(`prompt_token_count=${summary.prompt_token_count}`)
console.log(`unique_prompt_token_count=${summary.unique_prompt_token_count}`)
console.log(`missing_unique_token_rows=${JSON.stringify(summary.missing_unique_token_rows)}`)
for (const item of sequence) {
  console.log(`pos=${item.position} token=${item.token_id} row_start=${item.row_start} first_values=${JSON.stringify(item.first_values)}`)
}

if (jsonOut) {
  await writeFile(resolve(jsonOut), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(`json_out=${resolve(jsonOut)}`)
}

if (missing.length > 0) process.exitCode = 1
