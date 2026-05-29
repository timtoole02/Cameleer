#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const DEFAULT_TENSORS = [
  { name: 'blk.0.ffn_down.weight', swapRank2Shape: false },
  { name: 'blk.0.ffn_gate.weight', swapRank2Shape: true },
  { name: 'output.weight', swapRank2Shape: true },
]

function parseArgs(argv) {
  const out = {
    model: process.env.LLAMA3_8B_Q8_GGUF || process.env.CAMELID_BENCH_MODEL || '',
    outDir: '',
    repeats: '20',
    warmup: '3',
    skipBuild: false,
    allRowsDot: true,
    singleInputRowDot: true,
    tensors: [],
  }
  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx]
    const next = () => {
      idx += 1
      if (idx >= argv.length) throw new Error(`${arg} requires a value`)
      return argv[idx]
    }
    if (arg === '--model') out.model = next()
    else if (arg === '--out-dir') out.outDir = next()
    else if (arg === '--repeats') out.repeats = next()
    else if (arg === '--warmup') out.warmup = next()
    else if (arg === '--skip-build') out.skipBuild = true
    else if (arg === '--no-all-rows-dot') out.allRowsDot = false
    else if (arg === '--no-single-input-row-dot') out.singleInputRowDot = false
    else if (arg === '--tensor') out.tensors.push(parseTensor(next()))
    else if (arg === '--help' || arg === '-h') usage(0)
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (!out.model) throw new Error('missing --model (or LLAMA3_8B_Q8_GGUF/CAMELID_BENCH_MODEL)')
  if (!Number.isInteger(Number(out.repeats)) || Number(out.repeats) <= 0) {
    throw new Error('--repeats must be a positive integer')
  }
  if (!Number.isInteger(Number(out.warmup)) || Number(out.warmup) < 0) {
    throw new Error('--warmup must be a non-negative integer')
  }
  if (out.tensors.length === 0) out.tensors = DEFAULT_TENSORS
  return out
}

function parseTensor(value) {
  const [name, modifier] = value.split(':')
  if (!name) throw new Error('--tensor requires a tensor name')
  return { name, swapRank2Shape: modifier === 'swap' || modifier === 'swap-rank2-shape' }
}

function usage(code) {
  console.log(`Usage: node scripts/bench-q8-hotpath-bundle.mjs --model <model.gguf> [options]

Builds a sanitized lazy-Q8 hot-path measurement bundle under target/ by running
camelid bench-q8-blocks for representative Q8_0 tensors.

Options:
  --out-dir <dir>                  Output directory (default target/lazy-q8-hotpath-bundle-...)
  --repeats <n>                    Measured iterations per tensor (default 20)
  --warmup <n>                     Warmup iterations per tensor (default 3)
  --skip-build                     Reuse target/release/camelid
  --tensor <name[:swap]>           Override tensor list; repeatable. Use :swap for swapped rank-2 layout.
  --no-all-rows-dot                Do not run all-row dot timing
  --no-single-input-row-dot        Do not run single-input-row adapter timing
`)
  process.exit(code)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
    }
    process.exit(result.status ?? 1)
  }
  return result
}

function git(args, fallback = '') {
  const result = spawnSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  return result.status === 0 ? result.stdout.trim() : fallback
}

async function sha256(path) {
  const hash = createHash('sha256')
  await new Promise((resolve, reject) => {
    createReadStream(path).on('data', chunk => hash.update(chunk)).on('error', reject).on('end', resolve)
  })
  return hash.digest('hex')
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function commandForTensor(binary, model, tensor, options) {
  const args = [
    'bench-q8-blocks',
    model,
    '--tensor',
    tensor.name,
    '--repeats',
    options.repeats,
    '--warmup',
    options.warmup,
  ]
  if (tensor.swapRank2Shape) args.push('--swap-rank2-shape')
  if (options.allRowsDot) args.push('--all-rows-dot')
  if (options.singleInputRowDot) args.push('--single-input-row-dot')
  return [binary, args]
}

function compactRun(report) {
  return {
    tensor: report.tensor,
    storage_shape: report.storage_shape,
    logical_shape: report.logical_shape,
    swap_rank2_shape: report.swap_rank2_shape,
    tensor_mib: report.tensor_mib,
    retained_q8_payload_mib: report.retained_q8_payload_mib,
    f32_materialized_mib: report.f32_materialized_mib,
    dot_input_f32_mib: report.dot_input_f32_mib,
    all_rows_output_f32_mib: report.all_rows_output_f32_mib,
    single_input_row_output_f32_mib: report.single_input_row_output_f32_mib,
    metadata_load_ms: report.metadata_load_ms,
    block_load_ms: report.block_load_ms,
    avg_dequant_ms: report.avg_dequant_ms,
    avg_dot_ms: report.avg_dot_ms,
    avg_all_rows_dot_ms: report.avg_all_rows_dot_ms,
    avg_single_input_row_dot_ms: report.avg_single_input_row_dot_ms,
    repeats: report.repeats,
    warmup: report.warmup,
    determinism: report.determinism,
  }
}

function interpretation(runs) {
  const ffn = runs.filter(run => run.tensor.includes('ffn_'))
  const output = runs.find(run => run.tensor === 'output.weight')
  return {
    ffn_projection_observation: ffn.length
      ? `Representative FFN retained-block Q8 all-row dots measured ${ffn.map(run => `${run.tensor} ${run.avg_all_rows_dot_ms?.toFixed(2)} ms`).join(', ')} in this serial microbench path.`
      : 'No FFN tensor was included in this bundle.',
    logits_observation: output
      ? `output.weight measured ${output.avg_all_rows_dot_ms?.toFixed(2)} ms for one all-row Q8 dot while avoiding ${output.f32_materialized_mib?.toFixed(1)} MiB of f32 materialization.`
      : 'No output.weight tensor was included in this bundle.',
    known_gap: 'This bundle benchmarks retained Q8_0 blocks, not the production file-backed reader path. Pair it with API/WebUI timing/RSS evidence before making performance-portability claims.',
  }
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err.message)
    usage(1)
  }

  if (!options.skipBuild) run('cargo', ['build', '--release'])

  const head = git(['rev-parse', '--short=12', 'HEAD'], 'unknown')
  const dirty = git(['status', '--short'], '') !== ''
  const generatedUtc = new Date().toISOString()
  const stamp = timestamp()
  const outDir = options.outDir || join('target', `lazy-q8-hotpath-bundle-${stamp}-head-${head}`)
  await fs.mkdir(outDir, { recursive: true })

  const modelSha256 = await sha256(options.model)
  const binary = 'target/release/camelid'
  const reports = []
  const files = []

  for (const tensor of options.tensors) {
    const [command, args] = commandForTensor(binary, options.model, tensor, options)
    console.error(`bench ${tensor.name}${tensor.swapRank2Shape ? ' (swap-rank2-shape)' : ''}`)
    const result = run(command, args, { capture: true })
    const report = JSON.parse(result.stdout)
    report.path = basename(options.model)
    report.command = [command, ...args].map(arg => (arg === options.model ? '<model-path>' : arg))
    const filename = `${tensor.name.replaceAll('.', '_')}${tensor.swapRank2Shape ? '-swap' : ''}.json`
    await fs.writeFile(join(outDir, filename), `${JSON.stringify(report, null, 2)}\n`)
    reports.push(report)
    files.push(filename)
  }

  const runs = reports.map(compactRun)
  const manifest = {
    schema: 'camelid.lazy_q8_hotpath_bundle.v1',
    generated_utc: generatedUtc,
    git_head: head,
    source_tree_dirty: dirty,
    scope: 'Retained-block lazy Q8_0 hot-path microbenchmarks; measurement evidence only.',
    model: {
      file: basename(options.model),
      sha256: modelSha256,
    },
    bench: {
      command: 'target/release/camelid bench-q8-blocks <model-path> --tensor <tensor> [--swap-rank2-shape] --all-rows-dot --single-input-row-dot',
      repeats: Number(options.repeats),
      warmup: Number(options.warmup),
      all_rows_dot: options.allRowsDot,
      single_input_row_dot: options.singleInputRowDot,
      files,
    },
    runs,
    interpretation: interpretation(runs),
    claim_boundary: 'Lazy Q8_0 hot-path cost evidence only for the exact measured model/tensors. No broad Llama-family, full-context, arbitrary-template, neighboring-size, other-quantization, production-throughput, or portability support claim.',
  }
  await fs.writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  const checksumFiles = ['manifest.json', ...files].sort()
  const sums = []
  for (const file of checksumFiles) {
    sums.push(`${await sha256(join(outDir, file))}  ${file}`)
  }
  await fs.writeFile(join(outDir, 'SHA256SUMS'), `${sums.join('\n')}\n`)
  console.log(outDir)
}

main().catch(err => {
  console.error(err.stack || err.message)
  process.exit(1)
})
