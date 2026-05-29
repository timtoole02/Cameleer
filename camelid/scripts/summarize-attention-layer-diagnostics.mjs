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

if (!args.has('left')) {
  console.error('usage: node scripts/summarize-attention-layer-diagnostics.mjs --left <diagnostics.json> [--right <diagnostics.json>] [--layers 0,2] [--json-out <path>]')
  console.error('summarizes selected-layer dense attention/residual diagnostics and, when --right is provided, reports compact deltas for layer sanity checks')
  process.exit(2)
}

const leftPath = resolve(args.get('left'))
const rightPath = args.has('right') ? resolve(args.get('right')) : null
const selectedLayers = parseLayerList(args.get('layers') || '0,2')
const jsonOut = args.get('json-out')

const left = await loadDiagnostics(leftPath)
const right = rightPath ? await loadDiagnostics(rightPath) : null
const report = {
  left: leftPath,
  right: rightPath,
  layers: selectedLayers,
  generated_tokens: {
    left: left.root?.generated_token_ids || [],
    right: right?.root?.generated_token_ids || [],
    match: right ? jsonEqual(left.root?.generated_token_ids || [], right.root?.generated_token_ids || []) : null,
  },
  top_logits: {
    left: (left.root?.top_logits || []).slice(0, 5),
    right: right ? (right.root?.top_logits || []).slice(0, 5) : [],
  },
  layer_summaries: selectedLayers.map(layerIndex => summarizeLayerPair(layerIndex, left, right)),
}

printReport(report)

if (jsonOut) {
  await writeFile(resolve(jsonOut), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`json_out=${resolve(jsonOut)}`)
}

function parseLayerList(value) {
  const parsed = value.split(',').map(item => Number.parseInt(item.trim(), 10)).filter(Number.isInteger)
  if (parsed.length === 0 || parsed.some(item => item < 0)) throw new Error(`--layers must be a comma-separated list of non-negative layer indexes, got ${value}`)
  return [...new Set(parsed)]
}

async function loadDiagnostics(path) {
  const json = JSON.parse(await readFile(path, 'utf8'))
  const root = json.camelid || json
  const dense = root.dense
  if (!dense || !Array.isArray(dense.layers)) throw new Error(`${path} does not contain camelid.dense.layers diagnostics`)
  return { path, json, root, dense }
}

function summarizeLayerPair(layerIndex, left, right) {
  const leftLayer = left.dense.layers[layerIndex]
  const rightLayer = right?.dense.layers[layerIndex]
  if (!leftLayer) return { layer_index: layerIndex, missing_left: true }
  return {
    layer_index: layerIndex,
    left: summarizeLayer(leftLayer),
    right: rightLayer ? summarizeLayer(rightLayer) : null,
    deltas: rightLayer ? diffLayer(leftLayer, rightLayer) : null,
  }
}

function summarizeLayer(layer) {
  return {
    residual_flow: {
      attention_residual_reconstruction: summarizeResidualDelta(layer.residual_flow?.attention_delta),
      ffn_residual_reconstruction: summarizeResidualDelta(layer.residual_flow?.ffn_delta),
    },
    stages: Object.fromEntries(stageNames().map(name => [name, summarizeStage(layer[name])])),
    attention_trace: summarizeAttentionTrace(layer.attention_trace),
  }
}

function summarizeStage(stage) {
  if (!stage) return null
  return {
    rms: finiteOrNull(stage.rms),
    max_abs: finiteOrNull(stage.max_abs),
    max_abs_index: stage.max_abs_index ?? null,
    checkpoint_first_values: firstNumbers(stage.checkpoint?.first_values),
    checkpoint_max_abs_window_start: stage.checkpoint?.max_abs_window_start ?? null,
    checkpoint_max_abs_window: firstNumbers(stage.checkpoint?.max_abs_window),
  }
}

function summarizeResidualDelta(delta) {
  if (!delta) return null
  return {
    max_abs_delta: finiteOrNull(delta.max_abs_delta),
    max_abs_delta_index: delta.max_abs_delta_index ?? null,
    delta_first_values: firstNumbers(delta.delta_first_values),
    reconstructed_matches_reported: arraysEqual(delta.reconstructed_first_values, delta.reported_first_values),
  }
}

function summarizeAttentionTrace(trace) {
  if (!trace) return null
  const heads = trace.heads || []
  return {
    scale: finiteOrNull(trace.scale),
    position_count: trace.position_count ?? null,
    head_dim: trace.head_dim ?? null,
    sampled_head_count: heads.length,
    heads: heads.map(head => ({
      attention_head: head.attention_head,
      kv_head: head.kv_head,
      query_first_values: firstNumbers(head.query_first_values),
      context_first_values: firstNumbers(head.context_first_values),
      reconstructed_context_first_values: firstNumbers(head.reconstructed_context_first_values),
      context_reconstruction_max_abs_delta: finiteOrNull(head.context_reconstruction_max_abs_delta),
      context_reconstruction_max_abs_delta_index: head.context_reconstruction_max_abs_delta_index ?? null,
      probability_sum: finiteOrNull(head.probability_sum) ?? sum((head.positions || []).map(position => position.probability)),
      probability_entropy: finiteOrNull(head.probability_entropy),
      probability_rms: finiteOrNull(head.probability_rms),
      max_probability: finiteOrNull(head.max_probability) ?? max((head.positions || []).map(position => position.probability)),
      max_probability_position: head.max_probability_position ?? maxBy(head.positions || [], position => position.probability)?.position ?? null,
      first_position_score: finiteOrNull(head.positions?.[0]?.score),
      first_position_reconstructed_score: finiteOrNull(head.positions?.[0]?.reconstructed_score),
      first_position_score_reconstruction_delta: finiteOrNull(head.positions?.[0]?.score_reconstruction_delta),
      first_position_probability: finiteOrNull(head.positions?.[0]?.probability),
      first_position_key_first_values: firstNumbers(head.positions?.[0]?.key_first_values),
      first_position_qk_products_first_values: firstNumbers(head.positions?.[0]?.qk_products_first_values),
      first_position_qk_products_max_abs_window_start: head.positions?.[0]?.qk_products_max_abs_window_start ?? null,
      first_position_qk_products_max_abs_window: firstNumbers(head.positions?.[0]?.qk_products_max_abs_window),
      first_position_value_first_values: firstNumbers(head.positions?.[0]?.value_first_values),
    })),
  }
}

function diffLayer(leftLayer, rightLayer) {
  const stageDiffs = Object.fromEntries(stageNames().map(name => [name, diffStage(leftLayer[name], rightLayer[name])]))
  const attentionTraceDiff = diffAttentionTrace(leftLayer.attention_trace, rightLayer.attention_trace)
  return {
    residual_flow: {
      attention_residual_reconstruction: diffResidualDelta(leftLayer.residual_flow?.attention_delta, rightLayer.residual_flow?.attention_delta),
      ffn_residual_reconstruction: diffResidualDelta(leftLayer.residual_flow?.ffn_delta, rightLayer.residual_flow?.ffn_delta),
    },
    stages: stageDiffs,
    largest_stage_deltas: largestStageDeltas(stageDiffs),
    attention_trace: attentionTraceDiff,
    largest_attention_trace_deltas: largestAttentionTraceDeltas(attentionTraceDiff),
    first_changed_stage: Object.entries(stageDiffs).find(([, diff]) => diff?.max_abs_diff > 0)?.[0] || null,
  }
}

function diffStage(left, right) {
  if (!left && !right) return null
  if (!left || !right) return { comparable: false, reason: !left ? 'missing_left' : 'missing_right' }
  const first = diffArrays(left.checkpoint?.first_values, right.checkpoint?.first_values)
  const window = diffArrays(left.checkpoint?.max_abs_window, right.checkpoint?.max_abs_window)
  return {
    comparable: true,
    rms_delta: numericDelta(left.rms, right.rms),
    max_abs_delta: numericDelta(left.max_abs, right.max_abs),
    first_values_max_abs_diff: first.max_abs_diff,
    first_values_first_diff_index: first.first_diff_index,
    max_abs_window_start_match: left.checkpoint?.max_abs_window_start === right.checkpoint?.max_abs_window_start,
    max_abs_window_max_abs_diff: window.max_abs_diff,
    max_abs_diff: Math.max(first.max_abs_diff ?? 0, window.max_abs_diff ?? 0, Math.abs(numericDelta(left.rms, right.rms) ?? 0)),
  }
}

function largestStageDeltas(stageDiffs, limit = 8) {
  return Object.entries(stageDiffs)
    .filter(([, diff]) => diff?.comparable && finiteOrZero(diff.max_abs_diff) > 0)
    .map(([stage, diff]) => {
      const metrics = {
        rms_abs_delta: Math.abs(finiteOrZero(diff.rms_delta)),
        max_abs_abs_delta: Math.abs(finiteOrZero(diff.max_abs_delta)),
        first_values_max_abs_diff: finiteOrZero(diff.first_values_max_abs_diff),
        max_abs_window_max_abs_diff: finiteOrZero(diff.max_abs_window_max_abs_diff),
      }
      const [dominant_metric, max_abs_delta] = Object.entries(metrics).reduce(
        (best, entry) => (entry[1] > best[1] ? entry : best),
        ['none', 0],
      )
      return {
        stage,
        dominant_metric,
        max_abs_delta,
        first_values_first_diff_index: diff.first_values_first_diff_index,
        max_abs_window_start_match: diff.max_abs_window_start_match,
        metrics,
      }
    })
    .sort((left, right) => right.max_abs_delta - left.max_abs_delta)
    .slice(0, limit)
}

function diffResidualDelta(left, right) {
  if (!left && !right) return null
  if (!left || !right) return { comparable: false, reason: !left ? 'missing_left' : 'missing_right' }
  const delta = diffArrays(left.delta_first_values, right.delta_first_values)
  return {
    comparable: true,
    max_abs_delta_delta: numericDelta(left.max_abs_delta, right.max_abs_delta),
    max_abs_delta_index_match: left.max_abs_delta_index === right.max_abs_delta_index,
    delta_first_values_max_abs_diff: delta.max_abs_diff,
    delta_first_values_first_diff_index: delta.first_diff_index,
  }
}

function diffAttentionTrace(left, right) {
  if (!left && !right) return null
  if (!left || !right) return { comparable: false, reason: !left ? 'missing_left' : 'missing_right' }
  const headCount = Math.min(left.heads?.length || 0, right.heads?.length || 0)
  return {
    comparable: true,
    scale_delta: numericDelta(left.scale, right.scale),
    position_count_match: left.position_count === right.position_count,
    head_dim_match: left.head_dim === right.head_dim,
    heads: Array.from({ length: headCount }, (_, index) => diffAttentionHead(left.heads[index], right.heads[index])),
  }
}

function diffAttentionHead(left, right) {
  const query = diffArrays(left.query_first_values, right.query_first_values)
  const context = diffArrays(left.context_first_values, right.context_first_values)
  const reconstructedContext = diffArrays(left.reconstructed_context_first_values, right.reconstructed_context_first_values)
  const leftPositions = left.positions || []
  const rightPositions = right.positions || []
  const positionCount = Math.min(leftPositions.length, rightPositions.length)
  let scoreMaxAbsDiff = 0
  let probabilityMaxAbsDiff = 0
  let firstPositionDiff = -1
  for (let i = 0; i < positionCount; i += 1) {
    const scoreDiff = Math.abs((leftPositions[i].score ?? 0) - (rightPositions[i].score ?? 0))
    const probabilityDiff = Math.abs((leftPositions[i].probability ?? 0) - (rightPositions[i].probability ?? 0))
    if (scoreDiff > scoreMaxAbsDiff) scoreMaxAbsDiff = scoreDiff
    if (probabilityDiff > probabilityMaxAbsDiff) probabilityMaxAbsDiff = probabilityDiff
    if (firstPositionDiff === -1 && (scoreDiff > 0 || probabilityDiff > 0)) firstPositionDiff = i
  }
  return {
    attention_head: left.attention_head,
    kv_head: left.kv_head,
    query_first_values_max_abs_diff: query.max_abs_diff,
    context_first_values_max_abs_diff: context.max_abs_diff,
    reconstructed_context_first_values_max_abs_diff: reconstructedContext.max_abs_diff,
    context_reconstruction_max_abs_delta_delta: numericDelta(left.context_reconstruction_max_abs_delta, right.context_reconstruction_max_abs_delta),
    probability_entropy_delta: numericDelta(left.probability_entropy, right.probability_entropy),
    probability_rms_delta: numericDelta(left.probability_rms, right.probability_rms),
    score_max_abs_diff: scoreMaxAbsDiff,
    probability_max_abs_diff: probabilityMaxAbsDiff,
    first_position_diff_index: firstPositionDiff,
  }
}

function largestAttentionTraceDeltas(traceDiff, limit = 8) {
  if (!traceDiff?.comparable || !Array.isArray(traceDiff.heads)) return []
  return traceDiff.heads
    .map(head => {
      const metrics = {
        query_first_values_max_abs_diff: finiteOrZero(head.query_first_values_max_abs_diff),
        context_first_values_max_abs_diff: finiteOrZero(head.context_first_values_max_abs_diff),
        reconstructed_context_first_values_max_abs_diff: finiteOrZero(head.reconstructed_context_first_values_max_abs_diff),
        context_reconstruction_max_abs_delta_abs_delta: Math.abs(finiteOrZero(head.context_reconstruction_max_abs_delta_delta)),
        probability_entropy_abs_delta: Math.abs(finiteOrZero(head.probability_entropy_delta)),
        probability_rms_abs_delta: Math.abs(finiteOrZero(head.probability_rms_delta)),
        score_max_abs_diff: finiteOrZero(head.score_max_abs_diff),
        probability_max_abs_diff: finiteOrZero(head.probability_max_abs_diff),
      }
      const [dominant_metric, max_abs_delta] = Object.entries(metrics).reduce(
        (best, entry) => (entry[1] > best[1] ? entry : best),
        ['none', 0],
      )
      return {
        attention_head: head.attention_head,
        kv_head: head.kv_head,
        dominant_metric,
        max_abs_delta,
        first_position_diff_index: head.first_position_diff_index,
        metrics,
      }
    })
    .filter(head => head.max_abs_delta > 0)
    .sort((left, right) => right.max_abs_delta - left.max_abs_delta)
    .slice(0, limit)
}

function stageNames() {
  return [
    'attention_norm',
    'attention_q',
    'attention_k',
    'attention_q_rope',
    'attention_k_rope',
    'attention_v',
    'attention_context',
    'attention_output',
    'attention_residual',
    'ffn_norm',
    'ffn_gate',
    'ffn_up',
    'ffn_activation',
    'ffn_output',
    'ffn_residual',
  ]
}

function printReport(report) {
  console.log(`left=${report.left}`)
  if (report.right) console.log(`right=${report.right}`)
  console.log(`layers=${report.layers.join(',')}`)
  console.log(`generated_tokens_left=${JSON.stringify(report.generated_tokens.left)}`)
  if (report.right) {
    console.log(`generated_tokens_right=${JSON.stringify(report.generated_tokens.right)}`)
    console.log(`generated_tokens_match=${report.generated_tokens.match}`)
  }
  for (const layer of report.layer_summaries) {
    console.log(`layer=${layer.layer_index}`)
    if (layer.missing_left) {
      console.log('  missing_left=true')
      continue
    }
    console.log(`  left_attention_residual_reconstruction_error=${layer.left.residual_flow.attention_residual_reconstruction?.max_abs_delta ?? 'n/a'}`)
    console.log(`  left_attention_output_rms=${layer.left.stages.attention_output?.rms ?? 'n/a'}`)
    console.log(`  left_attention_trace_head0_prob_sum=${layer.left.attention_trace?.heads?.[0]?.probability_sum ?? 'n/a'}`)
    if (layer.right) {
      console.log(`  right_attention_residual_reconstruction_error=${layer.right.residual_flow.attention_residual_reconstruction?.max_abs_delta ?? 'n/a'}`)
      console.log(`  right_attention_output_rms=${layer.right.stages.attention_output?.rms ?? 'n/a'}`)
      console.log(`  first_changed_stage=${layer.deltas.first_changed_stage ?? 'none'}`)
      console.log(`  largest_stage_deltas=${JSON.stringify(layer.deltas.largest_stage_deltas.slice(0, 3))}`)
      console.log(`  attention_output_first_values_max_abs_diff=${layer.deltas.stages.attention_output?.first_values_max_abs_diff ?? 'n/a'}`)
      console.log(`  attention_trace_head0_context_max_abs_diff=${layer.deltas.attention_trace?.heads?.[0]?.context_first_values_max_abs_diff ?? 'n/a'}`)
      console.log(`  largest_attention_trace_deltas=${JSON.stringify(layer.deltas.largest_attention_trace_deltas.slice(0, 3))}`)
    }
  }
}

function firstNumbers(values, count = 8) {
  return Array.isArray(values) ? values.slice(0, count) : []
}

function diffArrays(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return { max_abs_diff: null, first_diff_index: null }
  const length = Math.min(left.length, right.length)
  let maxAbsDiff = 0
  let firstDiffIndex = -1
  for (let i = 0; i < length; i += 1) {
    const diff = Math.abs(left[i] - right[i])
    if (diff > maxAbsDiff) maxAbsDiff = diff
    if (firstDiffIndex === -1 && diff > 0) firstDiffIndex = i
  }
  return { max_abs_diff: maxAbsDiff, first_diff_index: firstDiffIndex }
}

function numericDelta(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null
  return right - left
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null
}

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0
}

function arraysEqual(left, right) {
  return jsonEqual(left || [], right || [])
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)
}

function max(values) {
  const finite = values.filter(Number.isFinite)
  return finite.length ? Math.max(...finite) : null
}

function maxBy(values, score) {
  let best = null
  let bestScore = -Infinity
  for (const value of values) {
    const current = score(value)
    if (Number.isFinite(current) && current > bestScore) {
      best = value
      bestScore = current
    }
  }
  return best
}
