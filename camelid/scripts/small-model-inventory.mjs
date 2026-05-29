#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const manifestPath = resolve(args.get('manifest')?.at(-1) || 'SMALL_MODEL_CANDIDATES.json')
const maxDepth = Number.parseInt(args.get('max-depth')?.at(-1) || '5', 10)
const includeSha256 = args.has('sha256')
const outPath = args.get('out')?.at(-1) ? resolve(args.get('out').at(-1)) : null
const markdownOutPath = args.get('markdown-out')?.at(-1) ? resolve(args.get('markdown-out').at(-1)) : null

if (!Number.isInteger(maxDepth) || maxDepth < 0) {
  throw new Error(`--max-depth must be a non-negative integer, got ${args.get('max-depth')?.at(-1)}`)
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const manifestCandidates = manifest.candidate_order || []
const manifestByPath = new Map()
for (const candidate of manifestCandidates) {
  manifestByPath.set(resolve(candidate.path), candidate)
}

const requestedRoots = args.get('root') || []
const defaultRoots = [
  'models',
  process.env.CAMELID_MODEL_DIR || 'models',
  ...manifestCandidates.map(candidate => dirname(candidate.path)),
]
const rootInputs = requestedRoots.length > 0 ? requestedRoots : defaultRoots
const rootRows = []
const seenRoots = new Set()
for (const input of rootInputs) {
  const root = resolve(input)
  if (seenRoots.has(root)) continue
  seenRoots.add(root)
  try {
    const rootStat = await stat(root)
    if (rootStat.isDirectory()) {
      rootRows.push({ root, present: true })
    } else {
      rootRows.push({ root, present: false, note: 'not a directory' })
    }
  } catch (err) {
    rootRows.push({ root, present: false, note: err.code || err.message })
  }
}

const discovered = []
const seenFiles = new Set()
for (const root of rootRows.filter(row => row.present).map(row => row.root)) {
  await walk(root, 0, async file => {
    if (extname(file).toLowerCase() !== '.gguf') return
    if (seenFiles.has(file)) return
    seenFiles.add(file)
    const fileStat = await stat(file)
    const manifestCandidate = manifestByPath.get(file) || null
    const hints = classifyGgufPath(file, fileStat.size)
    discovered.push({
      path: file,
      file_size_bytes: fileStat.size,
      file_size_mib: bytesToMiB(fileStat.size),
      file_size_gib: bytesToGiB(fileStat.size),
      manifest_model_id: manifestCandidate?.model_id || null,
      in_manifest: Boolean(manifestCandidate),
      family_hint: hints.family,
      tokenizer_hint: hints.tokenizer,
      quant_hint: hints.quant,
      size_class: hints.sizeClass,
      safe_next_step: nextStep(file, manifestCandidate, hints),
      sha256: includeSha256 ? await sha256File(file) : undefined,
    })
  })
}

discovered.sort((a, b) => a.file_size_bytes - b.file_size_bytes || a.path.localeCompare(b.path))

const manifestRows = manifestCandidates.map(candidate => {
  const candidatePath = resolve(candidate.path)
  const found = discovered.find(row => row.path === candidatePath)
  return {
    model_id: candidate.model_id,
    path: candidate.path,
    resolved_path: candidatePath,
    present: Boolean(found),
    file_size_bytes: found?.file_size_bytes ?? null,
    quant: candidate.quant,
    tokenizer: candidate.tokenizer,
    chat_template: candidate.chat_template,
    expected_support_row: candidate.expected_support_row,
    load_harness: candidate.load_harness,
    parity_harness: candidate.parity_harness,
  }
})

const report = {
  schema: 'camelid.small-model-inventory-report.v1',
  generated_at: new Date().toISOString(),
  manifest: manifestPath,
  max_depth: maxDepth,
  roots: rootRows,
  summary: {
    discovered_gguf_count: discovered.length,
    manifest_candidate_count: manifestRows.length,
    present_manifest_candidate_count: manifestRows.filter(row => row.present).length,
    unmanifested_gguf_count: discovered.filter(row => !row.in_manifest).length,
    small_or_medium_gguf_count: discovered.filter(row => row.size_class !== 'large').length,
    large_gguf_count: discovered.filter(row => row.size_class === 'large').length,
  },
  manifest_candidates: manifestRows,
  discovered_ggufs: discovered,
}

if (outPath) {
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`)
}
if (markdownOutPath) {
  await mkdir(dirname(markdownOutPath), { recursive: true })
  await writeFile(markdownOutPath, renderMarkdown(report))
}
console.log(JSON.stringify(report, null, 2))

async function walk(directory, depth, onFile) {
  if (depth > maxDepth) return
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (err) {
    return
  }
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'target' || entry.name === 'node_modules') continue
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      await walk(path, depth + 1, onFile)
    } else if (entry.isFile()) {
      await onFile(path)
    }
  }
}

function classifyGgufPath(path, bytes) {
  const lower = path.toLowerCase()
  const quantMatch = path.match(/\b((?:Q\d(?:_\d)?|Q\d_K_[SLM]|IQ\d_[A-Z]+|F16|BF16|F32))\b/i)
  const family = lower.includes('tinyllama')
    ? 'tinyllama/llama-spm'
    : lower.includes('llama-3') || lower.includes('llama3')
      ? 'llama-3/llama-bpe'
      : lower.includes('llama')
        ? 'llama-like'
        : lower.includes('mistral')
          ? 'mistral-like'
          : 'unknown'
  const tokenizer = family === 'tinyllama/llama-spm'
    ? 'llama-spm'
    : family === 'llama-3/llama-bpe'
      ? 'llama-bpe'
      : 'unknown-until-readiness-inspect'
  const sizeClass = bytes > 4 * 1024 ** 3 ? 'large' : bytes > 2 * 1024 ** 3 ? 'medium' : 'small'
  return { family, tokenizer, quant: quantMatch?.[1]?.toUpperCase() || 'unknown', sizeClass }
}

function nextStep(path, manifestCandidate, hints) {
  if (manifestCandidate) {
    return 'run scripts/small-model-readiness.mjs, then only run the named parity harness if readiness is load_and_generation_candidate'
  }
  if (hints.sizeClass === 'large') {
    return 'do not run generation by default; add a manifest metadata/load-only row and require lazy-Q8 or higher-RAM evidence first'
  }
  if (hints.family.includes('llama')) {
    return 'add a SMALL_MODEL_CANDIDATES.json row, run readiness, then bind to TinyLlama or compact Llama 3 parity harness only if tokenizer/template matches'
  }
  return 'add manifest row only after tokenizer/template/runtime support is explicit; no inherited support from filename'
}

async function sha256File(path) {
  const hash = createHash('sha256')
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path)
    stream.on('data', chunk => hash.update(chunk))
    stream.once('error', reject)
    stream.once('end', resolvePromise)
  })
  return hash.digest('hex')
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# Small-Model Inventory Report')
  lines.push('')
  lines.push(`Generated: ${report.generated_at}`)
  lines.push(`Manifest: ${report.manifest}`)
  lines.push(`Summary: ${report.summary.discovered_gguf_count} GGUF(s), ${report.summary.present_manifest_candidate_count}/${report.summary.manifest_candidate_count} manifest candidates present, ${report.summary.unmanifested_gguf_count} unmanifested GGUF(s).`)
  lines.push('')
  lines.push('## Roots')
  lines.push('')
  lines.push('| Root | Present | Note |')
  lines.push('| --- | --- | --- |')
  for (const root of report.roots) {
    lines.push(`| ${escapePipe(root.root)} | ${root.present ? 'yes' : 'no'} | ${escapePipe(root.note || '')} |`)
  }
  lines.push('')
  lines.push('## Discovered GGUFs')
  lines.push('')
  lines.push('| Path | Size | Manifest row | Family/tokenizer hint | Quant hint | Safe next step |')
  lines.push('| --- | ---: | --- | --- | --- | --- |')
  for (const row of report.discovered_ggufs) {
    lines.push(`| ${escapePipe(row.path)} | ${row.file_size_mib} MiB | ${escapePipe(row.manifest_model_id || 'not in manifest')} | ${escapePipe(`${row.family_hint}; ${row.tokenizer_hint}`)} | ${escapePipe(row.quant_hint)} | ${escapePipe(row.safe_next_step)} |`)
  }
  lines.push('')
  lines.push('Inventory is a local file discovery aid only. Run `scripts/small-model-readiness.mjs` for metadata/config binding, tokenizer/template choice, materialization-budget decision, load/generation readiness, and parity-harness selection before loading or generating.')
  return `${lines.join('\n')}\n`
}

function parseArgs(argv) {
  const parsed = new Map()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const [key, inline] = arg.slice(2).split('=', 2)
    const next = argv[i + 1]
    const value = inline ?? (next && !next.startsWith('--') ? argv[++i] : 'true')
    const values = parsed.get(key) || []
    values.push(value)
    parsed.set(key, values)
  }
  return parsed
}

function bytesToMiB(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

function bytesToGiB(bytes) {
  return Math.round((bytes / 1024 / 1024 / 1024) * 100) / 100
}

function escapePipe(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
}
