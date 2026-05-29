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

if (!args.has('input')) {
  console.error('usage: node scripts/summarize-dense-capture.mjs --input <chat-parity-diagnostics.json> [--json-out <path>]')
  console.error('summarizes one Camelid chat-parity dense capture: prompt/output parity, selected-vs-known-good logit rank/margin, dense metadata, per-stage RMS/max-abs flows, and residual reconstruction deltas')
  process.exit(2)
}

const inputPath = resolve(args.get('input'))
const jsonOut = args.get('json-out')
const capture = JSON.parse(await readFile(inputPath, 'utf8'))
const root = capture.camelid || capture
const dense = root.dense
if (!dense || !Array.isArray(dense.layers)) {
  throw new Error(`${inputPath} does not look like a chat-parity diagnostics capture with camelid.dense.layers`)
}

const topLogits = root.top_logits || []
const backendGeneratedTokenIds = root.generated_token_ids || capture.backend_generated_tokens || []
const backendSelected = topLogits.find(entry => entry.token_id === backendGeneratedTokenIds[0]) || topLogits.find(entry => entry.rank === 1) || topLogits[0] || null
const knownGoodTokenIds = uniqueNumbers(capture.llama_generated_tokens_from_text || capture.llama_generated_token_ids || [])
const knownGoodLogits = knownGoodTokenIds.map(tokenId => {
  const entry = topLogits.find(item => item.token_id === tokenId) || null
  return {
    token_id: tokenId,
    found: entry !== null,
    text: entry?.text ?? null,
    rank: entry?.rank ?? null,
    logit: entry?.logit ?? null,
    backend_selected_margin: backendSelected && entry ? backendSelected.logit - entry.logit : null,
  }
})
const knownGoodMarginSummary = summarizeKnownGoodMargins(knownGoodLogits)

const summary = {
  input: inputPath,
  message: capture.message ?? null,
  prompt_tokens_match: capture.prompt_tokens_match ?? null,
  generated_text_match: capture.generated_text_match ?? null,
  backend_generated_tokens: backendGeneratedTokenIds,
  known_good_generated_tokens: knownGoodTokenIds,
  backend_text: capture.backend_text ?? null,
  known_good_text: capture.llama_text ?? null,
  backend_selected_logit: backendSelected,
  known_good_logits: knownGoodLogits,
  known_good_margin_summary: knownGoodMarginSummary,
  dense_metadata: root.dense_metadata || null,
  stage_rms_ranges: summarizeStageRms(dense),
  stage_max_abs_flow: summarizeStageMaxAbsFlow(dense),
  residual_reconstruction: summarizeResidualReconstruction(dense),
  final_norm: summarizeFinalNorm(dense.final_norm),
  logits: summarizeTensorStats(dense.logits),
  output_norm: summarizeTensorStats(dense.output_norm),
  output_projection: summarizeOutputProjection(root.output_projection || [], backendSelected, knownGoodTokenIds),
  output_projection_pairwise: summarizeOutputProjectionPairwise(root.output_projection || [], backendSelected, knownGoodTokenIds),
  output_projection_component_stage_hits: summarizeOutputProjectionComponentStageHits(
    root.output_projection || [],
    backendSelected,
    knownGoodTokenIds,
    dense,
  ),
  output_projection_component_window_flow: summarizeOutputProjectionComponentWindowFlow(
    root.output_projection || [],
    backendSelected,
    knownGoodTokenIds,
    dense,
  ),
  output_projection_component_latest_stage_focus: summarizeOutputProjectionComponentLatestStageFocus(
    root.output_projection || [],
    backendSelected,
    knownGoodTokenIds,
    dense,
  ),
  output_projection_component_final_norm_bridge: summarizeOutputProjectionComponentFinalNormBridge(
    root.output_projection || [],
    backendSelected,
    knownGoodTokenIds,
    dense,
  ),
}

console.log(`input=${summary.input}`)
console.log(`prompt_tokens_match=${summary.prompt_tokens_match}`)
console.log(`generated_text_match=${summary.generated_text_match}`)
console.log(`backend_generated_tokens=${JSON.stringify(summary.backend_generated_tokens)}`)
console.log(`known_good_generated_tokens=${JSON.stringify(summary.known_good_generated_tokens)}`)
console.log(`backend_selected_logit=${JSON.stringify(summary.backend_selected_logit)}`)
console.log(`known_good_logits=${JSON.stringify(summary.known_good_logits)}`)
console.log(`known_good_margin_summary=${JSON.stringify(summary.known_good_margin_summary)}`)
console.log(`dense_metadata=${JSON.stringify(summary.dense_metadata)}`)
console.log(`max_residual_reconstruction_delta=${summary.residual_reconstruction.max_abs_delta}`)
console.log(`stage_rms_ranges=${JSON.stringify(summary.stage_rms_ranges)}`)
console.log(`stage_max_abs_flow=${JSON.stringify(compactStageMaxAbsFlow(summary.stage_max_abs_flow))}`)
console.log(`final_norm=${JSON.stringify(summary.final_norm)}`)
console.log(`logits=${JSON.stringify(summary.logits)}`)
console.log(`output_projection=${JSON.stringify(summary.output_projection)}`)
console.log(`output_projection_pairwise=${JSON.stringify(summary.output_projection_pairwise)}`)
console.log(`output_projection_component_stage_hits=${JSON.stringify(summary.output_projection_component_stage_hits)}`)
console.log(`output_projection_component_window_flow=${JSON.stringify(summary.output_projection_component_window_flow)}`)
console.log(`output_projection_component_latest_stage_focus=${JSON.stringify(summary.output_projection_component_latest_stage_focus)}`)
console.log(`output_projection_component_final_norm_bridge=${JSON.stringify(summary.output_projection_component_final_norm_bridge)}`)

if (jsonOut) {
  await writeFile(resolve(jsonOut), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(`json_out=${resolve(jsonOut)}`)
}

function summarizeKnownGoodMargins(knownGoodLogits) {
  const found = knownGoodLogits.filter(entry => entry.found)
  const missingTokenIds = knownGoodLogits
    .filter(entry => !entry.found)
    .map(entry => entry.token_id)
  const ranked = found.filter(entry => Number.isFinite(entry.rank))
  const margined = found.filter(entry => Number.isFinite(entry.backend_selected_margin))
  const closestRanked = ranked.reduce((best, entry) => !best || entry.rank < best.rank ? entry : best, null)
  const smallestMargin = margined.reduce((best, entry) => !best || entry.backend_selected_margin < best.backend_selected_margin ? entry : best, null)
  const largestMargin = margined.reduce((best, entry) => !best || entry.backend_selected_margin > best.backend_selected_margin ? entry : best, null)
  return {
    checked: knownGoodLogits.length,
    found: found.length,
    missing_token_ids: missingTokenIds,
    closest_ranked_token: closestRanked ? {
      token_id: closestRanked.token_id,
      rank: closestRanked.rank,
      margin: closestRanked.backend_selected_margin,
      text: closestRanked.text,
    } : null,
    smallest_margin_token: smallestMargin ? {
      token_id: smallestMargin.token_id,
      rank: smallestMargin.rank,
      margin: smallestMargin.backend_selected_margin,
      text: smallestMargin.text,
    } : null,
    largest_margin_token: largestMargin ? {
      token_id: largestMargin.token_id,
      rank: largestMargin.rank,
      margin: largestMargin.backend_selected_margin,
      text: largestMargin.text,
    } : null,
  }
}

function summarizeStageRms(dense) {
  const stages = [
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
  const ranges = {}
  for (const stage of stages) {
    const values = dense.layers
      .map(layer => ({ layer: layer.layer_index, value: numberOrNull(layer[stage]?.rms) }))
      .filter(item => item.value !== null)
    if (values.length === 0) continue
    const min = values.reduce((best, item) => item.value < best.value ? item : best, values[0])
    const max = values.reduce((best, item) => item.value > best.value ? item : best, values[0])
    ranges[stage] = { count: values.length, min, max }
  }
  return ranges
}

function summarizeStageMaxAbsFlow(dense) {
  const rootStages = ['embedding', 'final_hidden', 'output_norm', 'logits']
  const layerStages = [
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
  const root = Object.fromEntries(
    rootStages
      .map(stage => [stage, summarizeMaxAbsPoint(dense[stage])])
      .filter(([, value]) => value !== null),
  )
  const layers = dense.layers.map(layer => {
    const stages = Object.fromEntries(
      layerStages
        .map(stage => [stage, summarizeMaxAbsPoint(layer[stage])])
        .filter(([, value]) => value !== null),
    )
    return { layer: layer.layer_index, stages }
  })
  const repeatedOutputNormIndex = numberOrNull(dense.output_norm?.max_abs_index)
  const matchingLayerStages = repeatedOutputNormIndex === null
    ? []
    : layers.flatMap(layer => Object.entries(layer.stages)
      .filter(([, value]) => value.max_abs_index === repeatedOutputNormIndex)
      .map(([stage, value]) => ({ layer: layer.layer, stage, max_abs: value.max_abs })))
  return { root, layers, output_norm_max_abs_index_matches: matchingLayerStages }
}

function summarizeMaxAbsPoint(stats) {
  if (!stats) return null
  const maxAbs = numberOrNull(stats.max_abs)
  const maxAbsIndex = Number.isInteger(stats.max_abs_index) ? stats.max_abs_index : null
  if (maxAbs === null && maxAbsIndex === null) return null
  return {
    shape: stats.shape ?? stats.checkpoint?.shape ?? null,
    max_abs: maxAbs,
    max_abs_index: maxAbsIndex,
    rms: numberOrNull(stats.rms),
  }
}

function compactStageMaxAbsFlow(flow) {
  if (!flow) return null
  return {
    root: flow.root,
    layer_count: flow.layers?.length ?? 0,
    output_norm_max_abs_index_matches: flow.output_norm_max_abs_index_matches,
  }
}

function summarizeResidualReconstruction(dense) {
  const deltas = []
  const scales = []
  for (const layer of dense.layers) {
    for (const branch of ['attention', 'ffn']) {
      const diagnostic = layer.residual_flow?.[`${branch}_delta`]
      const reconstructionDelta = numberOrNull(diagnostic?.max_abs_delta)
      if (reconstructionDelta !== null) {
        deltas.push({ layer: layer.layer_index, branch, value: reconstructionDelta })
      }
      const deltaToInput = numberOrNull(diagnostic?.delta_to_input_rms_ratio)
      const cosine = numberOrNull(diagnostic?.delta_input_cosine_similarity)
      if (deltaToInput !== null || cosine !== null) {
        scales.push({
          layer: layer.layer_index,
          branch,
          input_rms: numberOrNull(diagnostic?.input_rms),
          delta_rms: numberOrNull(diagnostic?.delta_rms),
          reported_rms: numberOrNull(diagnostic?.reported_rms),
          delta_to_input_rms_ratio: deltaToInput,
          delta_input_cosine_similarity: cosine,
          reported_max_abs_index: diagnostic?.reported_max_abs_index ?? null,
          reported_max_abs: numberOrNull(diagnostic?.reported_max_abs),
          reported_max_abs_window_start: diagnostic?.reported_max_abs_window_start ?? null,
          reported_max_abs_window: Array.isArray(diagnostic?.reported_max_abs_window)
            ? diagnostic.reported_max_abs_window.map(numberOrNull)
            : null,
          delta_reported_max_abs_window: Array.isArray(diagnostic?.delta_reported_max_abs_window)
            ? diagnostic.delta_reported_max_abs_window.map(numberOrNull)
            : null,
        })
      }
    }
  }
  const worst = deltas.length === 0 ? null : deltas.reduce((best, item) => item.value > best.value ? item : best, deltas[0])
  const strongestRelativeDelta = scales
    .filter(item => item.delta_to_input_rms_ratio !== null)
    .reduce((best, item) => !best || item.delta_to_input_rms_ratio > best.delta_to_input_rms_ratio ? item : best, null)
  const mostAlignedDelta = scales
    .filter(item => item.delta_input_cosine_similarity !== null)
    .reduce((best, item) => !best || item.delta_input_cosine_similarity > best.delta_input_cosine_similarity ? item : best, null)
  const mostOpposedDelta = scales
    .filter(item => item.delta_input_cosine_similarity !== null)
    .reduce((best, item) => !best || item.delta_input_cosine_similarity < best.delta_input_cosine_similarity ? item : best, null)
  const strongestReportedResidual = scales
    .filter(item => item.reported_max_abs !== null)
    .reduce((best, item) => !best || item.reported_max_abs > best.reported_max_abs ? item : best, null)
  return {
    checked: deltas.length,
    max_abs_delta: worst?.value ?? null,
    worst,
    scale_checked: scales.length,
    strongest_relative_delta: strongestRelativeDelta,
    most_aligned_delta: mostAlignedDelta,
    most_opposed_delta: mostOpposedDelta,
    strongest_reported_residual: strongestReportedResidual,
  }
}

function summarizeFinalNorm(finalNorm) {
  if (!finalNorm) return null
  return {
    epsilon: numberOrNull(finalNorm.epsilon),
    hidden_mean_square: numberOrNull(finalNorm.hidden_mean_square),
    hidden_rms: numberOrNull(finalNorm.hidden_rms),
    scale: numberOrNull(finalNorm.scale),
    max_abs_delta: numberOrNull(finalNorm.max_abs_delta),
    max_abs_delta_index: finalNorm.max_abs_delta_index ?? null,
  }
}

function summarizeTensorStats(stats) {
  if (!stats) return null
  return {
    shape: stats.shape ?? stats.checkpoint?.shape ?? null,
    rms: numberOrNull(stats.rms),
    min: numberOrNull(stats.min),
    max: numberOrNull(stats.max),
    mean: numberOrNull(stats.mean),
    max_abs: numberOrNull(stats.max_abs),
    max_abs_index: stats.max_abs_index ?? null,
  }
}

function summarizeOutputProjection(rows, backendSelected, knownGoodTokenIds) {
  const wanted = new Set()
  if (Number.isInteger(backendSelected?.token_id)) wanted.add(backendSelected.token_id)
  for (const tokenId of knownGoodTokenIds) wanted.add(tokenId)
  const summaries = rows
    .filter(row => wanted.has(row.token_id))
    .map(row => ({
      token_id: row.token_id,
      layout: row.layout ?? null,
      reported_logit: numberOrNull(row.reported_logit),
      reconstructed_logit: numberOrNull(row.reconstructed_logit),
      absolute_delta: numberOrNull(row.absolute_delta),
      output_row_rms: numberOrNull(row.output_row_rms),
      cosine_similarity: numberOrNull(row.cosine_similarity),
      max_abs_component_index: row.max_abs_component_index ?? null,
      max_abs_component: numberOrNull(row.max_abs_component),
      positive_component_sum: numberOrNull(row.positive_component_sum),
      negative_component_sum: numberOrNull(row.negative_component_sum),
      signed_component_sum: signedComponentSum(row),
      signed_component_reconstruction_delta: signedComponentReconstructionDelta(row),
      top_positive_components: summarizeOutputComponents(row.top_positive_components),
      top_negative_components: summarizeOutputComponents(row.top_negative_components),
      component_products_max_abs_window_start: row.component_products_max_abs_window_start ?? null,
      component_products_max_abs_window: Array.isArray(row.component_products_max_abs_window)
        ? row.component_products_max_abs_window.map(numberOrNull)
        : null,
    }))
  return { checked: summaries.length, rows: summaries }
}

function summarizeOutputProjectionPairwise(rows, backendSelected, knownGoodTokenIds) {
  if (!Number.isInteger(backendSelected?.token_id) || knownGoodTokenIds.length === 0) return null
  const backendRow = rows.find(row => row.token_id === backendSelected.token_id)
  if (!backendRow) return null
  return knownGoodTokenIds.map(tokenId => {
    const knownRow = rows.find(row => row.token_id === tokenId)
    if (!knownRow) return { backend_token_id: backendSelected.token_id, known_good_token_id: tokenId, found: false }
    const backendComponents = outputComponentMap(backendRow)
    const knownComponents = outputComponentMap(knownRow)
    const backendTop = topComponentDimensions(backendRow)
    const knownTop = topComponentDimensions(knownRow)
    const sharedTopDimensions = backendTop.filter(index => knownTop.includes(index))
    const inspectedDimensions = uniqueNumbers([...backendTop, ...knownTop]).slice(0, 16)
    const componentDeltas = inspectedDimensions.map(index => {
      const backend = backendComponents.get(index) || null
      const known = knownComponents.get(index) || null
      return {
        index,
        backend_component: numberOrNull(backend?.component),
        known_good_component: numberOrNull(known?.component),
        component_delta: Number.isFinite(backend?.component) && Number.isFinite(known?.component)
          ? backend.component - known.component
          : null,
        final_hidden_value: numberOrNull(backend?.final_hidden_value ?? known?.final_hidden_value),
        output_norm_weight_value: numberOrNull(backend?.output_norm_weight_value ?? known?.output_norm_weight_value),
        output_norm_scale: numberOrNull(backend?.output_norm_scale ?? known?.output_norm_scale),
        reconstructed_output_norm_value: numberOrNull(backend?.reconstructed_output_norm_value ?? known?.reconstructed_output_norm_value),
        output_norm_reconstruction_delta: numberOrNull(backend?.output_norm_reconstruction_delta ?? known?.output_norm_reconstruction_delta),
        output_norm_value: numberOrNull(backend?.output_norm_value ?? known?.output_norm_value),
        backend_output_row_value: numberOrNull(backend?.output_row_value),
        known_good_output_row_value: numberOrNull(known?.output_row_value),
      }
    })
    return {
      backend_token_id: backendSelected.token_id,
      known_good_token_id: tokenId,
      found: true,
      backend_reported_logit: numberOrNull(backendRow.reported_logit),
      known_good_reported_logit: numberOrNull(knownRow.reported_logit),
      reported_logit_gap: Number.isFinite(backendRow.reported_logit) && Number.isFinite(knownRow.reported_logit)
        ? backendRow.reported_logit - knownRow.reported_logit
        : null,
      backend_positive_component_sum: numberOrNull(backendRow.positive_component_sum),
      backend_negative_component_sum: numberOrNull(backendRow.negative_component_sum),
      known_good_positive_component_sum: numberOrNull(knownRow.positive_component_sum),
      known_good_negative_component_sum: numberOrNull(knownRow.negative_component_sum),
      shared_top_component_dimensions: sharedTopDimensions,
      backend_only_top_component_dimensions: backendTop.filter(index => !knownTop.includes(index)),
      known_good_only_top_component_dimensions: knownTop.filter(index => !backendTop.includes(index)),
      component_deltas: componentDeltas,
    }
  })
}

function summarizeOutputProjectionComponentStageHits(rows, backendSelected, knownGoodTokenIds, dense) {
  const stageIndex = denseStageMaxAbsIndex(dense)
  const wantedRows = []
  if (Number.isInteger(backendSelected?.token_id)) {
    const row = rows.find(item => item.token_id === backendSelected.token_id)
    if (row) wantedRows.push({ label: 'backend_selected', row })
  }
  for (const tokenId of knownGoodTokenIds) {
    const row = rows.find(item => item.token_id === tokenId)
    if (row) wantedRows.push({ label: 'known_good', row })
  }
  const rowsWithHits = wantedRows.map(({ label, row }) => {
    const dimensions = topComponentDimensions(row)
    return {
      label,
      token_id: row.token_id,
      inspected_component_dimensions: dimensions,
      stage_hits: dimensions.map(index => ({
        index,
        component: numberOrNull(outputComponentMap(row).get(index)?.component),
        hits: stageIndex.get(index) || [],
      })),
    }
  })
  return {
    checked: rowsWithHits.length,
    stage_index_count: stageIndex.size,
    rows: rowsWithHits,
  }
}


function summarizeOutputProjectionComponentWindowFlow(rows, backendSelected, knownGoodTokenIds, dense) {
  const stageWindows = denseCheckpointWindows(dense)
  const wantedRows = []
  if (Number.isInteger(backendSelected?.token_id)) {
    const row = rows.find(item => item.token_id === backendSelected.token_id)
    if (row) wantedRows.push({ label: 'backend_selected', row })
  }
  for (const tokenId of knownGoodTokenIds) {
    const row = rows.find(item => item.token_id === tokenId)
    if (row) wantedRows.push({ label: 'known_good', row })
  }
  const outputRows = wantedRows.map(({ label, row }) => {
    const components = outputComponentMap(row)
    const dimensions = topComponentDimensions(row)
    return {
      label,
      token_id: row.token_id,
      inspected_component_dimensions: dimensions,
      component_flows: dimensions.map(index => {
        const hits = stageWindows
          .map(stage => checkpointValueAt(stage, index))
          .filter(hit => hit !== null)
        return {
          index,
          component: numberOrNull(components.get(index)?.component),
          output_norm_value: numberOrNull(components.get(index)?.output_norm_value),
          checkpoint_window_hits: hits,
        }
      }),
    }
  })
  return {
    checked: outputRows.length,
    checkpoint_window_count: stageWindows.length,
    rows: outputRows,
  }
}

function summarizeOutputProjectionComponentLatestStageFocus(rows, backendSelected, knownGoodTokenIds, dense) {
  const stageWindows = denseCheckpointWindows(dense)
  const stageIndex = denseStageMaxAbsIndex(dense)
  const wantedRows = []
  if (Number.isInteger(backendSelected?.token_id)) {
    const row = rows.find(item => item.token_id === backendSelected.token_id)
    if (row) wantedRows.push({ label: 'backend_selected', row })
  }
  for (const tokenId of knownGoodTokenIds) {
    const row = rows.find(item => item.token_id === tokenId)
    if (row) wantedRows.push({ label: 'known_good', row })
  }
  const rowsWithFocus = wantedRows.map(({ label, row }) => {
    const components = outputComponentMap(row)
    const dimensions = topComponentDimensions(row)
    return {
      label,
      token_id: row.token_id,
      dimensions: dimensions.map(index => {
        const component = components.get(index) || null
        const windowHits = stageWindows
          .map(stage => checkpointValueAt(stage, index))
          .filter(hit => hit !== null)
        const maxAbsHits = stageIndex.get(index) || []
        return {
          index,
          component: numberOrNull(component?.component),
          output_norm_value: numberOrNull(component?.output_norm_value),
          reconstructed_output_norm_value: numberOrNull(component?.reconstructed_output_norm_value),
          output_norm_reconstruction_delta: numberOrNull(component?.output_norm_reconstruction_delta),
          latest_window_hit: latestStageHit(windowHits),
          latest_layer_window_hit: latestStageHit(windowHits.filter(hit => hit.scope === 'layer')),
          latest_root_window_hit: latestStageHit(windowHits.filter(hit => hit.scope === 'root')),
          latest_max_abs_hit: latestStageHit(maxAbsHits),
          latest_layer_max_abs_hit: latestStageHit(maxAbsHits.filter(hit => hit.scope === 'layer')),
          latest_root_max_abs_hit: latestStageHit(maxAbsHits.filter(hit => hit.scope === 'root')),
          window_hit_count: windowHits.length,
          max_abs_hit_count: maxAbsHits.length,
        }
      }),
    }
  })
  return {
    checked: rowsWithFocus.length,
    rows: rowsWithFocus,
  }
}

function summarizeOutputProjectionComponentFinalNormBridge(rows, backendSelected, knownGoodTokenIds, dense) {
  const rootWindows = denseCheckpointWindows(dense).filter(stage => stage.scope === 'root')
  const wantedRows = []
  if (Number.isInteger(backendSelected?.token_id)) {
    const row = rows.find(item => item.token_id === backendSelected.token_id)
    if (row) wantedRows.push({ label: 'backend_selected', row })
  }
  for (const tokenId of knownGoodTokenIds) {
    const row = rows.find(item => item.token_id === tokenId)
    if (row) wantedRows.push({ label: 'known_good', row })
  }
  const outputRows = wantedRows.map(({ label, row }) => {
    const components = outputComponentMap(row)
    const dimensions = topComponentDimensions(row)
    return {
      label,
      token_id: row.token_id,
      dimensions: dimensions.map(index => {
        const component = components.get(index) || null
        const rootHits = rootWindows
          .map(stage => checkpointValueAt(stage, index))
          .filter(hit => hit !== null)
        const finalHiddenHit = rootHits.find(hit => hit.stage === 'final_hidden') || null
        const outputNormHit = rootHits.find(hit => hit.stage === 'output_norm') || null
        const reconstructedOutputNorm = numberOrNull(component?.reconstructed_output_norm_value)
        const reportedOutputNorm = numberOrNull(component?.output_norm_value)
        return {
          index,
          component: numberOrNull(component?.component),
          final_hidden_value: numberOrNull(component?.final_hidden_value),
          output_norm_weight_value: numberOrNull(component?.output_norm_weight_value),
          output_norm_scale: numberOrNull(component?.output_norm_scale),
          reconstructed_output_norm_value: reconstructedOutputNorm,
          output_norm_value: reportedOutputNorm,
          output_norm_reconstruction_delta: numberOrNull(component?.output_norm_reconstruction_delta),
          reconstructed_vs_reported_output_norm_delta: reconstructedOutputNorm !== null && reportedOutputNorm !== null
            ? Math.abs(reconstructedOutputNorm - reportedOutputNorm)
            : null,
          final_hidden_checkpoint_value: numberOrNull(finalHiddenHit?.value),
          output_norm_checkpoint_value: numberOrNull(outputNormHit?.value),
          final_hidden_checkpoint_delta: finalHiddenHit && Number.isFinite(component?.final_hidden_value)
            ? Math.abs(component.final_hidden_value - finalHiddenHit.value)
            : null,
          output_norm_checkpoint_delta: outputNormHit && Number.isFinite(component?.output_norm_value)
            ? Math.abs(component.output_norm_value - outputNormHit.value)
            : null,
          root_checkpoint_hits: rootHits,
        }
      }),
    }
  })
  return {
    checked: outputRows.length,
    rows: outputRows,
  }
}

function latestStageHit(hits) {
  if (!Array.isArray(hits) || hits.length === 0) return null
  return hits.reduce((best, hit) => stageHitOrder(hit) > stageHitOrder(best) ? hit : best, hits[0])
}

function stageHitOrder(hit) {
  if (!hit) return -1
  const scopeOrder = hit.scope === 'root' ? 10_000 : 0
  const layerOrder = Number.isInteger(hit.layer) ? hit.layer * 100 : 0
  return scopeOrder + layerOrder + stageOrder(hit.stage)
}

function stageOrder(stage) {
  const stages = [
    'embedding',
    'attention_norm',
    'attention_q',
    'attention_k',
    'attention_q_rope',
    'attention_k_rope',
    'attention_v',
    'attention_context',
    'attention_output',
    'attention_residual',
    'residual_flow.attention_input',
    'ffn_norm',
    'residual_flow.ffn_input',
    'ffn_gate',
    'ffn_up',
    'ffn_activation',
    'ffn_output',
    'ffn_residual',
    'final_hidden',
    'output_norm',
    'logits',
  ]
  const index = stages.indexOf(stage)
  return index === -1 ? stages.length : index
}

function denseCheckpointWindows(dense) {
  const windows = []
  const add = (scope, stage, stats, layer = null) => {
    const checkpoint = stats?.checkpoint
    const start = checkpoint?.max_abs_window_start
    const values = checkpoint?.max_abs_window
    if (!Number.isInteger(start) || !Array.isArray(values)) return
    windows.push({ scope, layer, stage, start, values: values.map(numberOrNull), max_abs_index: stats?.max_abs_index ?? null })
  }
  for (const stage of ['embedding', 'final_hidden', 'output_norm', 'logits']) {
    add('root', stage, dense?.[stage])
  }
  for (const layer of dense?.layers || []) {
    for (const stage of [
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
    ]) {
      add('layer', stage, layer?.[stage], layer.layer_index ?? null)
    }
    add('layer', 'residual_flow.attention_input', layer?.residual_flow?.attention_input, layer.layer_index ?? null)
    add('layer', 'residual_flow.ffn_input', layer?.residual_flow?.ffn_input, layer.layer_index ?? null)
  }
  return windows
}

function checkpointValueAt(stage, index) {
  if (!Number.isInteger(index)) return null
  const offset = index - stage.start
  if (offset < 0 || offset >= stage.values.length) return null
  return {
    scope: stage.scope,
    layer: stage.layer,
    stage: stage.stage,
    value: numberOrNull(stage.values[offset]),
    window_offset: offset,
    max_abs_index: stage.max_abs_index,
  }
}

function denseStageMaxAbsIndex(dense) {
  const stageIndex = new Map()
  const add = (index, hit) => {
    if (!Number.isInteger(index)) return
    const hits = stageIndex.get(index) || []
    hits.push(hit)
    stageIndex.set(index, hits)
  }
  for (const stage of ['embedding', 'final_hidden', 'output_norm', 'logits']) {
    const stats = dense?.[stage]
    add(stats?.max_abs_index, { scope: 'root', stage, max_abs: numberOrNull(stats?.max_abs), rms: numberOrNull(stats?.rms) })
  }
  for (const layer of dense?.layers || []) {
    for (const stage of [
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
    ]) {
      const stats = layer?.[stage]
      add(stats?.max_abs_index, {
        scope: 'layer',
        layer: layer.layer_index ?? null,
        stage,
        max_abs: numberOrNull(stats?.max_abs),
        rms: numberOrNull(stats?.rms),
      })
    }
  }
  return stageIndex
}

function outputComponentMap(row) {
  const map = new Map()
  for (const component of [...(row.top_positive_components || []), ...(row.top_negative_components || [])]) {
    if (Number.isInteger(component?.index) && !map.has(component.index)) map.set(component.index, component)
  }
  return map
}

function topComponentDimensions(row) {
  return uniqueNumbers([
    ...(row.top_positive_components || []).map(component => component.index),
    ...(row.top_negative_components || []).map(component => component.index),
  ]).slice(0, 8)
}

function summarizeOutputComponents(components) {
  if (!Array.isArray(components)) return null
  return components.slice(0, 4).map(component => ({
    index: component.index ?? null,
    final_hidden_value: numberOrNull(component.final_hidden_value),
    output_norm_weight_value: numberOrNull(component.output_norm_weight_value),
    output_norm_scale: numberOrNull(component.output_norm_scale),
    reconstructed_output_norm_value: numberOrNull(component.reconstructed_output_norm_value),
    output_norm_reconstruction_delta: numberOrNull(component.output_norm_reconstruction_delta),
    output_norm_value: numberOrNull(component.output_norm_value),
    output_row_value: numberOrNull(component.output_row_value),
    component: numberOrNull(component.component),
  }))
}

function signedComponentSum(row) {
  if (!Number.isFinite(row?.positive_component_sum) || !Number.isFinite(row?.negative_component_sum)) {
    return null
  }
  return row.positive_component_sum + row.negative_component_sum
}

function signedComponentReconstructionDelta(row) {
  const componentSum = signedComponentSum(row)
  if (!Number.isFinite(componentSum) || !Number.isFinite(row?.reconstructed_logit)) return null
  return Math.abs(componentSum - row.reconstructed_logit)
}

function uniqueNumbers(values) {
  const out = []
  for (const value of values) {
    if (Number.isInteger(value) && !out.includes(value)) out.push(value)
  }
  return out
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null
}
