#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const scriptDir = dirname(fileURLToPath(import.meta.url))
const checkScript = join(scriptDir, 'check-forward-trace-invariants.mjs')
const tempDir = await mkdtemp(join(tmpdir(), 'camelid-forward-trace-invariants-'))

try {
  const inputPath = join(tempDir, 'trace.json')
  const reportPath = join(tempDir, 'report.json')
  await writeFile(inputPath, `${JSON.stringify(trace(), null, 2)}\n`)

  const { stdout } = await execFileAsync(process.execPath, [
    checkScript,
    '--input', inputPath,
    '--json-out', reportPath,
    '--tolerance', '0.00001',
  ], { cwd: resolve(scriptDir, '..') })
  assert.match(stdout, /schema=camelid\.forward-trace-invariants\.v1/)
  assert.match(stdout, /stage_count=5/)
  assert.match(stdout, /reconstruction_checked=2/)
  assert.match(stdout, /kv_cache_traces_checked=1/)
  assert.match(stdout, /attention_heads_checked=1/)
  assert.match(stdout, /attention_top_probability_positions_checked=2/)
  assert.match(stdout, /output_projection_checked=1/)
  assert.match(stdout, /failure_count=0/)
  assert.match(stdout, /first_failure=none/)

  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  assert.equal(report.schema, 'camelid.forward-trace-invariants.v1')
  assert.equal(report.failure_count, 0)
  assert.equal(report.first_failure, null)
  assert.equal(report.stats_checked, 3)
  assert.equal(report.reconstruction_checked, 2)
  assert.equal(report.kv_cache_traces_checked, 1)
  assert.equal(report.kv_cache_positions_checked, 2)
  assert.equal(report.attention_heads_checked, 1)
  assert.equal(report.attention_positions_checked, 2)
  assert.equal(report.attention_top_probability_positions_checked, 2)
  assert.equal(report.output_projection_checked, 1)

  const bad = trace()
  bad.stages[1].reconstruction.max_abs_delta = 0.02
  bad.stages[3].attention_trace.heads[0].probability_sum = 0.80
  bad.output_projection[0].absolute_delta = 0.50
  const badPath = join(tempDir, 'bad-trace.json')
  const badReportPath = join(tempDir, 'bad-report.json')
  await writeFile(badPath, `${JSON.stringify(bad, null, 2)}\n`)

  let failed = false
  try {
    await execFileAsync(process.execPath, [
      checkScript,
      '--input', badPath,
      '--json-out', badReportPath,
      '--tolerance', '0.00001',
    ], { cwd: resolve(scriptDir, '..') })
  } catch (err) {
    failed = true
    assert.match(err.stdout, /failure_count=3/)
    assert.match(err.stdout, /first_failure=layers\.0\.attention_q\.reconstruction\.max_abs_delta/)
  }
  assert.equal(failed, true)
  const badReport = JSON.parse(await readFile(badReportPath, 'utf8'))
  assert.equal(badReport.failure_count, 3)
  assert.equal(badReport.first_failure.path, 'layers.0.attention_q.reconstruction.max_abs_delta')
  assert.ok(badReport.failures.some(failure => failure.path === 'layers.0.attention_trace.attention_trace.heads[0].probability_sum_delta'))
  assert.ok(badReport.failures.some(failure => failure.path === 'output_projection[0].absolute_delta'))

  const countMismatch = trace()
  countMismatch.stage_count += 1
  const countMismatchPath = join(tempDir, 'count-mismatch.json')
  await writeFile(countMismatchPath, `${JSON.stringify(countMismatch, null, 2)}\n`)
  let countMismatchFailed = false
  try {
    await execFileAsync(process.execPath, [checkScript, '--input', countMismatchPath], { cwd: resolve(scriptDir, '..') })
  } catch (err) {
    countMismatchFailed = true
    assert.match(err.stdout, /stage_count 6 does not match stages length 5/)
  }
  assert.equal(countMismatchFailed, true)

  const badKvTrace = trace()
  badKvTrace.stages[2].kv_cache_trace.key_value_width = 3
  badKvTrace.stages[2].kv_cache_trace.sampled_positions[1].position = 0
  const badKvPath = join(tempDir, 'bad-kv-trace.json')
  await writeFile(badKvPath, `${JSON.stringify(badKvTrace, null, 2)}\n`)
  let badKvFailed = false
  try {
    await execFileAsync(process.execPath, [checkScript, '--input', badKvPath], { cwd: resolve(scriptDir, '..') })
  } catch (err) {
    badKvFailed = true
    assert.match(err.stdout, /failure_count=2/)
    assert.match(err.stdout, /key_value_width: expected kv_head_count \* head_dim/)
  }
  assert.equal(badKvFailed, true)

  const badTopProbability = trace()
  badTopProbability.stages[3].attention_trace.heads[0].top_probability_positions[1].probability = 0.70
  const badTopPath = join(tempDir, 'bad-top-probability.json')
  await writeFile(badTopPath, `${JSON.stringify(badTopProbability, null, 2)}\n`)
  let badTopFailed = false
  try {
    await execFileAsync(process.execPath, [checkScript, '--input', badTopPath], { cwd: resolve(scriptDir, '..') })
  } catch (err) {
    badTopFailed = true
    assert.match(err.stdout, /failure_count=1/)
    assert.match(err.stdout, /top_probability_positions\[1\]\.probability: expected descending probability order/)
  }
  assert.equal(badTopFailed, true)

  console.log('check-forward-trace-invariants self-test passed')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

function trace() {
  return {
    schema: 'camelid.forward-trace.v1',
    source: {
      prompt_tokens_match: true,
      generated_text_match: false,
      selected_token_id: 16301,
      known_good_token_ids: [29907],
    },
    prompt_token_ids: [1, 12199],
    generated_token_ids: [16301],
    dense_metadata: { square_linear_diagnostic_layout: 'transposed' },
    layer_count: 1,
    selected_layers: [0],
    stage_count: 5,
    stages: [
      {
        order: 0,
        path: 'embedding',
        kind: 'tensor_stats',
        stats: stats([0.10, -0.20]),
      },
      {
        order: 1,
        path: 'layers.0.attention_q',
        kind: 'tensor_stats',
        layer_index: 0,
        stats: stats([0.30, -0.40]),
        reconstruction: {
          role: 'attention_q',
          layout: 'transposed',
          input_width: 2,
          output_width: 2,
          reported_max_abs: 0.4,
          reported_max_abs_index: 1,
          max_abs_delta: 0,
          reconstructed_first_values: [0.30, -0.40],
          reported_first_values: [0.30, -0.40],
          reconstructed_reported_max_abs_window: [0.30, -0.40],
          reported_max_abs_window: [0.30, -0.40],
          weight_shape: [2, 2],
        },
      },
      {
        order: 2,
        path: 'layers.0.kv_cache_trace',
        kind: 'kv_cache_trace',
        layer_index: 0,
        kv_cache_trace: kvCacheTrace(),
      },
      {
        order: 3,
        path: 'layers.0.attention_trace',
        kind: 'attention_trace',
        layer_index: 0,
        attention_trace: {
          scale: 0.125,
          position_count: 2,
          head_dim: 2,
          heads: [
            {
              attention_head: 0,
              kv_head: 0,
              query_first_values: [0.30, -0.40],
              context_first_values: [0.11, 0.12],
              reconstructed_context_first_values: [0.11, 0.12],
              context_reconstruction_max_abs_delta: 0,
              probability_sum: 1,
              probability_entropy: 0.7,
              probability_rms: 0.25,
              max_probability_position: 1,
              max_probability: 0.65,
              top_probability_positions: [
                topProbabilityPosition(1, 0.80, 0.65),
                topProbabilityPosition(0, 0.20, 0.35),
              ],
              positions: [
                position(0, 0.20, 0.35),
                position(1, 0.80, 0.65),
              ],
            },
          ],
        },
      },
      {
        order: 4,
        path: 'logits',
        kind: 'tensor_stats',
        stats: stats([8.0, 1.0]),
        reconstruction: {
          max_abs_delta: 0,
          reconstructed_output_first_values: [8.0, 1.0],
          reported_output_first_values: [8.0, 1.0],
        },
      },
    ],
    top_logits: [{ token_id: 16301, text: 'lei', logit: 8.0 }],
    output_projection: [
      {
        token_id: 16301,
        layout: 'descriptor',
        reported_logit: 8.0,
        reconstructed_logit: 8.0,
        absolute_delta: 0,
        top_positive_components: [{ dimension: 1, component: 1.5 }],
        top_negative_components: [{ dimension: 0, component: -0.25 }],
      },
    ],
  }
}

function kvCacheTrace() {
  return {
    layer_index: 0,
    position_count: 2,
    kv_head_count: 1,
    head_dim: 2,
    key_value_width: 2,
    key_checksum: 0.55,
    value_checksum: -0.35,
    key_rms: 0.22,
    value_rms: 0.45,
    key_max_abs: 0.3,
    key_max_abs_position: 1,
    key_max_abs_index: 1,
    value_max_abs: 0.6,
    value_max_abs_position: 1,
    value_max_abs_index: 1,
    sampled_positions: [
      kvCachePosition(0, [0.10, 0.20], [0.30, 0.40]),
      kvCachePosition(1, [0.20, -0.30], [0.50, -0.60]),
    ],
  }
}

function kvCachePosition(positionIndex, keyValues, valueValues) {
  return {
    position: positionIndex,
    key_checksum: keyValues.reduce((sum, value, index) => sum + (index + 1) * value, 0),
    value_checksum: valueValues.reduce((sum, value, index) => sum + (index + 1) * value, 0),
    key_rms: Math.sqrt(keyValues.reduce((sum, value) => sum + value * value, 0) / keyValues.length),
    value_rms: Math.sqrt(valueValues.reduce((sum, value) => sum + value * value, 0) / valueValues.length),
    key_max_abs: Math.max(...keyValues.map(value => Math.abs(value))),
    value_max_abs: Math.max(...valueValues.map(value => Math.abs(value))),
    key_first_values: keyValues,
    value_first_values: valueValues,
  }
}

function topProbabilityPosition(index, score, probability) {
  return {
    position: index,
    score,
    probability,
    key_first_values: [0.1, 0.2],
    value_first_values: [0.4, 0.5],
  }
}

function position(index, score, probability) {
  return {
    position: index,
    score,
    reconstructed_score: score,
    score_reconstruction_delta: 0,
    probability,
    key_first_values: [0.1, 0.2],
    qk_products_first_values: [0.03, -0.08],
    qk_products_max_abs_window: [0.03, -0.08],
    value_first_values: [0.4, 0.5],
  }
}

function stats(values) {
  return {
    shape: [1, values.length],
    len: values.length,
    min: Math.min(...values),
    min_index: values.indexOf(Math.min(...values)),
    max: Math.max(...values),
    max_index: values.indexOf(Math.max(...values)),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    rms: Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length),
    max_abs: Math.max(...values.map(value => Math.abs(value))),
    max_abs_index: values.map(value => Math.abs(value)).indexOf(Math.max(...values.map(value => Math.abs(value)))),
    first_values: values,
    max_abs_window_start: 0,
    max_abs_window: values,
  }
}
