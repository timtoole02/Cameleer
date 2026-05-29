#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
if (!args.has('tensor-dump')) {
  console.error('usage: node scripts/check-output-projection-layout.mjs --tensor-dump <tensor-dump.json> [--hidden 2048] [--vocab 32000] [--json-out <path>]')
  console.error('validates output.weight GGUF storage row size/stride and token-major vs descriptor-column token rows')
  process.exit(2)
}

const tensorDumpPath = resolve(args.get('tensor-dump'))
const hidden = Number(args.get('hidden') || 2048)
const vocab = Number(args.get('vocab') || 32000)
const json = JSON.parse(await readFile(tensorDumpPath, 'utf8'))
const tensor = json.tensors?.find(item => item.name === 'output.weight')
const checks = []

check('output.weight.present', Boolean(tensor), true)
if (tensor) {
  const descriptor = tensor.descriptor || {}
  check('descriptor.gguf_dimensions', descriptor.gguf_dimensions, [hidden, vocab])
  check('descriptor.gguf_dimension_strides', descriptor.gguf_dimension_strides, [1, hidden])
  check('descriptor.runtime_shape', descriptor.runtime_shape, [hidden, vocab])
  check('descriptor.runtime_row_major_strides', descriptor.runtime_row_major_strides, [vocab, 1])
  check('descriptor.tensor_type', descriptor.tensor_type, 'Q8_0')
  check('descriptor.storage_block_size', descriptor.storage_block_size, 32)
  check('descriptor.storage_type_size_bytes', descriptor.storage_type_size_bytes, 34)
  check('descriptor.storage_row_values', descriptor.storage_row_values, hidden)
  check('descriptor.storage_row_count', descriptor.storage_row_count, vocab)
  check('descriptor.storage_row_stride_values', descriptor.storage_row_stride_values, hidden)
  check('descriptor.storage_row_size_bytes', descriptor.storage_row_size_bytes, hidden / 32 * 34)
  check('descriptor.storage_row_stride_bytes', descriptor.storage_row_stride_bytes, hidden / 32 * 34)
  check('descriptor.n_bytes', descriptor.n_bytes, vocab * (hidden / 32 * 34))
  check('descriptor.element_count', descriptor.element_count, hidden * vocab)
  check('descriptor.block_count', descriptor.block_count, hidden * vocab / 32)
  checkStorageMath(descriptor)

  const tokenRows = tensor.decoded?.logical_token_rows || []
  const descriptorColumns = tensor.decoded?.descriptor_token_columns || []
  check('logical_token_rows.non_empty', tokenRows.length > 0, true)
  check('descriptor_token_columns.non_empty', descriptorColumns.length > 0, true)
  check(
    'descriptor_token_columns.same_token_ids',
    descriptorColumns.map(row => row.token_id).sort((left, right) => left - right),
    tokenRows.map(row => row.token_id).sort((left, right) => left - right),
  )
  for (const row of tokenRows) {
    const tokenId = row.token_id
    check(`logical_token_rows.${tokenId}.source_layout`, row.source_layout, 'gguf_output_token_major_shape_reinterpreted')
    check(`logical_token_rows.${tokenId}.start`, row.start, tokenId * hidden)
    check(`logical_token_rows.${tokenId}.stride`, row.stride, 1)
    check(`logical_token_rows.${tokenId}.len`, row.len, hidden)
    checkRowBounds(`logical_token_rows.${tokenId}`, row, descriptor.element_count)
    checkQ8ValueChecks(`logical_token_rows.${tokenId}`, row)
  }
  for (const column of descriptorColumns) {
    const tokenId = column.token_id
    check(`descriptor_token_columns.${tokenId}.source_layout`, column.source_layout, 'descriptor_output_column')
    check(`descriptor_token_columns.${tokenId}.start`, column.start, tokenId)
    check(`descriptor_token_columns.${tokenId}.stride`, column.stride, vocab)
    check(`descriptor_token_columns.${tokenId}.len`, column.len, hidden)
    checkRowBounds(`descriptor_token_columns.${tokenId}`, column, descriptor.element_count)
    checkQ8ValueChecks(`descriptor_token_columns.${tokenId}`, column)
  }
  for (const row of tokenRows) {
    const column = descriptorColumns.find(item => item.token_id === row.token_id)
    if (!column) continue
    check(`token_major_vs_descriptor.${row.token_id}.different_start`, row.start !== column.start, true)
    check(`token_major_vs_descriptor.${row.token_id}.different_stride`, row.stride !== column.stride, true)
  }
}

const ok = checks.every(item => item.ok)
const report = {
  object: 'camelid.output_projection_layout_check',
  tensor_dump: tensorDumpPath,
  hidden,
  vocab,
  ok,
  checks,
}
if (args.has('json-out')) {
  await writeFile(resolve(args.get('json-out')), `${JSON.stringify(report, null, 2)}\n`)
}

console.log(`output_projection_layout_ok=${ok}`)
if (tensor) {
  console.log(`gguf_dimensions=${JSON.stringify(tensor.descriptor?.gguf_dimensions)}`)
  console.log(`storage_row_size_bytes=${tensor.descriptor?.storage_row_size_bytes}`)
  console.log(`storage_row_stride_bytes=${tensor.descriptor?.storage_row_stride_bytes}`)
  console.log(`logical_token_rows=${(tensor.decoded?.logical_token_rows || []).map(row => `${row.token_id}:${row.source_layout}:start=${row.start}:stride=${row.stride}`).join(',')}`)
  console.log(`descriptor_token_columns=${(tensor.decoded?.descriptor_token_columns || []).map(row => `${row.token_id}:${row.source_layout}:start=${row.start}:stride=${row.stride}`).join(',')}`)
}
const firstFailure = checks.find(item => !item.ok)
if (firstFailure) {
  console.log(`first_failure=${firstFailure.path}`)
  console.log(`expected=${JSON.stringify(firstFailure.expected)}`)
  console.log(`actual=${JSON.stringify(firstFailure.actual)}`)
}
process.exit(ok ? 0 : 1)

function check(path, actual, expected) {
  const ok = deepEqual(actual, expected)
  checks.push({ path, ok, actual, expected })
}

function checkStorageMath(descriptor) {
  const dims = descriptor.gguf_dimensions || []
  const blockSize = descriptor.storage_block_size
  const typeSize = descriptor.storage_type_size_bytes
  const rowValues = dims[0]
  const rowCount = dims.slice(1).reduce((product, dim) => product * dim, 1)
  const elementCount = dims.reduce((product, dim) => product * dim, 1)
  const rowSizeBytes = rowValues / blockSize * typeSize
  const rowStrideBytes = descriptor.storage_row_stride_values / blockSize * typeSize

  check('derived.storage_row_values_from_gguf_dimensions', descriptor.storage_row_values, rowValues)
  check('derived.storage_row_count_from_gguf_dimensions', descriptor.storage_row_count, rowCount)
  check('derived.element_count_from_gguf_dimensions', descriptor.element_count, elementCount)
  check('derived.storage_row_size_bytes', descriptor.storage_row_size_bytes, rowSizeBytes)
  check('derived.storage_row_stride_bytes', descriptor.storage_row_stride_bytes, rowStrideBytes)
  check('derived.n_bytes_from_row_stride', descriptor.n_bytes, rowCount * rowStrideBytes)
  check('derived.block_count_from_element_count', descriptor.block_count, elementCount / blockSize)
}

function checkRowBounds(path, row, elementCount) {
  if (!Number.isFinite(elementCount)) return
  const lastIndex = row.start + Math.max(0, row.len - 1) * row.stride
  check(`${path}.last_index_in_bounds`, lastIndex < elementCount, true)
}

function checkQ8ValueChecks(path, row) {
  for (const valueCheck of row.q8_0_value_checks || []) {
    check(`${path}.q8_0_value_checks.${valueCheck.element_index}.absolute_delta`, valueCheck.absolute_delta, 0)
  }
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function parseArgs(argv) {
  const parsed = new Map()
  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[idx + 1]
    if (!next || next.startsWith('--')) {
      parsed.set(key, 'true')
    } else {
      parsed.set(key, next)
      idx += 1
    }
  }
  return parsed
}
