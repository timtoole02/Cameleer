#!/usr/bin/env node
import fs from 'node:fs'

const args = parseArgs(process.argv.slice(2))
if (!args.left || !args.right) usage()

const left = loadCapture(args.left)
const right = loadCapture(args.right)
const topN = Number.parseInt(args.top || '20', 10)
const report = compareCaptures(left, right, { topN: Number.isFinite(topN) && topN > 0 ? topN : 20 })

if (args['json-out']) fs.writeFileSync(args['json-out'], `${JSON.stringify(report, null, 2)}\n`)

console.log(`left=${args.left}`)
console.log(`right=${args.right}`)
console.log(`prompt_tokens_match=${report.prompt_tokens_match}`)
console.log(`generated_token_delta=${JSON.stringify(report.generated_token_delta)}`)
console.log(`dense_metadata_delta_count=${report.dense_metadata_deltas.length}`)
console.log(`dense_layout_metadata_deltas=${JSON.stringify(report.dense_layout_metadata_deltas.slice(0, Math.min(8, report.dense_layout_metadata_deltas.length)))}`)
if (report.first_changed_stage) console.log(`first_changed_stage=${report.first_changed_stage.path}`)
else console.log('first_changed_stage=none')
console.log(`largest_stage_deltas=${JSON.stringify(report.largest_stage_deltas.slice(0, Math.min(8, report.largest_stage_deltas.length)))}`)
console.log(`largest_residual_metric_deltas=${JSON.stringify(report.largest_residual_metric_deltas.slice(0, Math.min(8, report.largest_residual_metric_deltas.length)))}`)
console.log(`largest_reconstruction_deltas=${JSON.stringify(report.largest_reconstruction_deltas.slice(0, Math.min(8, report.largest_reconstruction_deltas.length)))}`)
console.log(`largest_attention_trace_deltas=${JSON.stringify(report.largest_attention_trace_deltas.slice(0, Math.min(8, report.largest_attention_trace_deltas.length)))}`)
console.log(`output_projection_token_deltas=${JSON.stringify(report.output_projection_token_deltas)}`)

function usage() {
  console.error('usage: node scripts/compare-dense-stage-flow.mjs --left <capture.json> --right <capture.json> [--top 20] [--json-out <report.json>]')
  console.error('compares two Camelid dense diagnostic captures and ranks pre-sampler stage statistic/checkpoint, attention-trace, shape, and layout metadata deltas')
  process.exit(1)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) usage()
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) usage()
    out[key] = value
    i++
  }
  return out
}

function loadCapture(path) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'))
  const root = raw.camelid || raw.backend_chat?.camelid || raw
  const dense = root.dense
  if (!dense || typeof dense !== 'object') throw new Error(`${path}: missing camelid.dense diagnostics; rerun with camelid_dense_diagnostics=true`)
  return { path, raw, root, dense }
}

function compareCaptures(left, right, { topN }) {
  const stageDeltas = compareStages(left.dense, right.dense)
  const meaningful = stageDeltas.filter(delta => delta.changed)
  const sorted = meaningful
    .slice()
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, topN)
  return {
    prompt_tokens_match: arraysEqual(left.root.prompt_token_ids, right.root.prompt_token_ids),
    generated_token_delta: {
      left: left.root.generated_token_ids || [],
      right: right.root.generated_token_ids || [],
      match: arraysEqual(left.root.generated_token_ids, right.root.generated_token_ids),
    },
    dense_metadata_deltas: compareMetadata(left.root.dense_metadata || {}, right.root.dense_metadata || {}),
    dense_layout_metadata_deltas: compareLayoutMetadata(left.root.dense_metadata || {}, right.root.dense_metadata || {}),
    first_changed_stage: meaningful[0] || null,
    largest_stage_deltas: sorted,
    largest_residual_metric_deltas: compareResidualMetrics(left.dense, right.dense, topN),
    largest_reconstruction_deltas: compareReconstructionMetrics(left.dense, right.dense, topN),
    largest_attention_trace_deltas: compareAttentionTraceMetrics(left.dense, right.dense, topN),
    output_projection_token_deltas: compareOutputProjection(left.root.output_projection || [], right.root.output_projection || []),
    stage_delta_count: stageDeltas.length,
    changed_stage_delta_count: meaningful.length,
  }
}

function compareMetadata(left, right) {
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort()
  return keys
    .map(key => ({ key, left: left[key] ?? null, right: right[key] ?? null }))
    .filter(delta => JSON.stringify(delta.left) !== JSON.stringify(delta.right))
}

function compareLayoutMetadata(left, right) {
  const leftFlat = flattenMetadata(left)
  const rightFlat = flattenMetadata(right)
  const keys = Array.from(new Set([...Object.keys(leftFlat), ...Object.keys(rightFlat)])).sort()
  return keys
    .map(path => ({ path, left: leftFlat[path] ?? null, right: rightFlat[path] ?? null }))
    .filter(delta => JSON.stringify(delta.left) !== JSON.stringify(delta.right))
}

function flattenMetadata(value, prefix = '', out = {}) {
  if (Array.isArray(value)) {
    out[prefix] = value
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenMetadata(child, prefix ? `${prefix}.${key}` : key, out)
    }
    return out
  }
  if (prefix) out[prefix] = value
  return out
}

function compareStages(leftDense, rightDense) {
  const out = []
  // Keep this in forward-pass order so first_changed_stage is a useful parity breadcrumb.
  out.push(compareStats('embedding', leftDense?.embedding, rightDense?.embedding))
  const layerCount = Math.max(leftDense.layers?.length || 0, rightDense.layers?.length || 0)
  const layerStages = [
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
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
    const leftLayer = leftDense.layers?.[layerIndex]
    const rightLayer = rightDense.layers?.[layerIndex]
    for (const stage of layerStages) {
      out.push(compareStats(`layers.${layerIndex}.${stage}`, getPath(leftLayer, stage), getPath(rightLayer, stage)))
    }
  }
  for (const stage of ['final_hidden', 'output_norm', 'logits']) {
    out.push(compareStats(stage, leftDense?.[stage], rightDense?.[stage]))
  }
  return out
}

function compareStats(path, left, right) {
  if (!left || !right) return { path, changed: true, score: Number.POSITIVE_INFINITY, reason: !left ? 'missing_left' : 'missing_right' }
  const leftShape = left.shape ?? left.checkpoint?.shape ?? null
  const rightShape = right.shape ?? right.checkpoint?.shape ?? null
  const leftCheckpointShape = left.checkpoint?.shape ?? null
  const rightCheckpointShape = right.checkpoint?.shape ?? null
  const numeric = {}
  for (const field of ['min', 'max', 'mean', 'rms', 'max_abs']) {
    numeric[`${field}_delta`] = absDelta(left[field], right[field])
  }
  const shapeDeltas = {
    shape_match: arraysEqualNullable(leftShape, rightShape),
    len_match: (left.len ?? null) === (right.len ?? null),
    checkpoint_shape_match: arraysEqualNullable(leftCheckpointShape, rightCheckpointShape),
    checkpoint_len_match: (left.checkpoint?.len ?? null) === (right.checkpoint?.len ?? null),
  }
  const indexDeltas = {
    min_index_match: left.min_index === right.min_index,
    max_index_match: left.max_index === right.max_index,
    max_abs_index_match: left.max_abs_index === right.max_abs_index,
    checkpoint_max_abs_window_start_match: left.checkpoint?.max_abs_window_start === right.checkpoint?.max_abs_window_start,
  }
  const firstValuesDelta = maxArrayAbsDelta(left.checkpoint?.first_values, right.checkpoint?.first_values)
  const maxAbsWindowDelta = maxArrayAbsDelta(left.checkpoint?.max_abs_window, right.checkpoint?.max_abs_window)
  const score = Math.max(...Object.values(numeric).filter(Number.isFinite), firstValuesDelta, maxAbsWindowDelta)
  const changed = score > 0 || Object.values(indexDeltas).some(value => value === false) || Object.values(shapeDeltas).some(value => value === false)
  return {
    path,
    changed,
    score,
    left_shape: leftShape,
    right_shape: rightShape,
    left_len: left.len ?? null,
    right_len: right.len ?? null,
    left_checkpoint_shape: leftCheckpointShape,
    right_checkpoint_shape: rightCheckpointShape,
    left_checkpoint_len: left.checkpoint?.len ?? null,
    right_checkpoint_len: right.checkpoint?.len ?? null,
    ...numeric,
    ...shapeDeltas,
    first_values_max_abs_delta: firstValuesDelta,
    max_abs_window_max_abs_delta: maxAbsWindowDelta,
    ...indexDeltas,
  }
}


function compareResidualMetrics(leftDense, rightDense, topN) {
  const out = []
  const layerCount = Math.max(leftDense.layers?.length || 0, rightDense.layers?.length || 0)
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
    for (const branch of ['attention_delta', 'ffn_delta']) {
      const left = leftDense.layers?.[layerIndex]?.residual_flow?.[branch]
      const right = rightDense.layers?.[layerIndex]?.residual_flow?.[branch]
      const path = `layers.${layerIndex}.residual_flow.${branch}`
      if (!left || !right) {
        out.push({ path, changed: true, score: Number.POSITIVE_INFINITY, reason: !left ? 'missing_left' : 'missing_right' })
        continue
      }
      const deltas = {
        input_rms_delta: absDelta(left.input_rms, right.input_rms),
        delta_rms_delta: absDelta(left.delta_rms, right.delta_rms),
        reported_rms_delta: absDelta(left.reported_rms, right.reported_rms),
        delta_to_input_rms_ratio_delta: absDelta(left.delta_to_input_rms_ratio, right.delta_to_input_rms_ratio),
        delta_input_cosine_similarity_delta: absDelta(left.delta_input_cosine_similarity, right.delta_input_cosine_similarity),
        max_abs_delta_delta: absDelta(left.max_abs_delta, right.max_abs_delta),
      }
      out.push(metricDelta(path, deltas))
    }
  }
  return rankMetricDeltas(out, topN)
}

function compareReconstructionMetrics(leftDense, rightDense, topN) {
  const out = []
  const layerCount = Math.max(leftDense.layers?.length || 0, rightDense.layers?.length || 0)
  const fields = [
    'attention_norm_reconstruction',
    'attention_q_reconstruction',
    'attention_k_reconstruction',
    'attention_q_rope_reconstruction',
    'attention_k_rope_reconstruction',
    'attention_v_reconstruction',
    'attention_o_reconstruction',
    'ffn_norm_reconstruction',
    'ffn_gate_reconstruction',
    'ffn_up_reconstruction',
    'ffn_activation_reconstruction',
    'ffn_down_reconstruction',
  ]
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
    for (const field of fields) {
      const left = leftDense.layers?.[layerIndex]?.[field]
      const right = rightDense.layers?.[layerIndex]?.[field]
      const path = `layers.${layerIndex}.${field}`
      if (!left && !right) continue
      if (!left || !right) {
        out.push({ path, changed: true, score: Number.POSITIVE_INFINITY, reason: !left ? 'missing_left' : 'missing_right' })
        continue
      }
      out.push(metricDelta(path, {
        max_abs_delta_delta: absDelta(left.max_abs_delta, right.max_abs_delta),
        reported_max_abs_delta: absDelta(left.reported_max_abs, right.reported_max_abs),
        reported_max_abs_index_match: left.reported_max_abs_index === right.reported_max_abs_index,
        reported_max_abs_window_delta: maxArrayAbsDelta(left.reported_max_abs_window, right.reported_max_abs_window),
        reconstructed_window_delta: maxArrayAbsDelta(
          left.reconstructed_reported_max_abs_window || left.reconstructed_output_max_abs_window,
          right.reconstructed_reported_max_abs_window || right.reconstructed_output_max_abs_window,
        ),
      }))
    }
  }
  out.push(metricDelta('final_norm', {
    max_abs_delta_delta: absDelta(leftDense.final_norm?.max_abs_delta, rightDense.final_norm?.max_abs_delta),
    reported_max_abs_delta: absDelta(leftDense.final_norm?.reported_max_abs, rightDense.final_norm?.reported_max_abs),
    reported_max_abs_index_match: leftDense.final_norm?.reported_max_abs_index === rightDense.final_norm?.reported_max_abs_index,
    reported_max_abs_window_delta: maxArrayAbsDelta(leftDense.final_norm?.reported_max_abs_window, rightDense.final_norm?.reported_max_abs_window),
    reconstructed_window_delta: maxArrayAbsDelta(leftDense.final_norm?.reconstructed_reported_max_abs_window, rightDense.final_norm?.reconstructed_reported_max_abs_window),
  }))
  return rankMetricDeltas(out, topN)
}

function metricDelta(path, deltas) {
  const numericScores = Object.values(deltas).filter(value => typeof value === 'number' && Number.isFinite(value))
  const score = numericScores.length > 0 ? Math.max(...numericScores) : 0
  return {
    path,
    changed: score > 0 || Object.values(deltas).some(value => value === false),
    score,
    ...deltas,
  }
}

function rankMetricDeltas(deltas, topN) {
  return deltas
    .filter(delta => delta.changed)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, topN)
}

function compareAttentionTraceMetrics(leftDense, rightDense, topN) {
  const out = []
  const layerCount = Math.max(leftDense.layers?.length || 0, rightDense.layers?.length || 0)
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
    const left = leftDense.layers?.[layerIndex]?.attention_trace
    const right = rightDense.layers?.[layerIndex]?.attention_trace
    const path = `layers.${layerIndex}.attention_trace`
    if (!left && !right) continue
    if (!left || !right) {
      out.push({
        path,
        layer_index: layerIndex,
        attention_head: null,
        kv_head: null,
        changed: true,
        score: Number.POSITIVE_INFINITY,
        dominant_metric: !left ? 'missing_left' : 'missing_right',
        max_abs_delta: Number.POSITIVE_INFINITY,
        first_position_diff_index: null,
        reason: !left ? 'missing_left' : 'missing_right',
      })
      continue
    }

    const traceMetadata = attentionTraceMetadataDelta(path, layerIndex, left, right)
    if (traceMetadata.changed) out.push(traceMetadata)

    const leftHeads = left.heads || []
    const rightHeads = right.heads || []
    const headCount = Math.min(leftHeads.length, rightHeads.length)
    for (let headIndex = 0; headIndex < headCount; headIndex++) {
      out.push(attentionHeadDelta(`${path}.heads.${headIndex}`, layerIndex, leftHeads[headIndex], rightHeads[headIndex]))
    }
  }
  return rankMetricDeltas(out, topN)
}

function attentionTraceMetadataDelta(path, layerIndex, left, right) {
  const scaleDelta = absDelta(left.scale, right.scale)
  const mismatches = {
    position_count_match: left.position_count === right.position_count,
    head_dim_match: left.head_dim === right.head_dim,
    sampled_head_count_match: (left.heads?.length || 0) === (right.heads?.length || 0),
  }
  const metadataMismatch = Object.values(mismatches).some(value => value === false)
  const scaleAbsDelta = Number.isFinite(scaleDelta) ? scaleDelta : 0
  return {
    path,
    layer_index: layerIndex,
    attention_head: null,
    kv_head: null,
    changed: scaleAbsDelta > 0 || metadataMismatch,
    score: Math.max(scaleAbsDelta, metadataMismatch ? 1 : 0),
    dominant_metric: scaleAbsDelta > 0 ? 'scale_abs_delta' : 'trace_metadata_mismatch',
    max_abs_delta: scaleAbsDelta,
    first_position_diff_index: null,
    scale_abs_delta: scaleAbsDelta,
    ...mismatches,
  }
}

function attentionHeadDelta(path, layerIndex, left, right) {
  const positionDelta = attentionPositionDelta(left.positions || [], right.positions || [])
  const deltas = {
    query_first_values_max_abs_diff: maxArrayAbsDelta(left.query_first_values, right.query_first_values),
    context_first_values_max_abs_diff: maxArrayAbsDelta(left.context_first_values, right.context_first_values),
    reconstructed_context_first_values_max_abs_diff: maxArrayAbsDelta(left.reconstructed_context_first_values, right.reconstructed_context_first_values),
    context_reconstruction_max_abs_delta_abs_delta: absDelta(left.context_reconstruction_max_abs_delta, right.context_reconstruction_max_abs_delta),
    probability_entropy_abs_delta: absDelta(left.probability_entropy, right.probability_entropy),
    probability_rms_abs_delta: absDelta(left.probability_rms, right.probability_rms),
    score_max_abs_diff: positionDelta.score_max_abs_diff,
    probability_max_abs_diff: positionDelta.probability_max_abs_diff,
  }
  const metrics = Object.fromEntries(
    Object.entries(deltas).map(([key, value]) => [key, Number.isFinite(value) ? value : 0]),
  )
  const [numericDominantMetric, numericMaxAbsDelta] = Object.entries(metrics).reduce(
    (best, entry) => (entry[1] > best[1] ? entry : best),
    ['none', 0],
  )
  const headMetadata = {
    attention_head_match: left.attention_head === right.attention_head,
    kv_head_match: left.kv_head === right.kv_head,
    sampled_position_count_match: (left.positions?.length || 0) === (right.positions?.length || 0),
  }
  const metadataMismatch = Object.values(headMetadata).some(value => value === false)
  const dominantMetric = numericMaxAbsDelta > 0 ? numericDominantMetric : metadataMismatch ? 'head_metadata_mismatch' : 'none'
  return {
    path,
    layer_index: layerIndex,
    attention_head: left.attention_head ?? null,
    kv_head: left.kv_head ?? null,
    changed: numericMaxAbsDelta > 0 || metadataMismatch,
    score: Math.max(numericMaxAbsDelta, metadataMismatch ? 1 : 0),
    dominant_metric: dominantMetric,
    max_abs_delta: numericMaxAbsDelta,
    first_position_diff_index: positionDelta.first_position_diff_index,
    metrics,
    ...headMetadata,
  }
}

function attentionPositionDelta(leftPositions, rightPositions) {
  const positionCount = Math.min(leftPositions.length, rightPositions.length)
  let scoreMaxAbsDiff = 0
  let probabilityMaxAbsDiff = 0
  let firstPositionDiffIndex = -1
  for (let i = 0; i < positionCount; i++) {
    const scoreDiff = absDelta(leftPositions[i].score, rightPositions[i].score)
    const probabilityDiff = absDelta(leftPositions[i].probability, rightPositions[i].probability)
    const finiteScoreDiff = Number.isFinite(scoreDiff) ? scoreDiff : 0
    const finiteProbabilityDiff = Number.isFinite(probabilityDiff) ? probabilityDiff : 0
    if (finiteScoreDiff > scoreMaxAbsDiff) scoreMaxAbsDiff = finiteScoreDiff
    if (finiteProbabilityDiff > probabilityMaxAbsDiff) probabilityMaxAbsDiff = finiteProbabilityDiff
    if (firstPositionDiffIndex === -1 && (finiteScoreDiff > 0 || finiteProbabilityDiff > 0)) firstPositionDiffIndex = i
  }
  return {
    score_max_abs_diff: scoreMaxAbsDiff,
    probability_max_abs_diff: probabilityMaxAbsDiff,
    first_position_diff_index: firstPositionDiffIndex === -1 ? null : firstPositionDiffIndex,
  }
}


function compareOutputProjection(leftRows, rightRows) {
  const rightByToken = new Map(rightRows.map(row => [row.token_id, row]))
  return leftRows
    .filter(row => rightByToken.has(row.token_id))
    .map(leftRow => {
      const rightRow = rightByToken.get(leftRow.token_id)
      return {
        token_id: leftRow.token_id,
        reported_logit_delta: absDelta(leftRow.reported_logit, rightRow.reported_logit),
        reconstructed_logit_delta: absDelta(leftRow.reconstructed_logit, rightRow.reconstructed_logit),
        max_abs_component_index_match: leftRow.max_abs_component_index === rightRow.max_abs_component_index,
        max_abs_component_delta: absDelta(leftRow.max_abs_component, rightRow.max_abs_component),
      }
    })
}

function getPath(value, path) {
  return path.split('.').reduce((current, part) => current?.[part], value)
}

function absDelta(left, right) {
  return Number.isFinite(left) && Number.isFinite(right) ? Math.abs(left - right) : Number.NaN
}

function arraysEqualNullable(left, right) {
  if (left == null && right == null) return true
  if (!Array.isArray(left) || !Array.isArray(right)) return false
  return arraysEqual(left, right)
}

function maxArrayAbsDelta(left = [], right = []) {
  const len = Math.max(left.length, right.length)
  let max = 0
  for (let i = 0; i < len; i++) {
    const delta = absDelta(left[i], right[i])
    if (Number.isFinite(delta) && delta > max) max = delta
    else if (!Number.isFinite(delta)) return Number.POSITIVE_INFINITY
  }
  return max
}

function arraysEqual(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
