#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inline] = arg.slice(2).split('=', 2)
  const value = inline ?? (process.argv[i + 1]?.startsWith('--') ? 'true' : process.argv[++i] ?? 'true')
  args.set(key, value)
}

if (!args.has('left') || !args.has('right')) {
  console.error('usage: node scripts/compare-attention-checkpoints.mjs --left <bundle.json> --right <bundle.json> [--atol 1e-5] [--rtol 1e-4] [--json-out <report.json>]')
  console.error('compares two camelid.attention-checkpoints.v1 bundles and reports the first sampled q/k/v/o or attention-trace mismatch')
  process.exit(2)
}

const leftPath = path.resolve(args.get('left'))
const rightPath = path.resolve(args.get('right'))
const atol = parseNumberArg('atol', 1e-5)
const rtol = parseNumberArg('rtol', 1e-4)
const left = JSON.parse(fs.readFileSync(leftPath, 'utf8'))
const right = JSON.parse(fs.readFileSync(rightPath, 'utf8'))
const comparisons = compareBundles(left, right)
const failures = comparisons.filter(result => !result.ok)
const report = {
  left: leftPath,
  right: rightPath,
  atol,
  rtol,
  schema: left.schema ?? null,
  comparison_count: comparisons.length,
  matches: failures.length === 0,
  failure_count: failures.length,
  first_failure: failures[0] ?? null,
}

console.log(`left=${leftPath}`)
console.log(`right=${rightPath}`)
console.log(`atol=${atol}`)
console.log(`rtol=${rtol}`)
console.log(`schema=${left.schema ?? '<missing>'}`)
console.log(`comparison_count=${comparisons.length}`)
if (failures.length > 0) {
  console.log('matches=false')
  console.log(`failure_count=${failures.length}`)
  console.log(`first_failure=${failures[0].path}: ${failures[0].reason}`)
  process.exitCode = 1
} else {
  console.log('matches=true')
}

if (args.has('json-out')) {
  const outputPath = path.resolve(args.get('json-out'))
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`wrote ${outputPath}`)
}

function parseNumberArg(name, fallback) {
  if (!args.has(name)) return fallback
  const value = Number(args.get(name))
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid --${name}: ${args.get(name)}`)
  return value
}

function compareBundles(leftBundle, rightBundle) {
  const results = [
    compareExact('schema', leftBundle.schema, rightBundle.schema),
    compareExact('prompt_token_ids', leftBundle.prompt_token_ids ?? null, rightBundle.prompt_token_ids ?? null),
    compareExact('dense_metadata.attention_head_count', leftBundle.dense_metadata?.attention_head_count ?? null, rightBundle.dense_metadata?.attention_head_count ?? null),
    compareExact('dense_metadata.attention_head_count_kv', leftBundle.dense_metadata?.attention_head_count_kv ?? null, rightBundle.dense_metadata?.attention_head_count_kv ?? null),
    compareExact('dense_metadata.embedding_length', leftBundle.dense_metadata?.embedding_length ?? null, rightBundle.dense_metadata?.embedding_length ?? null),
    compareExact('dense_metadata.rope_dimension_count', leftBundle.dense_metadata?.rope_dimension_count ?? null, rightBundle.dense_metadata?.rope_dimension_count ?? null),
    compareExact('dense_metadata.rope_pairing', leftBundle.dense_metadata?.rope_pairing ?? null, rightBundle.dense_metadata?.rope_pairing ?? null),
    compareExact('dense_metadata.rope_direction', leftBundle.dense_metadata?.rope_direction ?? null, rightBundle.dense_metadata?.rope_direction ?? null),
    compareExact('dense_metadata.rope_position_mode', leftBundle.dense_metadata?.rope_position_mode ?? 'zero_based', rightBundle.dense_metadata?.rope_position_mode ?? 'zero_based'),
    compareNumberScalar('dense_metadata.rms_norm_epsilon', leftBundle.dense_metadata?.rms_norm_epsilon ?? null, rightBundle.dense_metadata?.rms_norm_epsilon ?? null),
  ]

  const leftLayers = mapLayers(leftBundle.layers)
  const rightLayers = mapLayers(rightBundle.layers)
  results.push(compareExact('layers.indexes', [...leftLayers.keys()], [...rightLayers.keys()]))
  for (const [layerIndex, leftLayer] of leftLayers.entries()) {
    const rightLayer = rightLayers.get(layerIndex)
    if (!rightLayer) {
      results.push({ path: `layers.${layerIndex}`, ok: false, reason: 'missing_right_layer' })
      continue
    }
    results.push(...compareLayer(`layers.${layerIndex}`, leftLayer, rightLayer))
  }
  return results
}

function mapLayers(layers) {
  const mapped = new Map()
  for (const layer of layers ?? []) mapped.set(layer?.layer_index, layer)
  return new Map([...mapped.entries()].sort((a, b) => a[0] - b[0]))
}

function compareLayer(base, leftLayer, rightLayer) {
  return [
    compareStats(`${base}.attention_input`, leftLayer.attention_input, rightLayer.attention_input),
    compareStats(`${base}.attention_norm`, leftLayer.attention_norm, rightLayer.attention_norm),
    ...compareProjection(`${base}.q`, leftLayer.q, rightLayer.q, true),
    ...compareProjection(`${base}.k`, leftLayer.k, rightLayer.k, true),
    ...compareProjection(`${base}.v`, leftLayer.v, rightLayer.v, false),
    ...compareOutputProjection(`${base}.o`, leftLayer.o, rightLayer.o),
    ...compareAttentionTrace(`${base}.attention_trace`, leftLayer.attention_trace, rightLayer.attention_trace),
    compareStats(`${base}.attention_residual`, leftLayer.attention_residual, rightLayer.attention_residual),
    compareStats(`${base}.ffn_input`, leftLayer.ffn_input, rightLayer.ffn_input),
  ].flat()
}

function compareProjection(base, leftProjection, rightProjection, hasRopeOutput) {
  const results = [
    compareExact(`${base}.input_stage`, leftProjection?.input_stage, rightProjection?.input_stage),
    compareExact(`${base}.output_stage`, leftProjection?.output_stage, rightProjection?.output_stage),
    compareStats(`${base}.output`, leftProjection?.output, rightProjection?.output),
  ]
  if (hasRopeOutput) results.push(compareStats(`${base}.rope_output`, leftProjection?.rope_output, rightProjection?.rope_output))
  return results
}

function compareOutputProjection(base, leftProjection, rightProjection) {
  return [
    compareExact(`${base}.input_stage`, leftProjection?.input_stage, rightProjection?.input_stage),
    compareStats(`${base}.input`, leftProjection?.input, rightProjection?.input),
    compareExact(`${base}.output_stage`, leftProjection?.output_stage, rightProjection?.output_stage),
    compareStats(`${base}.output`, leftProjection?.output, rightProjection?.output),
  ]
}

function compareStats(base, leftStats, rightStats) {
  if (!leftStats) return { path: base, ok: false, reason: 'missing_left_stats' }
  if (!rightStats) return { path: base, ok: false, reason: 'missing_right_stats' }
  return [
    compareExact(`${base}.shape`, leftStats.shape, rightStats.shape),
    compareExact(`${base}.len`, leftStats.len, rightStats.len),
    compareNumberScalar(`${base}.min`, leftStats.min, rightStats.min),
    compareExact(`${base}.min_index`, leftStats.min_index, rightStats.min_index),
    compareNumberScalar(`${base}.max`, leftStats.max, rightStats.max),
    compareExact(`${base}.max_index`, leftStats.max_index, rightStats.max_index),
    compareNumberScalar(`${base}.mean`, leftStats.mean, rightStats.mean),
    compareNumberScalar(`${base}.rms`, leftStats.rms, rightStats.rms),
    compareNumberScalar(`${base}.max_abs`, leftStats.max_abs, rightStats.max_abs),
    compareExact(`${base}.max_abs_index`, leftStats.max_abs_index, rightStats.max_abs_index),
    compareNumberArrays(`${base}.first_values`, leftStats.first_values, rightStats.first_values),
    compareExact(`${base}.max_abs_window_start`, leftStats.max_abs_window_start, rightStats.max_abs_window_start),
    compareNumberArrays(`${base}.max_abs_window`, leftStats.max_abs_window, rightStats.max_abs_window),
  ]
}

function compareAttentionTrace(base, leftTrace, rightTrace) {
  if (!leftTrace) return [{ path: base, ok: false, reason: 'missing_left_trace' }]
  if (!rightTrace) return [{ path: base, ok: false, reason: 'missing_right_trace' }]
  const results = [
    compareNumberScalar(`${base}.scale`, leftTrace.scale, rightTrace.scale),
    compareExact(`${base}.position_count`, leftTrace.position_count, rightTrace.position_count),
    compareExact(`${base}.head_dim`, leftTrace.head_dim, rightTrace.head_dim),
    compareExact(`${base}.heads.length`, leftTrace.heads?.length ?? null, rightTrace.heads?.length ?? null),
  ]
  const rightHeads = new Map((rightTrace.heads ?? []).map(head => [head.attention_head, head]))
  for (const leftHead of leftTrace.heads ?? []) {
    const headPath = `${base}.heads.${leftHead.attention_head}`
    const rightHead = rightHeads.get(leftHead.attention_head)
    if (!rightHead) {
      results.push({ path: headPath, ok: false, reason: 'missing_right_head' })
      continue
    }
    results.push(
      compareExact(`${headPath}.kv_head`, leftHead.kv_head, rightHead.kv_head),
      compareNumberArrays(`${headPath}.query_first_values`, leftHead.query_first_values, rightHead.query_first_values),
      compareNumberArrays(`${headPath}.context_first_values`, leftHead.context_first_values, rightHead.context_first_values),
    )
    if (leftHead.reconstructed_context_first_values !== undefined || rightHead.reconstructed_context_first_values !== undefined) {
      results.push(
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
    results.push(
      compareExact(`${headPath}.top_probability_positions.indexes`, (leftHead.top_probability_positions ?? []).map(position => position.position), (rightHead.top_probability_positions ?? []).map(position => position.position)),
    )
    const rightTopProbabilityPositions = new Map((rightHead.top_probability_positions ?? []).map(position => [position.position, position]))
    for (const leftPosition of leftHead.top_probability_positions ?? []) {
      const positionPath = `${headPath}.top_probability_positions.${leftPosition.position}`
      const rightPosition = rightTopProbabilityPositions.get(leftPosition.position)
      if (!rightPosition) {
        results.push({ path: positionPath, ok: false, reason: 'missing_right_top_probability_position' })
        continue
      }
      results.push(
        compareNumberScalar(`${positionPath}.score`, leftPosition.score, rightPosition.score),
        compareNumberScalar(`${positionPath}.probability`, leftPosition.probability, rightPosition.probability),
        compareNumberArrays(`${positionPath}.key_first_values`, leftPosition.key_first_values, rightPosition.key_first_values),
        compareNumberArrays(`${positionPath}.value_first_values`, leftPosition.value_first_values, rightPosition.value_first_values),
      )
    }
    results.push(
      compareExact(`${headPath}.positions.indexes`, (leftHead.positions ?? []).map(position => position.position), (rightHead.positions ?? []).map(position => position.position)),
    )
    const rightPositions = new Map((rightHead.positions ?? []).map(position => [position.position, position]))
    for (const leftPosition of leftHead.positions ?? []) {
      const positionPath = `${headPath}.positions.${leftPosition.position}`
      const rightPosition = rightPositions.get(leftPosition.position)
      if (!rightPosition) {
        results.push({ path: positionPath, ok: false, reason: 'missing_right_position' })
        continue
      }
      results.push(
        compareNumberScalar(`${positionPath}.score`, leftPosition.score, rightPosition.score),
        compareNumberScalar(`${positionPath}.probability`, leftPosition.probability, rightPosition.probability),
        compareNumberArrays(`${positionPath}.key_first_values`, leftPosition.key_first_values, rightPosition.key_first_values),
        compareNumberArrays(`${positionPath}.value_first_values`, leftPosition.value_first_values, rightPosition.value_first_values),
      )
      if (leftPosition.reconstructed_score !== undefined || rightPosition.reconstructed_score !== undefined) {
        results.push(
          compareNumberScalar(`${positionPath}.reconstructed_score`, leftPosition.reconstructed_score, rightPosition.reconstructed_score),
          compareNumberScalar(`${positionPath}.score_reconstruction_delta`, leftPosition.score_reconstruction_delta, rightPosition.score_reconstruction_delta),
          compareNumberArrays(`${positionPath}.qk_products_first_values`, leftPosition.qk_products_first_values, rightPosition.qk_products_first_values),
          compareExact(`${positionPath}.qk_products_max_abs_window_start`, leftPosition.qk_products_max_abs_window_start, rightPosition.qk_products_max_abs_window_start),
          compareNumberArrays(`${positionPath}.qk_products_max_abs_window`, leftPosition.qk_products_max_abs_window, rightPosition.qk_products_max_abs_window),
        )
      }
    }
  }
  return results
}

function compareExact(pathName, leftValue, rightValue) {
  const ok = JSON.stringify(leftValue) === JSON.stringify(rightValue)
  return ok ? { path: pathName, ok } : { path: pathName, ok, reason: `expected ${JSON.stringify(leftValue)} got ${JSON.stringify(rightValue)}` }
}

function compareNumberArrays(pathName, leftValues, rightValues) {
  if (!Array.isArray(leftValues) || !Array.isArray(rightValues)) return compareExact(pathName, leftValues, rightValues)
  const results = [compareExact(`${pathName}.length`, leftValues.length, rightValues.length)]
  const length = Math.min(leftValues.length, rightValues.length)
  for (let i = 0; i < length; i += 1) results.push(compareNumberScalar(`${pathName}.${i}`, leftValues[i], rightValues[i]))
  return firstFailureOrOk(pathName, results)
}

function compareNumberScalar(pathName, leftValue, rightValue) {
  if (leftValue === null || leftValue === undefined || rightValue === null || rightValue === undefined) return compareExact(pathName, leftValue, rightValue)
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return compareExact(pathName, leftValue, rightValue)
  const delta = Math.abs(leftValue - rightValue)
  const tolerance = atol + rtol * Math.abs(leftValue)
  const ok = delta <= tolerance
  return ok ? { path: pathName, ok } : { path: pathName, ok, reason: `delta ${delta} > tolerance ${tolerance} (left=${leftValue}, right=${rightValue})` }
}

function firstFailureOrOk(pathName, results) {
  const failure = results.find(result => !result.ok)
  return failure ?? { path: pathName, ok: true }
}
