#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const args = parseArgs(process.argv.slice(2))
if (!args.input) usage()

const inputPath = args.input
const tolerance = numberArg(args.tolerance ?? '0.00001', '--tolerance')
const root = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const failures = []

if (root.schema !== 'camelid.forward-trace.v1') {
  failures.push(failure('schema', `expected camelid.forward-trace.v1, got ${JSON.stringify(root.schema)}`))
}
const stages = Array.isArray(root.stages) ? root.stages : []
if (!Array.isArray(root.stages)) failures.push(failure('stages', 'expected stages array'))
if (Number.isInteger(root.stage_count) && root.stage_count !== stages.length) {
  failures.push(failure('stage_count', `stage_count ${root.stage_count} does not match stages length ${stages.length}`))
}

let statsChecked = 0
let reconstructionChecked = 0
let kvCacheTracesChecked = 0
let kvCachePositionsChecked = 0
let attentionHeadsChecked = 0
let attentionPositionsChecked = 0
let attentionTopProbabilityPositionsChecked = 0
let outputProjectionChecked = 0
let topLogitsChecked = 0

for (let index = 0; index < stages.length; index += 1) {
  const stage = stages[index]
  const stagePath = stage?.path ?? `stages[${index}]`
  if (stage?.order !== index) failures.push(failure(`${stagePath}.order`, `expected contiguous order ${index}, got ${stage?.order}`))
  if (typeof stage?.path !== 'string' || !stage.path) failures.push(failure(`stages[${index}].path`, 'expected non-empty path'))

  if (stage?.stats) {
    statsChecked += 1
    checkStats(stage.stats, `${stagePath}.stats`, failures)
  }
  if (stage?.reconstruction) {
    reconstructionChecked += 1
    checkReconstruction(stage.reconstruction, `${stagePath}.reconstruction`, tolerance, failures)
  }
  if (stage?.residual_delta) {
    reconstructionChecked += 1
    checkReconstruction(stage.residual_delta, `${stagePath}.residual_delta`, tolerance, failures)
  }
  if (stage?.kv_cache_trace) {
    if (Number.isInteger(stage?.layer_index) && Number.isInteger(stage.kv_cache_trace?.layer_index) && stage.layer_index !== stage.kv_cache_trace.layer_index) {
      failures.push(failure(`${stagePath}.kv_cache_trace.layer_index`, 'expected stage layer_index to match KV trace layer_index'))
    }
    const counts = checkKvCacheTrace(stage.kv_cache_trace, `${stagePath}.kv_cache_trace`, failures)
    kvCacheTracesChecked += 1
    kvCachePositionsChecked += counts.positions
  }
  if (stage?.attention_trace) {
    const counts = checkAttentionTrace(stage.attention_trace, `${stagePath}.attention_trace`, tolerance, failures)
    attentionHeadsChecked += counts.heads
    attentionPositionsChecked += counts.positions
    attentionTopProbabilityPositionsChecked += counts.topProbabilityPositions
  }
}

for (const [index, row] of (root.output_projection ?? []).entries()) {
  outputProjectionChecked += 1
  const rowPath = `output_projection[${index}]`
  checkFinite(row.reported_logit, `${rowPath}.reported_logit`, failures)
  checkFinite(row.reconstructed_logit, `${rowPath}.reconstructed_logit`, failures)
  checkFinite(row.absolute_delta, `${rowPath}.absolute_delta`, failures)
  checkTolerance(row.absolute_delta, tolerance, `${rowPath}.absolute_delta`, failures)
  checkFiniteArray(row.top_positive_components?.map(component => component?.component) ?? [], `${rowPath}.top_positive_components[].component`, failures)
  checkFiniteArray(row.top_negative_components?.map(component => component?.component) ?? [], `${rowPath}.top_negative_components[].component`, failures)
}

for (const [index, row] of (root.top_logits ?? []).entries()) {
  topLogitsChecked += 1
  checkFinite(row.logit, `top_logits[${index}].logit`, failures)
}

const report = {
  schema: 'camelid.forward-trace-invariants.v1',
  source: inputPath,
  tolerance,
  stage_count: stages.length,
  stats_checked: statsChecked,
  reconstruction_checked: reconstructionChecked,
  kv_cache_traces_checked: kvCacheTracesChecked,
  kv_cache_positions_checked: kvCachePositionsChecked,
  attention_heads_checked: attentionHeadsChecked,
  attention_positions_checked: attentionPositionsChecked,
  attention_top_probability_positions_checked: attentionTopProbabilityPositionsChecked,
  output_projection_checked: outputProjectionChecked,
  top_logits_checked: topLogitsChecked,
  failure_count: failures.length,
  first_failure: failures[0] ?? null,
  failures,
}

if (args['json-out']) {
  fs.mkdirSync(path.dirname(args['json-out']), { recursive: true })
  fs.writeFileSync(args['json-out'], `${JSON.stringify(report, null, 2)}\n`)
}

console.log(`schema=${report.schema}`)
console.log(`source=${inputPath}`)
console.log(`stage_count=${report.stage_count}`)
console.log(`reconstruction_checked=${report.reconstruction_checked}`)
console.log(`kv_cache_traces_checked=${report.kv_cache_traces_checked}`)
console.log(`attention_heads_checked=${report.attention_heads_checked}`)
console.log(`attention_top_probability_positions_checked=${report.attention_top_probability_positions_checked}`)
console.log(`output_projection_checked=${report.output_projection_checked}`)
console.log(`failure_count=${report.failure_count}`)
console.log(`first_failure=${report.first_failure ? `${report.first_failure.path}: ${report.first_failure.message}` : 'none'}`)

if (failures.length > 0) process.exitCode = 1

function usage() {
  console.error('usage: node scripts/check-forward-trace-invariants.mjs --input <forward-trace.v1.json> [--json-out <report.json>] [--tolerance 0.00001]')
  console.error('checks internal Camelid forward-trace invariants: stage ordering, finite stats, reconstruction deltas, attention probability/context reconstruction, and output-logit reconstruction')
  process.exit(2)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    if (!key.startsWith('--')) usage()
    const name = key.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) usage()
    out[name] = value
    i += 1
  }
  return out
}

function numberArg(value, label) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a finite non-negative number, got ${JSON.stringify(value)}`)
  return parsed
}

function checkStats(stats, basePath, out) {
  for (const key of ['min', 'max', 'mean', 'rms', 'max_abs']) {
    checkFinite(stats[key], `${basePath}.${key}`, out)
  }
  for (const key of ['min_index', 'max_index', 'max_abs_index', 'max_abs_window_start']) {
    if (stats[key] !== null && stats[key] !== undefined && !Number.isInteger(stats[key])) out.push(failure(`${basePath}.${key}`, 'expected integer index'))
  }
  if (stats.len !== null && stats.len !== undefined && (!Number.isInteger(stats.len) || stats.len < 0)) out.push(failure(`${basePath}.len`, 'expected non-negative integer length'))
  checkFiniteArray(stats.first_values ?? [], `${basePath}.first_values`, out)
  checkFiniteArray(stats.max_abs_window ?? [], `${basePath}.max_abs_window`, out)
}

function checkReconstruction(reconstruction, basePath, toleranceValue, out) {
  for (const key of Object.keys(reconstruction)) {
    const value = reconstruction[key]
    if (numericReconstructionKey(key)) checkFinite(value, `${basePath}.${key}`, out)
    if (key.endsWith('_first_values') || key.endsWith('_window')) checkFiniteArray(value ?? [], `${basePath}.${key}`, out)
  }
  for (const key of ['max_abs_delta', 'absolute_delta', 'score_reconstruction_delta', 'context_reconstruction_max_abs_delta']) {
    if (reconstruction[key] !== undefined && reconstruction[key] !== null) checkTolerance(reconstruction[key], toleranceValue, `${basePath}.${key}`, out)
  }
  compareArrays(reconstruction.reconstructed_first_values, reconstruction.reported_first_values, toleranceValue, `${basePath}.first_values`, out)
  compareArrays(reconstruction.reconstructed_reported_max_abs_window, reconstruction.reported_max_abs_window, toleranceValue, `${basePath}.reported_max_abs_window`, out)
  compareArrays(reconstruction.reconstructed_output_first_values, reconstruction.reported_output_first_values, toleranceValue, `${basePath}.output_first_values`, out)
  compareArrays(reconstruction.reconstructed_output_window, reconstruction.reported_output_window, toleranceValue, `${basePath}.output_window`, out)
}

function checkKvCacheTrace(trace, basePath, out) {
  for (const key of ['key_checksum', 'value_checksum', 'key_rms', 'value_rms', 'key_max_abs', 'value_max_abs']) {
    checkFinite(trace?.[key], `${basePath}.${key}`, out)
  }
  for (const key of ['layer_index', 'position_count', 'kv_head_count', 'head_dim', 'key_value_width', 'key_max_abs_position', 'key_max_abs_index', 'value_max_abs_position', 'value_max_abs_index']) {
    if (!Number.isInteger(trace?.[key]) || trace[key] < 0) out.push(failure(`${basePath}.${key}`, 'expected non-negative integer'))
  }
  if (Number.isInteger(trace?.position_count) && trace.position_count <= 0) out.push(failure(`${basePath}.position_count`, 'expected positive position_count'))
  if (Number.isInteger(trace?.kv_head_count) && trace.kv_head_count <= 0) out.push(failure(`${basePath}.kv_head_count`, 'expected positive kv_head_count'))
  if (Number.isInteger(trace?.head_dim) && trace.head_dim <= 0) out.push(failure(`${basePath}.head_dim`, 'expected positive head_dim'))
  if (
    Number.isInteger(trace?.kv_head_count)
    && Number.isInteger(trace?.head_dim)
    && Number.isInteger(trace?.key_value_width)
    && trace.key_value_width !== trace.kv_head_count * trace.head_dim
  ) {
    out.push(failure(`${basePath}.key_value_width`, 'expected kv_head_count * head_dim'))
  }
  for (const key of ['key_max_abs_position', 'value_max_abs_position']) {
    if (Number.isInteger(trace?.[key]) && Number.isInteger(trace?.position_count) && trace[key] >= trace.position_count) {
      out.push(failure(`${basePath}.${key}`, 'expected position within trace.position_count'))
    }
  }
  for (const key of ['key_max_abs_index', 'value_max_abs_index']) {
    if (Number.isInteger(trace?.[key]) && Number.isInteger(trace?.key_value_width) && trace[key] >= trace.key_value_width) {
      out.push(failure(`${basePath}.${key}`, 'expected index within key_value_width'))
    }
  }

  if (!Array.isArray(trace?.sampled_positions)) out.push(failure(`${basePath}.sampled_positions`, 'expected sampled_positions array'))
  if (Array.isArray(trace?.sampled_positions) && trace.sampled_positions.length === 0) out.push(failure(`${basePath}.sampled_positions`, 'expected at least one sampled position'))

  let positions = 0
  let previousPosition = -1
  for (const [index, position] of (trace?.sampled_positions ?? []).entries()) {
    positions += 1
    const positionPath = `${basePath}.sampled_positions[${index}]`
    if (!Number.isInteger(position?.position) || position.position < 0) out.push(failure(`${positionPath}.position`, 'expected non-negative integer position'))
    if (Number.isInteger(position?.position) && Number.isInteger(trace?.position_count) && position.position >= trace.position_count) {
      out.push(failure(`${positionPath}.position`, 'expected sampled position within trace.position_count'))
    }
    if (Number.isInteger(position?.position) && position.position <= previousPosition) out.push(failure(`${positionPath}.position`, 'expected sampled positions to be strictly increasing'))
    previousPosition = Number.isInteger(position?.position) ? position.position : previousPosition
    for (const key of ['key_checksum', 'value_checksum', 'key_rms', 'value_rms', 'key_max_abs', 'value_max_abs']) {
      checkFinite(position?.[key], `${positionPath}.${key}`, out)
    }
    checkFiniteArray(position?.key_first_values ?? [], `${positionPath}.key_first_values`, out)
    checkFiniteArray(position?.value_first_values ?? [], `${positionPath}.value_first_values`, out)
    for (const key of ['key_first_values', 'value_first_values']) {
      if (Array.isArray(position?.[key]) && Number.isInteger(trace?.key_value_width) && position[key].length > trace.key_value_width) {
        out.push(failure(`${positionPath}.${key}`, 'expected sample length within key_value_width'))
      }
    }
  }
  return { positions }
}

function checkAttentionTrace(trace, basePath, toleranceValue, out) {
  checkFinite(trace.scale, `${basePath}.scale`, out)
  if (!Number.isInteger(trace.position_count) || trace.position_count < 0) out.push(failure(`${basePath}.position_count`, 'expected non-negative integer position_count'))
  if (!Number.isInteger(trace.head_dim) || trace.head_dim <= 0) out.push(failure(`${basePath}.head_dim`, 'expected positive integer head_dim'))

  let heads = 0
  let positions = 0
  let topProbabilityPositions = 0
  for (const [headIndex, head] of (trace.heads ?? []).entries()) {
    heads += 1
    const headPath = `${basePath}.heads[${headIndex}]`
    checkFiniteArray(head.query_first_values ?? [], `${headPath}.query_first_values`, out)
    checkFiniteArray(head.context_first_values ?? [], `${headPath}.context_first_values`, out)
    checkFiniteArray(head.reconstructed_context_first_values ?? [], `${headPath}.reconstructed_context_first_values`, out)
    checkTolerance(head.context_reconstruction_max_abs_delta, toleranceValue, `${headPath}.context_reconstruction_max_abs_delta`, out)
    checkTolerance(Math.abs((head.probability_sum ?? NaN) - 1), toleranceValue, `${headPath}.probability_sum_delta`, out)
    checkFinite(head.probability_entropy, `${headPath}.probability_entropy`, out)
    checkFinite(head.probability_rms, `${headPath}.probability_rms`, out)
    compareArrays(head.reconstructed_context_first_values, head.context_first_values, toleranceValue, `${headPath}.context_first_values`, out)
    const maxProbabilityPositionValid = head.max_probability_position === null
      || head.max_probability_position === undefined
      || (Number.isInteger(head.max_probability_position) && head.max_probability_position >= 0 && head.max_probability_position < trace.position_count)
    if (!maxProbabilityPositionValid) out.push(failure(`${headPath}.max_probability_position`, 'expected max probability position within trace'))
    const maxProbabilityValid = head.max_probability === null
      || head.max_probability === undefined
      || (Number.isFinite(head.max_probability) && head.max_probability >= 0 && head.max_probability <= 1)
    if (!maxProbabilityValid) out.push(failure(`${headPath}.max_probability`, 'expected max probability in [0, 1]'))
    const topProbabilityCounts = checkTopProbabilityPositions(
      head.top_probability_positions,
      `${headPath}.top_probability_positions`,
      trace.position_count,
      head.max_probability_position,
      head.max_probability,
      out,
    )
    topProbabilityPositions += topProbabilityCounts.positions

    let previousPosition = -1
    for (const [positionIndex, position] of (head.positions ?? []).entries()) {
      positions += 1
      const positionPath = `${headPath}.positions[${positionIndex}]`
      if (!Number.isInteger(position.position) || position.position < 0) out.push(failure(`${positionPath}.position`, 'expected non-negative integer position'))
      if (Number.isInteger(position.position) && position.position < previousPosition) out.push(failure(`${positionPath}.position`, 'expected sampled positions to be non-decreasing'))
      previousPosition = Number.isInteger(position.position) ? position.position : previousPosition
      for (const key of ['score', 'reconstructed_score', 'score_reconstruction_delta', 'probability']) checkFinite(position[key], `${positionPath}.${key}`, out)
      checkTolerance(position.score_reconstruction_delta, toleranceValue, `${positionPath}.score_reconstruction_delta`, out)
      checkFiniteArray(position.key_first_values ?? [], `${positionPath}.key_first_values`, out)
      checkFiniteArray(position.qk_products_first_values ?? [], `${positionPath}.qk_products_first_values`, out)
      checkFiniteArray(position.qk_products_max_abs_window ?? [], `${positionPath}.qk_products_max_abs_window`, out)
      checkFiniteArray(position.value_first_values ?? [], `${positionPath}.value_first_values`, out)
    }
  }
  return { heads, positions, topProbabilityPositions }
}

function checkTopProbabilityPositions(rows, basePath, positionCount, maxProbabilityPosition, maxProbability, out) {
  if (rows === null || rows === undefined) return { positions: 0 }
  if (!Array.isArray(rows)) {
    out.push(failure(basePath, 'expected array'))
    return { positions: 0 }
  }
  if (rows.length === 0) out.push(failure(basePath, 'expected non-empty top probability positions'))
  let previousProbability = Infinity
  let previousPosition = -1
  const seenPositions = new Set()
  for (const [index, row] of rows.entries()) {
    const rowPath = `${basePath}[${index}]`
    const hasValidPosition = Number.isInteger(row?.position) && row.position >= 0 && row.position < positionCount
    if (!hasValidPosition) out.push(failure(`${rowPath}.position`, 'expected position within trace.position_count'))
    if (hasValidPosition) {
      if (seenPositions.has(row.position)) out.push(failure(`${rowPath}.position`, 'expected unique top probability position'))
      seenPositions.add(row.position)
    }
    checkFinite(row?.score, `${rowPath}.score`, out)
    checkFinite(row?.probability, `${rowPath}.probability`, out)
    if (Number.isFinite(row?.probability)) {
      if (row.probability < 0 || row.probability > 1) out.push(failure(`${rowPath}.probability`, 'expected probability in [0, 1]'))
      if (row.probability > previousProbability + 1e-12) out.push(failure(`${rowPath}.probability`, 'expected descending probability order'))
      if (index > 0 && Math.abs(row.probability - previousProbability) <= 1e-12 && hasValidPosition && row.position <= previousPosition) {
        out.push(failure(`${rowPath}.position`, 'expected ascending position order for equal probabilities'))
      }
      previousProbability = row.probability
    }
    previousPosition = hasValidPosition ? row.position : previousPosition
    checkFiniteArray(row?.key_first_values ?? [], `${rowPath}.key_first_values`, out)
    checkFiniteArray(row?.value_first_values ?? [], `${rowPath}.value_first_values`, out)
    if (index === 0) {
      if (Number.isInteger(maxProbabilityPosition) && hasValidPosition && row.position !== maxProbabilityPosition) {
        out.push(failure(`${rowPath}.position`, 'expected first top probability position to match max_probability_position'))
      }
      if (Number.isFinite(maxProbability) && Number.isFinite(row?.probability)) {
        checkTolerance(row.probability - maxProbability, 1e-6, `${rowPath}.probability`, out)
      }
    }
  }
  return { positions: rows.length }
}

function numericReconstructionKey(key) {
  return key.endsWith('_rms')
    || key.endsWith('_ratio')
    || key.endsWith('_similarity')
    || key.endsWith('_mean_square')
    || key.endsWith('_max_abs')
    || key.endsWith('_delta')
    || key === 'epsilon'
    || key === 'scale'
    || key === 'frequency_base'
    || key === 'hidden_rms'
    || key === 'input_rms'
    || key === 'reported_max_abs'
    || key === 'max_abs_delta'
}

function compareArrays(left, right, toleranceValue, basePath, out) {
  if (!Array.isArray(left) || !Array.isArray(right)) return
  if (left.length !== right.length) {
    out.push(failure(`${basePath}.length`, `expected matching lengths, got ${left.length} vs ${right.length}`))
    return
  }
  for (let index = 0; index < left.length; index += 1) {
    const delta = Math.abs(left[index] - right[index])
    if (!Number.isFinite(delta) || delta > toleranceValue) out.push(failure(`${basePath}[${index}]`, `delta ${delta} exceeds tolerance ${toleranceValue}`))
  }
}

function checkFiniteArray(values, basePath, out) {
  if (!Array.isArray(values)) {
    out.push(failure(basePath, 'expected array'))
    return
  }
  for (const [index, value] of values.entries()) checkFinite(value, `${basePath}[${index}]`, out)
}

function checkFinite(value, valuePath, out) {
  if (value === null || value === undefined || !Number.isFinite(value)) out.push(failure(valuePath, `expected finite number, got ${JSON.stringify(value)}`))
}

function checkTolerance(value, toleranceValue, valuePath, out) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    out.push(failure(valuePath, `expected finite number, got ${JSON.stringify(value)}`))
    return
  }
  const magnitude = Math.abs(value)
  if (magnitude > toleranceValue) out.push(failure(valuePath, `${magnitude} exceeds tolerance ${toleranceValue}`))
}

function failure(failurePath, message) {
  return { path: failurePath, message }
}
