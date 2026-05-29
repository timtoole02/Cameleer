#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inline] = arg.slice(2).split('=', 2)
  const value = inline ?? (process.argv[i + 1]?.startsWith('--') ? 'true' : process.argv[++i] ?? 'true')
  args.set(key, value)
}

const artifactDir = resolve(args.get('artifact-dir') || args.get('dir') || 'target/edge-prompt-audit-fixed-20260428T1530')
const summaryPath = resolve(args.get('summary') || join(artifactDir, 'summary.json'))
const outPath = args.get('out') ? resolve(args.get('out')) : join(artifactDir, 'gate-report.json')
const fixedLength = Number.parseInt(args.get('fixed-length') || '50', 10)
const extraCases = (args.get('extra-cases') || 'multiline-long')
  .split(',')
  .map(label => label.trim())
  .filter(Boolean)

if (!Number.isInteger(fixedLength) || fixedLength < 1) {
  throw new Error(`--fixed-length must be a positive integer, got ${args.get('fixed-length')}`)
}

const summary = await readJson(summaryPath)
const rows = summary.rows || []
const caseReports = []
for (const row of rows) {
  const label = row.label || 'unknown'
  const exactMatch = row.prompt_tokens_match === true
    && row.first_prompt_diff_index === -1
    && row.generated_text_match === true
    && row.first_divergent_generated_token_index === -1
  const fixedLengthMatch = exactMatch
    && row.backend_tokens === fixedLength
    && row.llama_tokens === fixedLength
  caseReports.push({
    label,
    prompt_alignment_gate: row.prompt_tokens_match === true && row.first_prompt_diff_index === -1,
    exact_match_until_stop_gate: exactMatch,
    fixed_length_gate: fixedLengthMatch,
    backend_tokens: row.backend_tokens,
    llama_tokens: row.llama_tokens,
    stop_reason: fixedLengthMatch
      ? 'fixed_length_reached'
      : exactMatch
        ? `matched_until_stop_before_${fixedLength}`
        : 'diverged',
    first_prompt_diff_index: row.first_prompt_diff_index,
    first_divergent_generated_token_index: row.first_divergent_generated_token_index,
  })
}

const extraReports = []
for (const label of extraCases) {
  const path = join(artifactDir, `${label}.json`)
  try {
    const data = await readJson(path)
    const backendGenerated = data.backend_generated_tokens || []
    const llamaGenerated = data.llama_generated_tokens || data.llama_generated_tokens_from_text || []
    const backendPrompt = data.backend_prompt_tokens || []
    const llamaPrompt = data.llama_prompt_tokens || []
    extraReports.push({
      label,
      prompt_tokens_match: arraysEqual(backendPrompt, llamaPrompt),
      first_prompt_diff_index: firstDifference(backendPrompt, llamaPrompt),
      generated_tokens_match: arraysEqual(backendGenerated, llamaGenerated),
      first_divergent_generated_token_index: firstDifference(backendGenerated, llamaGenerated),
      backend_tokens: backendGenerated.length,
      llama_tokens: llamaGenerated.length,
      backend_first_tokens: backendGenerated.slice(0, 12),
      llama_first_tokens: llamaGenerated.slice(0, 12),
      backend_text_preview: preview(data.backend_text),
      llama_text_preview: preview(data.llama_text),
    })
  } catch (err) {
    extraReports.push({ label, error: err.message })
  }
}

const promptAlignmentGate = caseReports.every(row => row.prompt_alignment_gate)
const exactMatchUntilStopGate = caseReports.every(row => row.exact_match_until_stop_gate)
const fixedLengthGate = caseReports.every(row => row.fixed_length_gate)
const stoppedBeforeFixedLength = caseReports.filter(row => row.exact_match_until_stop_gate && !row.fixed_length_gate)

const report = {
  object: 'camelid.edge_prompt_gate_report.v1',
  artifact_dir: artifactDir,
  source_summary: summaryPath,
  fixed_length: fixedLength,
  prompt_alignment_gate: promptAlignmentGate,
  exact_match_until_stop_gate: exactMatchUntilStopGate,
  fixed_length_gate: fixedLengthGate,
  legacy_phase7_complete_gate: summary.phase7_complete_gate ?? null,
  gate_explanation: fixedLengthGate
    ? `All cases matched prompts and generated exactly ${fixedLength} tokens.`
    : exactMatchUntilStopGate
      ? `All cases matched prompts and generation until both engines stopped; ${stoppedBeforeFixedLength.map(row => row.label).join(', ')} stopped before ${fixedLength} tokens on both engines.`
      : 'One or more cases diverged before stop.',
  rows: caseReports,
  extra_cases: extraReports,
}

await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`)

console.log(`gate_report=${outPath}`)
console.log(`prompt_alignment_gate=${report.prompt_alignment_gate}`)
console.log(`exact_match_until_stop_gate=${report.exact_match_until_stop_gate}`)
console.log(`fixed_length_gate=${report.fixed_length_gate}`)
console.log(`gate_explanation=${report.gate_explanation}`)
for (const extra of report.extra_cases) {
  if (extra.error) {
    console.log(`extra_case=${extra.label} error=${extra.error}`)
  } else {
    console.log(`extra_case=${extra.label} prompt_tokens_match=${extra.prompt_tokens_match} generated_tokens_match=${extra.generated_tokens_match} first_divergent_generated_token_index=${extra.first_divergent_generated_token_index}`)
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function firstDifference(left, right) {
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    if (left[i] !== right[i]) return i
  }
  return -1
}

function preview(value, max = 180) {
  const text = String(value || '')
  return text.length > max ? `${text.slice(0, max)}…` : text
}
