#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const scriptDir = dirname(fileURLToPath(import.meta.url))
const reportScript = join(scriptDir, 'edge-prompt-gate-report.mjs')
const repoRoot = resolve(scriptDir, '..')
const tempDir = await mkdtemp(join(tmpdir(), 'camelid-edge-prompt-gate-'))

try {
  const mixedDir = join(tempDir, 'mixed-stop')
  await mkdir(mixedDir, { recursive: true })
  await writeFile(join(mixedDir, 'summary.json'), `${JSON.stringify({
    phase7_complete_gate: true,
    rows: [
      exactSummaryRow('short', 50, 50),
      exactSummaryRow('multiline', 41, 41),
    ],
  }, null, 2)}\n`)
  await writeFile(join(mixedDir, 'multiline-long.json'), `${JSON.stringify({
    backend_prompt_tokens: [1, 2, 3],
    llama_prompt_tokens: [1, 2, 3],
    backend_generated_tokens: [29907, 13946],
    llama_generated_tokens: [29907, 13946],
    backend_text: 'Certainly',
    llama_text: 'Certainly',
  }, null, 2)}\n`)

  const mixedOut = join(mixedDir, 'gate-report.json')
  const { stdout: mixedStdout } = await execFileAsync(process.execPath, [
    reportScript,
    '--artifact-dir', mixedDir,
    '--out', mixedOut,
    '--fixed-length', '50',
  ], { cwd: repoRoot })
  assert.match(mixedStdout, /prompt_alignment_gate=true/)
  assert.match(mixedStdout, /exact_match_until_stop_gate=true/)
  assert.match(mixedStdout, /fixed_length_gate=false/)
  assert.match(mixedStdout, /matched prompts and generation until both engines stopped; multiline stopped before 50 tokens/)
  assert.match(mixedStdout, /extra_case=multiline-long prompt_tokens_match=true generated_tokens_match=true first_divergent_generated_token_index=-1/)

  const mixedReport = JSON.parse(await readFileUtf8(mixedOut))
  assert.equal(mixedReport.rows[1].stop_reason, 'matched_until_stop_before_50')
  assert.equal(mixedReport.fixed_length_gate, false)
  assert.equal(mixedReport.exact_match_until_stop_gate, true)
  assert.equal(mixedReport.extra_cases[0].prompt_tokens_match, true)
  assert.equal(mixedReport.extra_cases[0].generated_tokens_match, true)

  const divergentDir = join(tempDir, 'divergent')
  await mkdir(divergentDir, { recursive: true })
  await writeFile(join(divergentDir, 'summary.json'), `${JSON.stringify({
    phase7_complete_gate: false,
    rows: [
      exactSummaryRow('short', 50, 50),
      {
        label: 'special-chars',
        prompt_tokens_match: true,
        first_prompt_diff_index: -1,
        generated_text_match: false,
        first_divergent_generated_token_index: 2,
        backend_tokens: 50,
        llama_tokens: 50,
      },
    ],
  }, null, 2)}\n`)

  const { stdout: divergentStdout } = await execFileAsync(process.execPath, [
    reportScript,
    '--artifact-dir', divergentDir,
    '--extra-cases', '',
  ], { cwd: repoRoot })
  assert.match(divergentStdout, /prompt_alignment_gate=true/)
  assert.match(divergentStdout, /exact_match_until_stop_gate=false/)
  assert.match(divergentStdout, /fixed_length_gate=false/)
  assert.match(divergentStdout, /One or more cases diverged before stop\./)

  console.log('edge-prompt-gate-report self-test passed')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

async function readFileUtf8(path) {
  return readFile(path, 'utf8')
}

function exactSummaryRow(label, backendTokens, llamaTokens) {
  return {
    label,
    prompt_tokens_match: true,
    first_prompt_diff_index: -1,
    generated_text_match: true,
    first_divergent_generated_token_index: -1,
    backend_tokens: backendTokens,
    llama_tokens: llamaTokens,
  }
}
