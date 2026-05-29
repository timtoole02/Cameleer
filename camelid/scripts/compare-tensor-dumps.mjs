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
  console.error('usage: node scripts/compare-tensor-dumps.mjs --left <tensor-dump.json> --right <tensor-dump.json> [--atol 1e-6] [--rtol 1e-5] [--json-out <path>]')
  console.error('compares camelid tensor-dump descriptor, Q8_0 scale/quant, and decoded f32 sample diagnostics')
  process.exit(2)
}

const leftPath = resolve(args.get('left'))
const rightPath = resolve(args.get('right'))
const absoluteTolerance = parseNumberArg('atol', 1e-6)
const relativeTolerance = parseNumberArg('rtol', 1e-5)
const jsonOut = args.get('json-out')

const left = await loadDump(leftPath)
const right = await loadDump(rightPath)
const comparisons = compareDumps(left, right)
const firstFailure = comparisons.find(item => !item.ok) || null
const summary = {
  left: leftPath,
  right: rightPath,
  absolute_tolerance: absoluteTolerance,
  relative_tolerance: relativeTolerance,
  comparison_count: comparisons.length,
  match: firstFailure === null,
  first_failure: firstFailure,
}

console.log(`left=${leftPath}`)
console.log(`right=${rightPath}`)
console.log(`atol=${absoluteTolerance}`)
console.log(`rtol=${relativeTolerance}`)
console.log(`comparison_count=${comparisons.length}`)
if (firstFailure) {
  console.log(`first_tensor_failure=${firstFailure.path}`)
  console.log(`failure_reason=${firstFailure.reason}`)
  if (firstFailure.max_abs_diff !== undefined) console.log(`max_abs_diff=${firstFailure.max_abs_diff}`)
  if (firstFailure.first_diff_index !== undefined) console.log(`first_diff_index=${firstFailure.first_diff_index}`)
  process.exitCode = 1
} else {
  console.log('tensor_dump_samples_match=true')
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

async function loadDump(path) {
  const json = JSON.parse(await readFile(path, 'utf8'))
  if (!Array.isArray(json.tensors)) throw new Error(`${path} does not look like camelid tensor-dump JSON`)
  return { path, json, tensors: new Map(json.tensors.map(tensor => [tensor.name, tensor])) }
}

function compareDumps(left, right) {
  const names = [...new Set([...left.tensors.keys(), ...right.tensors.keys()])].sort()
  const comparisons = []
  for (const name of names) {
    const leftTensor = left.tensors.get(name)
    const rightTensor = right.tensors.get(name)
    if (!leftTensor) {
      comparisons.push({ path: name, ok: false, reason: 'missing_left_tensor' })
      continue
    }
    if (!rightTensor) {
      comparisons.push({ path: name, ok: false, reason: 'missing_right_tensor' })
      continue
    }
    comparisons.push(...compareTensor(name, leftTensor, rightTensor))
  }
  return comparisons
}

function compareTensor(name, left, right) {
  return [
    compareJson(`${name}.descriptor.gguf_dimensions`, left.descriptor.gguf_dimensions, right.descriptor.gguf_dimensions),
    compareJson(`${name}.descriptor.gguf_dimension_strides`, left.descriptor.gguf_dimension_strides, right.descriptor.gguf_dimension_strides),
    compareJson(`${name}.descriptor.runtime_shape`, left.descriptor.runtime_shape, right.descriptor.runtime_shape),
    compareJson(`${name}.descriptor.runtime_row_major_strides`, left.descriptor.runtime_row_major_strides, right.descriptor.runtime_row_major_strides),
    compareJson(`${name}.descriptor.tensor_type`, left.descriptor.tensor_type, right.descriptor.tensor_type),
    compareJson(`${name}.descriptor.n_bytes`, left.descriptor.n_bytes, right.descriptor.n_bytes),
    compareJson(`${name}.descriptor.element_count`, left.descriptor.element_count, right.descriptor.element_count),
    compareJson(`${name}.descriptor.block_count`, left.descriptor.block_count, right.descriptor.block_count),
    compareJson(`${name}.descriptor.storage_block_size`, left.descriptor.storage_block_size, right.descriptor.storage_block_size),
    compareJson(`${name}.descriptor.storage_type_size_bytes`, left.descriptor.storage_type_size_bytes, right.descriptor.storage_type_size_bytes),
    compareJson(`${name}.descriptor.storage_row_values`, left.descriptor.storage_row_values, right.descriptor.storage_row_values),
    compareJson(`${name}.descriptor.storage_row_count`, left.descriptor.storage_row_count, right.descriptor.storage_row_count),
    compareJson(`${name}.descriptor.storage_row_stride_values`, left.descriptor.storage_row_stride_values, right.descriptor.storage_row_stride_values),
    compareJson(`${name}.descriptor.storage_row_size_bytes`, left.descriptor.storage_row_size_bytes, right.descriptor.storage_row_size_bytes),
    compareJson(`${name}.descriptor.storage_row_stride_bytes`, left.descriptor.storage_row_stride_bytes, right.descriptor.storage_row_stride_bytes),
    compareStats(`${name}.decoded.stats`, left.decoded.stats, right.decoded.stats),
    compareNumberArrays(`${name}.decoded.first_values`, left.decoded.first_values, right.decoded.first_values),
    compareJson(`${name}.decoded.max_abs_window_start`, left.decoded.max_abs_window_start, right.decoded.max_abs_window_start),
    compareNumberArrays(`${name}.decoded.max_abs_window`, left.decoded.max_abs_window, right.decoded.max_abs_window),
    ...compareRows(`${name}.decoded.rows`, left.decoded.rows || [], right.decoded.rows || [], 'row'),
    ...compareRows(`${name}.decoded.logical_token_rows`, left.decoded.logical_token_rows || [], right.decoded.logical_token_rows || [], 'token_id'),
    ...compareRows(`${name}.decoded.descriptor_token_columns`, left.decoded.descriptor_token_columns || [], right.decoded.descriptor_token_columns || [], 'token_id'),
    ...compareQ8(`${name}.q8_0`, left.q8_0, right.q8_0),
  ]
}

function compareRows(path, left, right, keyField) {
  if (!Array.isArray(left)) return [{ path, ok: false, reason: 'left_not_array' }]
  if (!Array.isArray(right)) return [{ path, ok: false, reason: 'right_not_array' }]
  const keys = [...new Set([...left.map(item => item[keyField]), ...right.map(item => item[keyField])])].sort((a, b) => a - b)
  const leftByKey = new Map(left.map(item => [item[keyField], item]))
  const rightByKey = new Map(right.map(item => [item[keyField], item]))
  const comparisons = []
  for (const key of keys) {
    const leftRow = leftByKey.get(key)
    const rightRow = rightByKey.get(key)
    const rowPath = `${path}.${key}`
    if (!leftRow) {
      comparisons.push({ path: rowPath, ok: false, reason: 'missing_left_row' })
      continue
    }
    if (!rightRow) {
      comparisons.push({ path: rowPath, ok: false, reason: 'missing_right_row' })
      continue
    }
    comparisons.push(
      compareJson(`${rowPath}.start`, leftRow.start, rightRow.start),
      compareJson(`${rowPath}.stride`, leftRow.stride, rightRow.stride),
      compareJson(`${rowPath}.len`, leftRow.len, rightRow.len),
      compareJson(`${rowPath}.source_layout`, leftRow.source_layout, rightRow.source_layout),
      compareNumberArrays(`${rowPath}.first_values`, leftRow.first_values, rightRow.first_values),
      compareJson(`${rowPath}.max_abs_window_start`, leftRow.max_abs_window_start, rightRow.max_abs_window_start),
      compareNumberArrays(`${rowPath}.max_abs_window`, leftRow.max_abs_window, rightRow.max_abs_window),
      ...compareQ8Blocks(`${rowPath}.q8_0_blocks`, leftRow.q8_0_blocks || [], rightRow.q8_0_blocks || []),
      ...compareQ8ValueChecks(`${rowPath}.q8_0_value_checks`, leftRow.q8_0_value_checks || [], rightRow.q8_0_value_checks || []),
    )
  }
  return comparisons
}

function compareQ8Blocks(path, left, right) {
  if (!Array.isArray(left)) return [{ path, ok: false, reason: 'left_not_array' }]
  if (!Array.isArray(right)) return [{ path, ok: false, reason: 'right_not_array' }]
  const keys = [...new Set([...left.map(item => item.block), ...right.map(item => item.block)])].sort((a, b) => a - b)
  const leftByKey = new Map(left.map(item => [item.block, item]))
  const rightByKey = new Map(right.map(item => [item.block, item]))
  const comparisons = []
  for (const key of keys) {
    const leftBlock = leftByKey.get(key)
    const rightBlock = rightByKey.get(key)
    const blockPath = `${path}.${key}`
    if (!leftBlock) {
      comparisons.push({ path: blockPath, ok: false, reason: 'missing_left_block' })
      continue
    }
    if (!rightBlock) {
      comparisons.push({ path: blockPath, ok: false, reason: 'missing_right_block' })
      continue
    }
    comparisons.push(
      compareJson(`${blockPath}.value_start`, leftBlock.value_start, rightBlock.value_start),
      compareNumbers(`${blockPath}.scale`, leftBlock.scale, rightBlock.scale),
      compareJson(`${blockPath}.quant_values`, leftBlock.quant_values, rightBlock.quant_values),
      compareNumberArrays(`${blockPath}.dequantized_values`, leftBlock.dequantized_values || [], rightBlock.dequantized_values || []),
    )
  }
  return comparisons
}

function compareQ8ValueChecks(path, left, right) {
  if (!Array.isArray(left)) return [{ path, ok: false, reason: 'left_not_array' }]
  if (!Array.isArray(right)) return [{ path, ok: false, reason: 'right_not_array' }]
  const keys = [...new Set([...left.map(item => item.element_index), ...right.map(item => item.element_index)])].sort((a, b) => a - b)
  const leftByKey = new Map(left.map(item => [item.element_index, item]))
  const rightByKey = new Map(right.map(item => [item.element_index, item]))
  const comparisons = []
  for (const key of keys) {
    const leftCheck = leftByKey.get(key)
    const rightCheck = rightByKey.get(key)
    const checkPath = `${path}.${key}`
    if (!leftCheck) {
      comparisons.push({ path: checkPath, ok: false, reason: 'missing_left_q8_value_check' })
      continue
    }
    if (!rightCheck) {
      comparisons.push({ path: checkPath, ok: false, reason: 'missing_right_q8_value_check' })
      continue
    }
    comparisons.push(
      compareJson(`${checkPath}.block`, leftCheck.block, rightCheck.block),
      compareJson(`${checkPath}.block_offset`, leftCheck.block_offset, rightCheck.block_offset),
      compareNumbers(`${checkPath}.scale`, leftCheck.scale, rightCheck.scale),
      compareJson(`${checkPath}.quant_value`, leftCheck.quant_value, rightCheck.quant_value),
      compareNumbers(`${checkPath}.dequantized`, leftCheck.dequantized, rightCheck.dequantized),
      compareNumbers(`${checkPath}.decoded`, leftCheck.decoded, rightCheck.decoded),
      compareNumbers(`${checkPath}.absolute_delta`, leftCheck.absolute_delta, rightCheck.absolute_delta),
    )
  }
  return comparisons
}

function compareQ8(path, left, right) {
  if (!left && !right) return []
  if (!left) return [{ path, ok: false, reason: 'missing_left_q8_0' }]
  if (!right) return [{ path, ok: false, reason: 'missing_right_q8_0' }]
  return [
    compareJson(`${path}.block_count`, left.block_count, right.block_count),
    compareStats(`${path}.scale`, left.scale, right.scale),
    compareNumberArrays(`${path}.first_scales`, left.first_scales, right.first_scales),
    compareJson(`${path}.first_block_quants`, left.first_block_quants, right.first_block_quants),
    compareJson(`${path}.max_abs_scale_block`, left.max_abs_scale_block, right.max_abs_scale_block),
    compareJson(`${path}.max_abs_scale_block_quants`, left.max_abs_scale_block_quants, right.max_abs_scale_block_quants),
  ]
}

function compareStats(path, left, right) {
  if (!left) return { path, ok: false, reason: 'missing_left_stats' }
  if (!right) return { path, ok: false, reason: 'missing_right_stats' }
  for (const field of ['min', 'max', 'mean', 'rms', 'max_abs']) {
    const result = compareNumbers(`${path}.${field}`, left[field], right[field])
    if (!result.ok) return result
  }
  return compareJson(`${path}.max_abs_index`, left.max_abs_index, right.max_abs_index)
}

function compareJson(path, left, right) {
  if (JSON.stringify(left) !== JSON.stringify(right)) return { path, ok: false, reason: 'json_mismatch', left, right }
  return { path, ok: true }
}

function compareNumberArrays(path, left, right) {
  if (!Array.isArray(left)) return { path, ok: false, reason: 'left_not_array' }
  if (!Array.isArray(right)) return { path, ok: false, reason: 'right_not_array' }
  if (left.length !== right.length) return { path, ok: false, reason: 'length_mismatch', left_length: left.length, right_length: right.length }
  let maxAbsDiff = 0
  for (let idx = 0; idx < left.length; idx += 1) {
    const result = compareNumbers(`${path}.${idx}`, left[idx], right[idx])
    if (!result.ok) return { ...result, path, first_diff_index: idx, max_abs_diff: Math.max(maxAbsDiff, result.abs_diff ?? 0) }
    maxAbsDiff = Math.max(maxAbsDiff, Math.abs(left[idx] - right[idx]))
  }
  return { path, ok: true, max_abs_diff: maxAbsDiff }
}

function compareNumbers(path, left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return left === right ? { path, ok: true } : { path, ok: false, reason: 'non_finite_mismatch', left, right }
  }
  const absDiff = Math.abs(left - right)
  const allowed = absoluteTolerance + relativeTolerance * Math.max(Math.abs(left), Math.abs(right))
  if (absDiff > allowed) return { path, ok: false, reason: 'number_mismatch', left, right, abs_diff: absDiff, allowed }
  return { path, ok: true, abs_diff: absDiff }
}
