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

if (!args.has('left') || !args.has('right')) {
  console.error('usage: node scripts/compare-dense-checkpoints.mjs --left <diagnostics.json> --right <diagnostics.json> [--atol 1e-5] [--rtol 1e-4] [--json-out <path>]')
  console.error('compares dense tensor checkpoints, output-projection reconstruction diagnostics, RMSNorm reconstruction diagnostics, linear-projection reconstruction diagnostics, FFN activation reconstruction diagnostics, RoPE reconstruction diagnostics, residual-flow diagnostics, and sampled per-layer attention_trace scores/probabilities/context/key/value/query values')
  process.exit(2)
}

const leftPath = resolve(args.get('left'))
const rightPath = resolve(args.get('right'))
const absoluteTolerance = parseNumberArg('atol', 1e-5)
const relativeTolerance = parseNumberArg('rtol', 1e-4)
const jsonOut = args.get('json-out')

const left = await loadDiagnostics(leftPath)
const right = await loadDiagnostics(rightPath)
const comparisons = compareDense(left, right)
const firstFailure = comparisons.find(item => !item.ok) || null
const summary = {
  left: leftPath,
  right: rightPath,
  absolute_tolerance: absoluteTolerance,
  relative_tolerance: relativeTolerance,
  checkpoint_count: comparisons.length,
  match: firstFailure === null,
  first_failure: firstFailure,
  generated_tokens: {
    left: left.root?.generated_token_ids || [],
    right: right.root?.generated_token_ids || [],
    match: jsonEqual(left.root?.generated_token_ids || [], right.root?.generated_token_ids || []),
  },
  top_logits: {
    left: (left.root?.top_logits || []).slice(0, 5),
    right: (right.root?.top_logits || []).slice(0, 5),
  },
}

console.log(`left=${leftPath}`)
console.log(`right=${rightPath}`)
console.log(`atol=${absoluteTolerance}`)
console.log(`rtol=${relativeTolerance}`)
console.log(`checkpoint_count=${comparisons.length}`)
console.log(`generated_tokens_match=${summary.generated_tokens.match}`)
console.log(`generated_tokens_left=${JSON.stringify(summary.generated_tokens.left)}`)
console.log(`generated_tokens_right=${JSON.stringify(summary.generated_tokens.right)}`)
if (firstFailure) {
  console.log(`first_checkpoint_failure=${firstFailure.path}`)
  console.log(`failure_reason=${firstFailure.reason}`)
  if (firstFailure.max_abs_diff !== undefined) console.log(`max_abs_diff=${firstFailure.max_abs_diff}`)
  if (firstFailure.first_diff_index !== undefined) console.log(`first_diff_index=${firstFailure.first_diff_index}`)
  process.exitCode = 1
} else {
  console.log('checkpoint_samples_match=true')
}

if (jsonOut) {
  await writeFile(resolve(jsonOut), `${JSON.stringify({ ...summary, comparisons }, null, 2)}\n`)
  console.log(`json_out=${resolve(jsonOut)}`)
}

function parseNumberArg(name, fallback) {
  const raw = args.get(name)
  if (raw === undefined) return fallback
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative number, got ${raw}`)
  return parsed
}

async function loadDiagnostics(path) {
  const json = JSON.parse(await readFile(path, 'utf8'))
  const root = json.camelid || json
  const dense = root.dense
  if (!dense || !Array.isArray(dense.layers)) {
    throw new Error(`${path} does not look like a chat-parity diagnostics capture with camelid.dense.layers`)
  }
  return { path, json, root, dense }
}

function compareDense(left, right) {
  const checkpointComparisons = checkpointPaths(left.dense, right.dense)
    .map(path => compareCheckpoint(path, getPath(left.dense, path), getPath(right.dense, path)))
  return [
    ...checkpointComparisons,
    ...compareOutputProjectionDiagnostics(left.root?.output_projection, right.root?.output_projection),
    ...compareFinalNormDiagnostics(left.dense?.final_norm, right.dense?.final_norm),
    ...compareLayerRmsNormDiagnostics(left.dense, right.dense),
    ...compareLinearProjectionDiagnostics(left.dense, right.dense),
    ...compareFfnActivationDiagnostics(left.dense, right.dense),
    ...compareRopeDiagnostics(left.dense, right.dense),
    ...compareResidualFlowDiagnostics(left.dense, right.dense),
    ...compareAttentionTraces(left.dense, right.dense),
  ]
}

function compareOutputProjectionDiagnostics(leftOutputProjection, rightOutputProjection) {
  const leftRows = leftOutputProjection || []
  const rightRows = rightOutputProjection || []
  if (leftRows.length === 0 && rightRows.length === 0) return []
  const comparisons = [compareExact('output_projection.length', leftRows.length, rightRows.length)]
  const rowCount = Math.min(leftRows.length, rightRows.length)
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const path = `output_projection.${rowIndex}`
    const leftRow = leftRows[rowIndex]
    const rightRow = rightRows[rowIndex]
    comparisons.push(
      compareExact(`${path}.token_id`, leftRow.token_id, rightRow.token_id),
      compareExact(`${path}.layout`, leftRow.layout, rightRow.layout),
      compareNumberScalar(`${path}.reported_logit`, leftRow.reported_logit, rightRow.reported_logit),
      compareNumberScalar(`${path}.reconstructed_logit`, leftRow.reconstructed_logit, rightRow.reconstructed_logit),
      compareNumberScalar(`${path}.absolute_delta`, leftRow.absolute_delta, rightRow.absolute_delta),
      compareNumberScalar(`${path}.output_norm_rms`, leftRow.output_norm_rms, rightRow.output_norm_rms),
      compareNumberScalar(`${path}.output_row_rms`, leftRow.output_row_rms, rightRow.output_row_rms),
      compareNumberScalar(`${path}.cosine_similarity`, leftRow.cosine_similarity, rightRow.cosine_similarity),
      compareNumberArrays(`${path}.output_norm_first_values`, leftRow.output_norm_first_values, rightRow.output_norm_first_values),
      compareNumberArrays(`${path}.output_row_first_values`, leftRow.output_row_first_values, rightRow.output_row_first_values),
      compareNumberArrays(`${path}.component_products_first_values`, leftRow.component_products_first_values, rightRow.component_products_first_values),
      compareExact(`${path}.component_products_max_abs_window_start`, leftRow.component_products_max_abs_window_start, rightRow.component_products_max_abs_window_start),
      compareNumberArrays(`${path}.component_products_max_abs_window`, leftRow.component_products_max_abs_window, rightRow.component_products_max_abs_window),
      compareExact(`${path}.max_abs_component_index`, leftRow.max_abs_component_index, rightRow.max_abs_component_index),
      compareNumberScalar(`${path}.max_abs_component`, leftRow.max_abs_component, rightRow.max_abs_component),
      compareNumberScalar(`${path}.positive_component_sum`, leftRow.positive_component_sum, rightRow.positive_component_sum),
      compareNumberScalar(`${path}.negative_component_sum`, leftRow.negative_component_sum, rightRow.negative_component_sum),
      ...compareOutputProjectionComponents(`${path}.top_positive_components`, leftRow.top_positive_components, rightRow.top_positive_components),
      ...compareOutputProjectionComponents(`${path}.top_negative_components`, leftRow.top_negative_components, rightRow.top_negative_components),
    )
  }
  return comparisons
}

function compareOutputProjectionComponents(path, leftComponents, rightComponents) {
  const leftRows = leftComponents || []
  const rightRows = rightComponents || []
  const comparisons = [compareExact(`${path}.length`, leftRows.length, rightRows.length)]
  const rowCount = Math.min(leftRows.length, rightRows.length)
  for (let componentIndex = 0; componentIndex < rowCount; componentIndex += 1) {
    const left = leftRows[componentIndex]
    const right = rightRows[componentIndex]
    const componentPath = `${path}.${componentIndex}`
    comparisons.push(
      compareExact(`${componentPath}.index`, left.index, right.index),
      compareNumberScalar(`${componentPath}.output_norm_value`, left.output_norm_value, right.output_norm_value),
      compareNumberScalar(`${componentPath}.output_row_value`, left.output_row_value, right.output_row_value),
      compareNumberScalar(`${componentPath}.component`, left.component, right.component),
    )
  }
  return comparisons
}

function compareFinalNormDiagnostics(leftFinalNorm, rightFinalNorm) {
  if (!leftFinalNorm && !rightFinalNorm) return []
  if (!leftFinalNorm) return [{ path: 'final_norm', ok: false, reason: 'missing_left_final_norm' }]
  if (!rightFinalNorm) return [{ path: 'final_norm', ok: false, reason: 'missing_right_final_norm' }]
  const comparisons = [
    compareNumberScalar('final_norm.epsilon', leftFinalNorm.epsilon, rightFinalNorm.epsilon),
    compareNumberScalar('final_norm.hidden_mean_square', leftFinalNorm.hidden_mean_square, rightFinalNorm.hidden_mean_square),
    compareNumberScalar('final_norm.hidden_rms', leftFinalNorm.hidden_rms, rightFinalNorm.hidden_rms),
    compareNumberScalar('final_norm.scale', leftFinalNorm.scale, rightFinalNorm.scale),
    compareNumberArrays('final_norm.hidden_first_values', leftFinalNorm.hidden_first_values, rightFinalNorm.hidden_first_values),
    compareNumberArrays('final_norm.weight_first_values', leftFinalNorm.weight_first_values, rightFinalNorm.weight_first_values),
    compareNumberArrays('final_norm.reconstructed_first_values', leftFinalNorm.reconstructed_first_values, rightFinalNorm.reconstructed_first_values),
    compareNumberArrays('final_norm.reported_first_values', leftFinalNorm.reported_first_values, rightFinalNorm.reported_first_values),
    compareExact('final_norm.max_abs_delta_index', leftFinalNorm.max_abs_delta_index, rightFinalNorm.max_abs_delta_index),
    compareNumberScalar('final_norm.max_abs_delta', leftFinalNorm.max_abs_delta, rightFinalNorm.max_abs_delta),
  ]
  comparisons.push(...compareOptionalPeakWindow('final_norm', leftFinalNorm, rightFinalNorm))
  return comparisons
}

function checkpointPaths(leftDense, rightDense) {
  const stages = [
    'embedding',
    ...layerStages(leftDense, rightDense),
    'final_hidden',
    'output_norm',
    'logits',
  ]
  return stages.filter(path => getPath(leftDense, path) || getPath(rightDense, path))
}

function layerStages(leftDense, rightDense) {
  const maxLayers = Math.max(leftDense.layers.length, rightDense.layers.length)
  const stageNames = [
    'residual_flow.attention_input',
    'attention_norm',
    'attention_q',
    'attention_k',
    'attention_q_rope',
    'attention_k_rope',
    'attention_v',
    'attention_context',
    'attention_output',
    'attention_residual',
    'residual_flow.ffn_input',
    'ffn_norm',
    'ffn_gate',
    'ffn_up',
    'ffn_activation',
    'ffn_output',
    'ffn_residual',
  ]
  const paths = []
  for (let i = 0; i < maxLayers; i += 1) {
    for (const stage of stageNames) paths.push(`layers.${i}.${stage}`)
  }
  return paths
}

function compareCheckpoint(path, leftValue, rightValue) {
  if (!leftValue) return { path, ok: false, reason: 'missing_left_checkpoint' }
  if (!rightValue) return { path, ok: false, reason: 'missing_right_checkpoint' }

  const leftCheckpoint = leftValue.checkpoint
  const rightCheckpoint = rightValue.checkpoint
  if (!leftCheckpoint) return { path, ok: false, reason: 'missing_left_checkpoint_payload' }
  if (!rightCheckpoint) return { path, ok: false, reason: 'missing_right_checkpoint_payload' }
  if (!jsonEqual(leftCheckpoint.shape, rightCheckpoint.shape)) {
    return { path, ok: false, reason: 'shape_mismatch', left_shape: leftCheckpoint.shape, right_shape: rightCheckpoint.shape }
  }
  if (leftCheckpoint.len !== rightCheckpoint.len) {
    return { path, ok: false, reason: 'len_mismatch', left_len: leftCheckpoint.len, right_len: rightCheckpoint.len }
  }
  const firstValues = compareNumberArrays(`${path}.first_values`, leftCheckpoint.first_values, rightCheckpoint.first_values)
  if (!firstValues.ok) return firstValues
  if (leftCheckpoint.max_abs_window_start !== rightCheckpoint.max_abs_window_start) {
    return {
      path,
      ok: false,
      reason: 'max_abs_window_start_mismatch',
      left_start: leftCheckpoint.max_abs_window_start,
      right_start: rightCheckpoint.max_abs_window_start,
    }
  }
  const maxWindow = compareNumberArrays(`${path}.max_abs_window`, leftCheckpoint.max_abs_window, rightCheckpoint.max_abs_window)
  if (!maxWindow.ok) return maxWindow
  return {
    path,
    ok: true,
    max_abs_diff: Math.max(firstValues.max_abs_diff, maxWindow.max_abs_diff),
  }
}


function compareLayerRmsNormDiagnostics(leftDense, rightDense) {
  const maxLayers = Math.max(leftDense.layers.length, rightDense.layers.length)
  const comparisons = []
  for (let layerIndex = 0; layerIndex < maxLayers; layerIndex += 1) {
    for (const field of ['attention_norm_reconstruction', 'ffn_norm_reconstruction']) {
      const path = `layers.${layerIndex}.${field}`
      const leftNorm = leftDense.layers[layerIndex]?.[field]
      const rightNorm = rightDense.layers[layerIndex]?.[field]
      if (!leftNorm && !rightNorm) continue
      comparisons.push(...compareRmsNormDiagnostic(path, leftNorm, rightNorm))
    }
  }
  return comparisons
}

function compareRmsNormDiagnostic(path, leftNorm, rightNorm) {
  if (!leftNorm) return [{ path, ok: false, reason: 'missing_left_rms_norm_reconstruction' }]
  if (!rightNorm) return [{ path, ok: false, reason: 'missing_right_rms_norm_reconstruction' }]
  const comparisons = [
    compareNumberScalar(`${path}.epsilon`, leftNorm.epsilon, rightNorm.epsilon),
    compareNumberScalar(`${path}.input_mean_square`, leftNorm.input_mean_square, rightNorm.input_mean_square),
    compareNumberScalar(`${path}.input_rms`, leftNorm.input_rms, rightNorm.input_rms),
    compareNumberScalar(`${path}.scale`, leftNorm.scale, rightNorm.scale),
    compareNumberArrays(`${path}.input_first_values`, leftNorm.input_first_values, rightNorm.input_first_values),
    compareNumberArrays(`${path}.weight_first_values`, leftNorm.weight_first_values, rightNorm.weight_first_values),
    compareNumberArrays(`${path}.reconstructed_first_values`, leftNorm.reconstructed_first_values, rightNorm.reconstructed_first_values),
    compareNumberArrays(`${path}.reported_first_values`, leftNorm.reported_first_values, rightNorm.reported_first_values),
    compareExact(`${path}.max_abs_delta_index`, leftNorm.max_abs_delta_index, rightNorm.max_abs_delta_index),
    compareNumberScalar(`${path}.max_abs_delta`, leftNorm.max_abs_delta, rightNorm.max_abs_delta),
  ]
  comparisons.push(...compareOptionalPeakWindow(path, leftNorm, rightNorm))
  return comparisons
}

function compareOptionalPeakWindow(path, leftDiagnostic, rightDiagnostic) {
  const hasPeakWindow = leftDiagnostic.reported_max_abs_index !== undefined || rightDiagnostic.reported_max_abs_index !== undefined
  if (!hasPeakWindow) return []
  return [
    compareExact(`${path}.reported_max_abs_index`, leftDiagnostic.reported_max_abs_index, rightDiagnostic.reported_max_abs_index),
    compareNumberScalar(`${path}.reported_max_abs`, leftDiagnostic.reported_max_abs, rightDiagnostic.reported_max_abs),
    compareExact(`${path}.reported_max_abs_window_start`, leftDiagnostic.reported_max_abs_window_start, rightDiagnostic.reported_max_abs_window_start),
    compareNumberArrays(`${path}.reported_max_abs_window`, leftDiagnostic.reported_max_abs_window, rightDiagnostic.reported_max_abs_window),
    compareNumberArrays(`${path}.reconstructed_reported_max_abs_window`, leftDiagnostic.reconstructed_reported_max_abs_window, rightDiagnostic.reconstructed_reported_max_abs_window),
  ]
}

function compareLinearProjectionDiagnostics(leftDense, rightDense) {
  const maxLayers = Math.max(leftDense.layers.length, rightDense.layers.length)
  const comparisons = []
  const fields = [
    'attention_q_reconstruction',
    'attention_k_reconstruction',
    'attention_v_reconstruction',
    'attention_output_reconstruction',
    'ffn_gate_reconstruction',
    'ffn_up_reconstruction',
    'ffn_down_reconstruction',
  ]
  for (let layerIndex = 0; layerIndex < maxLayers; layerIndex += 1) {
    for (const field of fields) {
      const path = `layers.${layerIndex}.${field}`
      const leftProjection = leftDense.layers[layerIndex]?.[field]
      const rightProjection = rightDense.layers[layerIndex]?.[field]
      if (!leftProjection && !rightProjection) continue
      comparisons.push(...compareLinearProjectionDiagnostic(path, leftProjection, rightProjection))
    }
  }
  return comparisons
}

function compareLinearProjectionDiagnostic(path, leftProjection, rightProjection) {
  if (!leftProjection) return [{ path, ok: false, reason: 'missing_left_linear_projection_reconstruction' }]
  if (!rightProjection) return [{ path, ok: false, reason: 'missing_right_linear_projection_reconstruction' }]
  return [
    compareExact(`${path}.role`, leftProjection.role, rightProjection.role),
    compareExact(`${path}.layout`, leftProjection.layout, rightProjection.layout),
    compareExact(`${path}.input_width`, leftProjection.input_width, rightProjection.input_width),
    compareExact(`${path}.output_width`, leftProjection.output_width, rightProjection.output_width),
    compareExact(`${path}.weight_shape`, JSON.stringify(leftProjection.weight_shape), JSON.stringify(rightProjection.weight_shape)),
    compareNumberArrays(`${path}.input_first_values`, leftProjection.input_first_values, rightProjection.input_first_values),
    compareNumberArrays(`${path}.weight_first_values`, leftProjection.weight_first_values, rightProjection.weight_first_values),
    compareNumberArrays(`${path}.reconstructed_first_values`, leftProjection.reconstructed_first_values, rightProjection.reconstructed_first_values),
    compareNumberArrays(`${path}.reported_first_values`, leftProjection.reported_first_values, rightProjection.reported_first_values),
    compareExact(`${path}.reported_max_abs_index`, leftProjection.reported_max_abs_index, rightProjection.reported_max_abs_index),
    compareNumberScalar(`${path}.reported_max_abs`, leftProjection.reported_max_abs, rightProjection.reported_max_abs),
    compareExact(`${path}.reported_max_abs_window_start`, leftProjection.reported_max_abs_window_start, rightProjection.reported_max_abs_window_start),
    compareNumberArrays(`${path}.reported_max_abs_window`, leftProjection.reported_max_abs_window, rightProjection.reported_max_abs_window),
    compareNumberArrays(`${path}.reconstructed_reported_max_abs_window`, leftProjection.reconstructed_reported_max_abs_window, rightProjection.reconstructed_reported_max_abs_window),
    compareExact(`${path}.max_abs_delta_index`, leftProjection.max_abs_delta_index, rightProjection.max_abs_delta_index),
    compareNumberScalar(`${path}.max_abs_delta`, leftProjection.max_abs_delta, rightProjection.max_abs_delta),
  ]
}

function compareFfnActivationDiagnostics(leftDense, rightDense) {
  const maxLayers = Math.max(leftDense.layers.length, rightDense.layers.length)
  const comparisons = []
  for (let layerIndex = 0; layerIndex < maxLayers; layerIndex += 1) {
    const path = `layers.${layerIndex}.ffn_activation_reconstruction`
    const leftActivation = leftDense.layers[layerIndex]?.ffn_activation_reconstruction
    const rightActivation = rightDense.layers[layerIndex]?.ffn_activation_reconstruction
    if (!leftActivation && !rightActivation) continue
    comparisons.push(...compareFfnActivationDiagnostic(path, leftActivation, rightActivation))
  }
  return comparisons
}

function compareFfnActivationDiagnostic(path, leftActivation, rightActivation) {
  if (!leftActivation) return [{ path, ok: false, reason: 'missing_left_ffn_activation_reconstruction' }]
  if (!rightActivation) return [{ path, ok: false, reason: 'missing_right_ffn_activation_reconstruction' }]
  return [
    compareExact(`${path}.gate_width`, leftActivation.gate_width, rightActivation.gate_width),
    compareExact(`${path}.activation_order`, leftActivation.activation_order ?? 'gate_up', rightActivation.activation_order ?? 'gate_up'),
    compareNumberArrays(`${path}.gate_first_values`, leftActivation.gate_first_values, rightActivation.gate_first_values),
    compareNumberArrays(`${path}.up_first_values`, leftActivation.up_first_values, rightActivation.up_first_values),
    compareNumberArrays(`${path}.reconstructed_first_values`, leftActivation.reconstructed_first_values, rightActivation.reconstructed_first_values),
    compareNumberArrays(`${path}.reported_first_values`, leftActivation.reported_first_values, rightActivation.reported_first_values),
    compareExact(`${path}.reported_max_abs_index`, leftActivation.reported_max_abs_index, rightActivation.reported_max_abs_index),
    compareNumberScalar(`${path}.reported_max_abs`, leftActivation.reported_max_abs, rightActivation.reported_max_abs),
    compareExact(`${path}.reported_max_abs_window_start`, leftActivation.reported_max_abs_window_start, rightActivation.reported_max_abs_window_start),
    compareNumberArrays(`${path}.reported_max_abs_window`, leftActivation.reported_max_abs_window, rightActivation.reported_max_abs_window),
    compareNumberArrays(`${path}.reconstructed_reported_max_abs_window`, leftActivation.reconstructed_reported_max_abs_window, rightActivation.reconstructed_reported_max_abs_window),
    compareExact(`${path}.max_abs_delta_index`, leftActivation.max_abs_delta_index, rightActivation.max_abs_delta_index),
    compareNumberScalar(`${path}.max_abs_delta`, leftActivation.max_abs_delta, rightActivation.max_abs_delta),
  ]
}

function compareRopeDiagnostics(leftDense, rightDense) {
  const maxLayers = Math.max(leftDense.layers.length, rightDense.layers.length)
  const comparisons = []
  for (let layerIndex = 0; layerIndex < maxLayers; layerIndex += 1) {
    for (const field of ['attention_q_rope_reconstruction', 'attention_k_rope_reconstruction']) {
      const path = `layers.${layerIndex}.${field}`
      const leftRope = leftDense.layers[layerIndex]?.[field]
      const rightRope = rightDense.layers[layerIndex]?.[field]
      if (!leftRope && !rightRope) continue
      comparisons.push(...compareRopeDiagnostic(path, leftRope, rightRope))
    }
  }
  return comparisons
}

function compareRopeDiagnostic(path, leftRope, rightRope) {
  if (!leftRope) return [{ path, ok: false, reason: 'missing_left_rope_reconstruction' }]
  if (!rightRope) return [{ path, ok: false, reason: 'missing_right_rope_reconstruction' }]
  const comparisons = [
    compareExact(`${path}.role`, leftRope.role, rightRope.role),
    compareExact(`${path}.pairing`, leftRope.pairing, rightRope.pairing),
    compareExact(`${path}.direction`, leftRope.direction, rightRope.direction),
    compareExact(`${path}.position_mode`, leftRope.position_mode ?? 'zero_based', rightRope.position_mode ?? 'zero_based'),
    compareExact(`${path}.position`, leftRope.position, rightRope.position),
    compareExact(`${path}.effective_position`, leftRope.effective_position ?? leftRope.position, rightRope.effective_position ?? rightRope.position),
    compareExact(`${path}.head_count`, leftRope.head_count, rightRope.head_count),
    compareExact(`${path}.head_dim`, leftRope.head_dim, rightRope.head_dim),
    compareExact(`${path}.rope_dim`, leftRope.rope_dim, rightRope.rope_dim),
    compareNumberScalar(`${path}.freq_base`, leftRope.freq_base, rightRope.freq_base),
    compareNumberArrays(`${path}.input_first_values`, leftRope.input_first_values, rightRope.input_first_values),
    compareNumberArrays(`${path}.reconstructed_first_values`, leftRope.reconstructed_first_values, rightRope.reconstructed_first_values),
    compareNumberArrays(`${path}.reported_first_values`, leftRope.reported_first_values, rightRope.reported_first_values),
    compareExact(`${path}.max_abs_delta_index`, leftRope.max_abs_delta_index, rightRope.max_abs_delta_index),
    compareNumberScalar(`${path}.max_abs_delta`, leftRope.max_abs_delta, rightRope.max_abs_delta),
  ]
  if (leftRope.reported_max_abs_window !== undefined || rightRope.reported_max_abs_window !== undefined) {
    comparisons.push(
      compareExact(`${path}.reported_max_abs_index`, leftRope.reported_max_abs_index, rightRope.reported_max_abs_index),
      compareNumberScalar(`${path}.reported_max_abs`, leftRope.reported_max_abs, rightRope.reported_max_abs),
      compareExact(`${path}.reported_max_abs_window_start`, leftRope.reported_max_abs_window_start, rightRope.reported_max_abs_window_start),
      compareNumberArrays(`${path}.reported_max_abs_window`, leftRope.reported_max_abs_window, rightRope.reported_max_abs_window),
      compareNumberArrays(`${path}.reconstructed_reported_max_abs_window`, leftRope.reconstructed_reported_max_abs_window, rightRope.reconstructed_reported_max_abs_window),
    )
  }
  return comparisons
}

function compareResidualFlowDiagnostics(leftDense, rightDense) {
  const maxLayers = Math.max(leftDense.layers.length, rightDense.layers.length)
  const comparisons = []
  for (let layerIndex = 0; layerIndex < maxLayers; layerIndex += 1) {
    const path = `layers.${layerIndex}.residual_flow`
    const leftFlow = leftDense.layers[layerIndex]?.residual_flow
    const rightFlow = rightDense.layers[layerIndex]?.residual_flow
    if (!leftFlow && !rightFlow) continue
    if (!leftFlow) { comparisons.push({ path, ok: false, reason: 'missing_left_residual_flow' }); continue }
    if (!rightFlow) { comparisons.push({ path, ok: false, reason: 'missing_right_residual_flow' }); continue }
    comparisons.push(
      ...compareResidualDelta(`${path}.attention_delta`, leftFlow.attention_delta, rightFlow.attention_delta),
      ...compareResidualDelta(`${path}.ffn_delta`, leftFlow.ffn_delta, rightFlow.ffn_delta),
    )
  }
  return comparisons
}

function compareResidualDelta(path, leftDelta, rightDelta) {
  if (!leftDelta) return [{ path, ok: false, reason: 'missing_left_residual_delta' }]
  if (!rightDelta) return [{ path, ok: false, reason: 'missing_right_residual_delta' }]
  return [
    compareNumberScalar(`${path}.input_rms`, leftDelta.input_rms, rightDelta.input_rms),
    compareNumberScalar(`${path}.delta_rms`, leftDelta.delta_rms, rightDelta.delta_rms),
    compareNumberScalar(`${path}.reported_rms`, leftDelta.reported_rms, rightDelta.reported_rms),
    compareNumberScalar(`${path}.delta_to_input_rms_ratio`, leftDelta.delta_to_input_rms_ratio, rightDelta.delta_to_input_rms_ratio),
    compareNumberScalar(`${path}.delta_input_cosine_similarity`, leftDelta.delta_input_cosine_similarity, rightDelta.delta_input_cosine_similarity),
    compareNumberArrays(`${path}.input_first_values`, leftDelta.input_first_values, rightDelta.input_first_values),
    compareNumberArrays(`${path}.delta_first_values`, leftDelta.delta_first_values, rightDelta.delta_first_values),
    compareNumberArrays(`${path}.reconstructed_first_values`, leftDelta.reconstructed_first_values, rightDelta.reconstructed_first_values),
    compareNumberArrays(`${path}.reported_first_values`, leftDelta.reported_first_values, rightDelta.reported_first_values),
    compareExact(`${path}.reported_max_abs_index`, leftDelta.reported_max_abs_index, rightDelta.reported_max_abs_index),
    compareNumberScalar(`${path}.reported_max_abs`, leftDelta.reported_max_abs, rightDelta.reported_max_abs),
    compareExact(`${path}.reported_max_abs_window_start`, leftDelta.reported_max_abs_window_start, rightDelta.reported_max_abs_window_start),
    compareNumberArrays(`${path}.reported_max_abs_window`, leftDelta.reported_max_abs_window, rightDelta.reported_max_abs_window),
    compareNumberArrays(`${path}.reconstructed_reported_max_abs_window`, leftDelta.reconstructed_reported_max_abs_window, rightDelta.reconstructed_reported_max_abs_window),
    compareNumberArrays(`${path}.delta_reported_max_abs_window`, leftDelta.delta_reported_max_abs_window, rightDelta.delta_reported_max_abs_window),
    compareExact(`${path}.max_abs_delta_index`, leftDelta.max_abs_delta_index, rightDelta.max_abs_delta_index),
    compareNumberScalar(`${path}.max_abs_delta`, leftDelta.max_abs_delta, rightDelta.max_abs_delta),
  ]
}

function compareAttentionTraces(leftDense, rightDense) {
  const maxLayers = Math.max(leftDense.layers.length, rightDense.layers.length)
  const comparisons = []
  for (let layerIndex = 0; layerIndex < maxLayers; layerIndex += 1) {
    const path = `layers.${layerIndex}.attention_trace`
    const leftTrace = leftDense.layers[layerIndex]?.attention_trace
    const rightTrace = rightDense.layers[layerIndex]?.attention_trace
    if (!leftTrace && !rightTrace) continue
    comparisons.push(...compareAttentionTrace(path, leftTrace, rightTrace))
  }
  return comparisons
}

function compareAttentionTrace(path, leftTrace, rightTrace) {
  if (!leftTrace) return [{ path, ok: false, reason: 'missing_left_attention_trace' }]
  if (!rightTrace) return [{ path, ok: false, reason: 'missing_right_attention_trace' }]

  const comparisons = [
    compareNumberScalar(`${path}.scale`, leftTrace.scale, rightTrace.scale),
    compareExact(`${path}.position_count`, leftTrace.position_count, rightTrace.position_count),
    compareExact(`${path}.head_dim`, leftTrace.head_dim, rightTrace.head_dim),
  ]
  const leftHeads = leftTrace.heads || []
  const rightHeads = rightTrace.heads || []
  comparisons.push(compareExact(`${path}.heads.length`, leftHeads.length, rightHeads.length))

  const headCount = Math.min(leftHeads.length, rightHeads.length)
  for (let headIndex = 0; headIndex < headCount; headIndex += 1) {
    const headPath = `${path}.heads.${headIndex}`
    const leftHead = leftHeads[headIndex]
    const rightHead = rightHeads[headIndex]
    comparisons.push(
      compareExact(`${headPath}.attention_head`, leftHead.attention_head, rightHead.attention_head),
      compareExact(`${headPath}.kv_head`, leftHead.kv_head, rightHead.kv_head),
      compareNumberArrays(`${headPath}.query_first_values`, leftHead.query_first_values, rightHead.query_first_values),
      compareNumberArrays(`${headPath}.context_first_values`, leftHead.context_first_values, rightHead.context_first_values),
    )
    if (leftHead.reconstructed_context_first_values !== undefined || rightHead.reconstructed_context_first_values !== undefined) {
      comparisons.push(
        compareNumberArrays(`${headPath}.reconstructed_context_first_values`, leftHead.reconstructed_context_first_values, rightHead.reconstructed_context_first_values),
        compareExact(`${headPath}.context_reconstruction_max_abs_delta_index`, leftHead.context_reconstruction_max_abs_delta_index, rightHead.context_reconstruction_max_abs_delta_index),
        compareNumberScalar(`${headPath}.context_reconstruction_max_abs_delta`, leftHead.context_reconstruction_max_abs_delta, rightHead.context_reconstruction_max_abs_delta),
        compareNumberScalar(`${headPath}.probability_sum`, leftHead.probability_sum, rightHead.probability_sum),
        compareNumberScalar(`${headPath}.probability_entropy`, leftHead.probability_entropy, rightHead.probability_entropy),
        compareNumberScalar(`${headPath}.probability_rms`, leftHead.probability_rms, rightHead.probability_rms),
        compareExact(`${headPath}.max_probability_position`, leftHead.max_probability_position, rightHead.max_probability_position),
        compareNumberScalar(`${headPath}.max_probability`, leftHead.max_probability, rightHead.max_probability),
      )
    }

    const leftPositions = leftHead.positions || []
    const rightPositions = rightHead.positions || []
    comparisons.push(compareExact(`${headPath}.positions.length`, leftPositions.length, rightPositions.length))
    const positionCount = Math.min(leftPositions.length, rightPositions.length)
    for (let positionIndex = 0; positionIndex < positionCount; positionIndex += 1) {
      const positionPath = `${headPath}.positions.${positionIndex}`
      const leftPosition = leftPositions[positionIndex]
      const rightPosition = rightPositions[positionIndex]
      comparisons.push(
        compareExact(`${positionPath}.position`, leftPosition.position, rightPosition.position),
        compareNumberScalar(`${positionPath}.score`, leftPosition.score, rightPosition.score),
        compareNumberScalar(`${positionPath}.probability`, leftPosition.probability, rightPosition.probability),
        compareNumberArrays(`${positionPath}.key_first_values`, leftPosition.key_first_values, rightPosition.key_first_values),
        compareNumberArrays(`${positionPath}.value_first_values`, leftPosition.value_first_values, rightPosition.value_first_values),
      )
      if (leftPosition.reconstructed_score !== undefined || rightPosition.reconstructed_score !== undefined) {
        comparisons.push(
          compareNumberScalar(`${positionPath}.reconstructed_score`, leftPosition.reconstructed_score, rightPosition.reconstructed_score),
          compareNumberScalar(`${positionPath}.score_reconstruction_delta`, leftPosition.score_reconstruction_delta, rightPosition.score_reconstruction_delta),
          compareNumberArrays(`${positionPath}.qk_products_first_values`, leftPosition.qk_products_first_values, rightPosition.qk_products_first_values),
          compareExact(`${positionPath}.qk_products_max_abs_window_start`, leftPosition.qk_products_max_abs_window_start, rightPosition.qk_products_max_abs_window_start),
          compareNumberArrays(`${positionPath}.qk_products_max_abs_window`, leftPosition.qk_products_max_abs_window, rightPosition.qk_products_max_abs_window),
        )
      }
    }
  }

  return comparisons
}

function compareExact(path, left, right) {
  if (left !== right) return { path, ok: false, reason: 'exact_value_mismatch', left, right }
  return { path, ok: true }
}

function compareNumberScalar(path, left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return { path, ok: false, reason: 'number_missing_or_non_finite', left, right }
  const diff = Math.abs(left - right)
  const tolerance = absoluteTolerance + relativeTolerance * Math.max(Math.abs(left), Math.abs(right))
  if (diff > tolerance) return { path, ok: false, reason: 'sample_value_mismatch', left, right, max_abs_diff: diff }
  return { path, ok: true, max_abs_diff: diff }
}

function compareNumberArrays(path, left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return { path, ok: false, reason: 'sample_array_missing' }
  if (left.length !== right.length) return { path, ok: false, reason: 'sample_length_mismatch', left_len: left.length, right_len: right.length }
  let maxAbsDiff = 0
  let firstDiffIndex = -1
  for (let i = 0; i < left.length; i += 1) {
    const diff = Math.abs(left[i] - right[i])
    const tolerance = absoluteTolerance + relativeTolerance * Math.max(Math.abs(left[i]), Math.abs(right[i]))
    if (diff > maxAbsDiff) maxAbsDiff = diff
    if (diff > tolerance && firstDiffIndex === -1) firstDiffIndex = i
  }
  if (firstDiffIndex !== -1) {
    return {
      path,
      ok: false,
      reason: 'sample_value_mismatch',
      first_diff_index: firstDiffIndex,
      left: left[firstDiffIndex],
      right: right[firstDiffIndex],
      max_abs_diff: maxAbsDiff,
    }
  }
  return { path, ok: true, max_abs_diff: maxAbsDiff }
}

function getPath(value, path) {
  return path.split('.').reduce((current, part) => current?.[part], value)
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}
