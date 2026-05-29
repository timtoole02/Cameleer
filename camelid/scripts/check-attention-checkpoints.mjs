#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
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
  console.error('usage: node scripts/check-attention-checkpoints.mjs --input <attention-checkpoints.v1.json>')
  console.error('validates the focused camelid.attention-checkpoints.v1 schema and sampled internal consistency')
  process.exit(2)
}

const inputPath = resolve(args.get('input'))
const bundle = JSON.parse(await readFile(inputPath, 'utf8'))
const failures = validateBundle(bundle)

console.log(`input=${inputPath}`)
console.log(`schema=${bundle.schema ?? '<missing>'}`)
console.log(`layers=${Array.isArray(bundle.layers) ? bundle.layers.map(layer => layer?.layer_index).join(',') : '<missing>'}`)
console.log(`check_count=${countChecks(bundle)}`)
if (failures.length > 0) {
  console.log(`valid=false`)
  console.log(`failure_count=${failures.length}`)
  console.log(`first_failure=${failures[0].path}: ${failures[0].reason}`)
  process.exitCode = 1
} else {
  console.log('valid=true')
}

function validateBundle(bundle) {
  const failures = []
  check(bundle.schema === 'camelid.attention-checkpoints.v1', 'schema', 'expected camelid.attention-checkpoints.v1')
  check(Array.isArray(bundle.layers) && bundle.layers.length > 0, 'layers', 'expected non-empty layers array')

  if (bundle.prompt_token_ids !== null && bundle.prompt_token_ids !== undefined) {
    check(Array.isArray(bundle.prompt_token_ids), 'prompt_token_ids', 'expected array or null')
    for (const [idx, token] of (bundle.prompt_token_ids ?? []).entries()) {
      check(Number.isInteger(token) && token >= 0, `prompt_token_ids.${idx}`, 'expected non-negative integer token id')
    }
  }

  const metadata = bundle.dense_metadata ?? {}
  const embeddingLength = maybePositiveInteger(metadata.embedding_length, 'dense_metadata.embedding_length')
  const headCount = maybePositiveInteger(metadata.attention_head_count, 'dense_metadata.attention_head_count')
  const kvHeadCount = maybePositiveInteger(metadata.attention_head_count_kv, 'dense_metadata.attention_head_count_kv')
  const expectedHeadDim = embeddingLength && headCount ? embeddingLength / headCount : null
  if (expectedHeadDim !== null) check(Number.isInteger(expectedHeadDim) && expectedHeadDim > 0, 'dense_metadata', 'embedding_length must divide attention_head_count')
  const expectedKvWidth = expectedHeadDim && kvHeadCount ? expectedHeadDim * kvHeadCount : null

  if (Array.isArray(bundle.layers)) {
    const seenLayers = new Set()
    for (const [idx, layer] of bundle.layers.entries()) {
      const base = `layers.${idx}`
      check(layer && typeof layer === 'object', base, 'expected object')
      if (!layer || typeof layer !== 'object') continue
      check(Number.isInteger(layer.layer_index) && layer.layer_index >= 0, `${base}.layer_index`, 'expected non-negative integer')
      check(!seenLayers.has(layer.layer_index), `${base}.layer_index`, 'duplicate layer_index')
      seenLayers.add(layer.layer_index)

      validateStats(layer.attention_input, `${base}.attention_input`, embeddingLength)
      validateStats(layer.attention_norm, `${base}.attention_norm`, embeddingLength)
      validateProjection(layer.q, `${base}.q`, embeddingLength, embeddingLength, true)
      validateProjection(layer.k, `${base}.k`, embeddingLength, expectedKvWidth, true)
      validateProjection(layer.v, `${base}.v`, embeddingLength, expectedKvWidth, false)
      validateOutputProjection(layer.o, `${base}.o`, embeddingLength)
      validateAttentionTrace(layer.attention_trace, `${base}.attention_trace`, {
        headCount,
        kvHeadCount,
        expectedHeadDim,
        promptTokenCount: Array.isArray(bundle.prompt_token_ids) ? bundle.prompt_token_ids.length : null,
      })
      validateStats(layer.attention_residual, `${base}.attention_residual`, embeddingLength)
      validateStats(layer.ffn_input, `${base}.ffn_input`, embeddingLength)
    }
  }

  return failures

  function check(ok, path, reason) {
    if (!ok) failures.push({ path, reason })
  }

  function maybePositiveInteger(value, path) {
    if (value === null || value === undefined) return null
    check(Number.isInteger(value) && value > 0, path, 'expected positive integer when present')
    return Number.isInteger(value) && value > 0 ? value : null
  }

  function validateProjection(projection, path, expectedInputWidth, expectedOutputWidth, hasRopeOutput) {
    check(projection && typeof projection === 'object', path, 'expected projection object')
    if (!projection || typeof projection !== 'object') return
    check(projection.input_stage === 'attention_norm', `${path}.input_stage`, 'expected attention_norm')
    validateStats(projection.output, `${path}.output`, expectedOutputWidth)
    if (hasRopeOutput) validateStats(projection.rope_output, `${path}.rope_output`, expectedOutputWidth)
    else check(projection.rope_output === undefined, `${path}.rope_output`, 'unexpected rope_output for v projection')
    if (expectedInputWidth) check(projection.input_stage === 'attention_norm', `${path}.input_stage`, `expected input width ${expectedInputWidth} via attention_norm`)
  }

  function validateOutputProjection(projection, path, embeddingLength) {
    check(projection && typeof projection === 'object', path, 'expected output projection object')
    if (!projection || typeof projection !== 'object') return
    check(projection.input_stage === 'attention_context', `${path}.input_stage`, 'expected attention_context')
    check(projection.output_stage === 'attention_output', `${path}.output_stage`, 'expected attention_output')
    validateStats(projection.input, `${path}.input`, embeddingLength)
    validateStats(projection.output, `${path}.output`, embeddingLength)
  }

  function validateStats(stats, path, expectedWidth) {
    if (stats === null || stats === undefined) {
      check(false, path, 'expected compact stats object')
      return
    }
    check(typeof stats === 'object' && !Array.isArray(stats), path, 'expected object')
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return
    for (const field of ['min', 'max', 'mean', 'rms', 'max_abs']) validateFinite(stats[field], `${path}.${field}`)
    for (const field of ['min_index', 'max_index', 'max_abs_index']) validateIndex(stats[field], stats.len, `${path}.${field}`)
    check(Array.isArray(stats.shape), `${path}.shape`, 'expected shape array')
    if (Array.isArray(stats.shape)) {
      for (const [idx, value] of stats.shape.entries()) check(Number.isInteger(value) && value > 0, `${path}.shape.${idx}`, 'expected positive integer dimension')
      const product = stats.shape.reduce((acc, value) => acc * value, 1)
      check(Number.isInteger(stats.len) && stats.len === product, `${path}.len`, 'expected len to equal shape product')
      if (expectedWidth !== null && expectedWidth !== undefined && stats.shape.length === 2) {
        check(stats.shape[0] === 1, `${path}.shape.0`, 'expected single-row checkpoint')
        check(stats.shape[1] === expectedWidth, `${path}.shape.1`, `expected width ${expectedWidth}`)
      }
    }
    validateNumberArray(stats.first_values, `${path}.first_values`, stats.len)
    if (stats.max_abs_window_start !== null && stats.max_abs_window_start !== undefined) {
      validateIndex(stats.max_abs_window_start, stats.len, `${path}.max_abs_window_start`)
    }
    validateNumberArray(stats.max_abs_window, `${path}.max_abs_window`, stats.len)
    if (Array.isArray(stats.max_abs_window) && Number.isInteger(stats.max_abs_window_start) && Number.isInteger(stats.max_abs_index)) {
      const start = stats.max_abs_window_start
      const end = start + stats.max_abs_window.length
      check(stats.max_abs_index >= start && stats.max_abs_index < end, `${path}.max_abs_window`, 'expected max_abs_index inside sampled max_abs_window')
    }
  }

  function validateAttentionTrace(trace, path, context) {
    check(trace && typeof trace === 'object', path, 'expected attention_trace object')
    if (!trace || typeof trace !== 'object') return
    validateFinite(trace.scale, `${path}.scale`)
    check(Number.isInteger(trace.position_count) && trace.position_count > 0, `${path}.position_count`, 'expected positive integer')
    if (context.promptTokenCount !== null) {
      check(trace.position_count === context.promptTokenCount, `${path}.position_count`, 'expected to match prompt_token_ids length for first generated token capture')
    }
    check(Number.isInteger(trace.head_dim) && trace.head_dim > 0, `${path}.head_dim`, 'expected positive integer')
    if (context.expectedHeadDim !== null) check(trace.head_dim === context.expectedHeadDim, `${path}.head_dim`, `expected ${context.expectedHeadDim}`)
    if (context.expectedHeadDim !== null) {
      const expectedScale = 1 / Math.sqrt(context.expectedHeadDim)
      check(Math.abs(trace.scale - expectedScale) <= 1e-7, `${path}.scale`, `expected 1/sqrt(head_dim) ~= ${expectedScale}`)
    }
    check(Array.isArray(trace.heads) && trace.heads.length > 0, `${path}.heads`, 'expected non-empty sampled heads array')
    if (!Array.isArray(trace.heads)) return
    const seenHeads = new Set()
    const seenKvHeads = new Set()
    for (const [idx, head] of trace.heads.entries()) {
      const headPath = `${path}.heads.${idx}`
      check(Number.isInteger(head.attention_head) && head.attention_head >= 0, `${headPath}.attention_head`, 'expected non-negative integer')
      if (context.headCount !== null) check(head.attention_head < context.headCount, `${headPath}.attention_head`, `expected < ${context.headCount}`)
      check(!seenHeads.has(head.attention_head), `${headPath}.attention_head`, 'duplicate sampled attention head')
      seenHeads.add(head.attention_head)
      check(Number.isInteger(head.kv_head) && head.kv_head >= 0, `${headPath}.kv_head`, 'expected non-negative integer')
      if (context.kvHeadCount !== null) check(head.kv_head < context.kvHeadCount, `${headPath}.kv_head`, `expected < ${context.kvHeadCount}`)
      if (Number.isInteger(head.kv_head) && head.kv_head >= 0) seenKvHeads.add(head.kv_head)
      if (context.kvHeadCount !== null && context.headCount !== null) {
        const groupSize = context.headCount / context.kvHeadCount
        if (Number.isInteger(groupSize) && groupSize > 0) check(head.kv_head === Math.floor(head.attention_head / groupSize), `${headPath}.kv_head`, 'expected grouped-query kv head mapping')
      }
      validateNumberArray(head.query_first_values, `${headPath}.query_first_values`, trace.head_dim)
      validateNumberArray(head.context_first_values, `${headPath}.context_first_values`, trace.head_dim)
      if (head.reconstructed_context_first_values !== undefined) {
        validateNumberArray(head.reconstructed_context_first_values, `${headPath}.reconstructed_context_first_values`, trace.head_dim)
        validateIndex(head.context_reconstruction_max_abs_delta_index, trace.head_dim, `${headPath}.context_reconstruction_max_abs_delta_index`)
        validateFinite(head.context_reconstruction_max_abs_delta, `${headPath}.context_reconstruction_max_abs_delta`)
        validateFinite(head.probability_sum, `${headPath}.probability_sum`)
        check(Math.abs(head.probability_sum - 1) < 1e-4, `${headPath}.probability_sum`, 'expected sampled-head probability sum near 1')
        if (head.probability_entropy !== undefined) {
          validateFinite(head.probability_entropy, `${headPath}.probability_entropy`)
          check(head.probability_entropy >= -1e-7, `${headPath}.probability_entropy`, 'expected non-negative entropy')
          check(head.probability_entropy <= Math.log(trace.position_count) + 1e-6, `${headPath}.probability_entropy`, 'expected entropy <= ln(position_count)')
        }
        if (head.probability_rms !== undefined) {
          validateFinite(head.probability_rms, `${headPath}.probability_rms`)
          check(head.probability_rms >= 0 && head.probability_rms <= 1, `${headPath}.probability_rms`, 'expected probability RMS in [0, 1]')
        }
        check(Number.isInteger(head.max_probability_position) && head.max_probability_position >= 0 && head.max_probability_position < trace.position_count, `${headPath}.max_probability_position`, 'expected max probability position within trace')
        validateFinite(head.max_probability, `${headPath}.max_probability`)
        check(head.max_probability >= 0 && head.max_probability <= 1, `${headPath}.max_probability`, 'expected max probability in [0, 1]')
        if (head.top_probability_positions !== undefined) {
          check(Array.isArray(head.top_probability_positions) && head.top_probability_positions.length > 0, `${headPath}.top_probability_positions`, 'expected non-empty top probability positions')
          if (Array.isArray(head.top_probability_positions)) {
            let previousProbability = Infinity
            let previousPosition = -1
            for (const [topIdx, topPosition] of head.top_probability_positions.entries()) {
              const topPath = `${headPath}.top_probability_positions.${topIdx}`
              check(Number.isInteger(topPosition.position) && topPosition.position >= 0 && topPosition.position < trace.position_count, `${topPath}.position`, 'expected position within trace.position_count')
              validateFinite(topPosition.score, `${topPath}.score`)
              validateFinite(topPosition.probability, `${topPath}.probability`)
              check(topPosition.probability >= 0 && topPosition.probability <= 1, `${topPath}.probability`, 'expected probability in [0, 1]')
              check(topPosition.probability <= previousProbability + 1e-12, `${topPath}.probability`, 'expected descending probability order')
              if (Math.abs(topPosition.probability - previousProbability) <= 1e-12) {
                check(topPosition.position > previousPosition, `${topPath}.position`, 'expected ascending position order for equal probabilities')
              }
              validateNumberArray(topPosition.key_first_values, `${topPath}.key_first_values`, trace.head_dim)
              validateNumberArray(topPosition.value_first_values, `${topPath}.value_first_values`, trace.head_dim)
              if (topIdx === 0) {
                check(topPosition.position === head.max_probability_position, `${topPath}.position`, 'expected first top probability position to match max_probability_position')
                check(Math.abs(topPosition.probability - head.max_probability) <= 1e-6, `${topPath}.probability`, 'expected first top probability to match max_probability')
              }
              previousProbability = topPosition.probability
              previousPosition = topPosition.position
            }
          }
        }
      }
      check(Array.isArray(head.positions) && head.positions.length > 0, `${headPath}.positions`, 'expected non-empty sampled positions')
      if (Array.isArray(head.positions)) {
        let previousPosition = -1
        for (const [positionIdx, position] of head.positions.entries()) {
          const positionPath = `${headPath}.positions.${positionIdx}`
          check(Number.isInteger(position.position) && position.position >= 0 && position.position < trace.position_count, `${positionPath}.position`, 'expected position within trace.position_count')
          check(position.position > previousPosition, `${positionPath}.position`, 'expected strictly increasing sampled positions')
          previousPosition = position.position
          validateFinite(position.score, `${positionPath}.score`)
          if (position.reconstructed_score !== undefined) {
            validateFinite(position.reconstructed_score, `${positionPath}.reconstructed_score`)
            validateFinite(position.score_reconstruction_delta, `${positionPath}.score_reconstruction_delta`)
            check(Math.abs(position.score - position.reconstructed_score) <= Math.max(1e-6, Math.abs(position.score) * 1e-6), `${positionPath}.reconstructed_score`, 'expected reconstructed q·k score to match reported score')
            check(position.score_reconstruction_delta <= Math.max(1e-6, Math.abs(position.score) * 1e-6), `${positionPath}.score_reconstruction_delta`, 'expected small score reconstruction delta')
            validateNumberArray(position.qk_products_first_values, `${positionPath}.qk_products_first_values`, trace.head_dim)
            validateIndex(position.qk_products_max_abs_window_start, trace.head_dim, `${positionPath}.qk_products_max_abs_window_start`)
            validateNumberArray(position.qk_products_max_abs_window, `${positionPath}.qk_products_max_abs_window`, trace.head_dim)
          }
          validateFinite(position.probability, `${positionPath}.probability`)
          check(position.probability >= 0 && position.probability <= 1, `${positionPath}.probability`, 'expected probability in [0, 1]')
          validateNumberArray(position.key_first_values, `${positionPath}.key_first_values`, trace.head_dim)
          validateNumberArray(position.value_first_values, `${positionPath}.value_first_values`, trace.head_dim)
        }
      }
    }
    if (context.kvHeadCount !== null && context.kvHeadCount > 1 && trace.heads.length >= context.kvHeadCount) {
      for (let kvHead = 0; kvHead < context.kvHeadCount; kvHead += 1) {
        check(seenKvHeads.has(kvHead), `${path}.heads`, 'expected sampled heads to cover every grouped-query kv head')
      }
    }
  }

  function validateFinite(value, path) {
    check(Number.isFinite(value), path, 'expected finite number')
  }

  function validateIndex(value, len, path) {
    check(Number.isInteger(value) && value >= 0 && (!Number.isInteger(len) || value < len), path, 'expected valid index')
  }

  function validateNumberArray(value, path, maxLength) {
    check(Array.isArray(value), path, 'expected number array')
    if (!Array.isArray(value)) return
    check(maxLength === null || maxLength === undefined || value.length <= maxLength, path, 'expected sampled array no longer than source length')
    for (const [idx, item] of value.entries()) validateFinite(item, `${path}.${idx}`)
  }
}

function countChecks(bundle) {
  if (!Array.isArray(bundle.layers)) return 0
  let count = 1
  for (const layer of bundle.layers) {
    if (!layer) continue
    count += 9
    for (const stats of [layer.attention_input, layer.attention_norm, layer.q?.output, layer.q?.rope_output, layer.k?.output, layer.k?.rope_output, layer.v?.output, layer.o?.input, layer.o?.output, layer.attention_residual, layer.ffn_input]) {
      if (stats) count += 1 + (stats.first_values?.length ?? 0) + (stats.max_abs_window?.length ?? 0)
    }
    for (const head of layer.attention_trace?.heads ?? []) {
      count += 2 + (head.query_first_values?.length ?? 0) + (head.context_first_values?.length ?? 0)
      if (head.reconstructed_context_first_values !== undefined) count += 6 + (head.reconstructed_context_first_values?.length ?? 0)
      for (const position of head.top_probability_positions ?? []) count += 3 + (position.key_first_values?.length ?? 0) + (position.value_first_values?.length ?? 0)
      for (const position of head.positions ?? []) count += 3 + (position.key_first_values?.length ?? 0) + (position.value_first_values?.length ?? 0)
    }
  }
  return count
}
