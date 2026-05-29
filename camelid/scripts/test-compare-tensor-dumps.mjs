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
const compareScript = join(scriptDir, 'compare-tensor-dumps.mjs')
const tempDir = await mkdtemp(join(tmpdir(), 'camelid-tensor-dump-compare-'))

try {
  const leftPath = join(tempDir, 'left.json')
  const rightPath = join(tempDir, 'right.json')
  const reportPath = join(tempDir, 'report.json')
  const mismatchPath = join(tempDir, 'mismatch.json')
  const rowStrideMismatchPath = join(tempDir, 'row-stride-mismatch.json')
  const rowLayoutMismatchPath = join(tempDir, 'row-layout-mismatch.json')
  const q8ValueMismatchPath = join(tempDir, 'q8-value-mismatch.json')
  await writeFile(leftPath, `${JSON.stringify(dump(), null, 2)}\n`)
  await writeFile(rightPath, `${JSON.stringify(dump(), null, 2)}\n`)

  const { stdout } = await execFileAsync(process.execPath, [
    compareScript,
    '--left', leftPath,
    '--right', rightPath,
    '--json-out', reportPath,
  ], { cwd: resolve(scriptDir, '..') })

  assert.match(stdout, /tensor_dump_samples_match=true/)
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  assert.equal(report.match, true)
  const comparisonPaths = report.comparisons.map(comparison => comparison.path)
  assert.ok(comparisonPaths.includes('output.weight.descriptor.gguf_dimension_strides'))
  assert.ok(comparisonPaths.includes('output.weight.descriptor.runtime_row_major_strides'))
  assert.ok(comparisonPaths.includes('output.weight.descriptor.storage_row_size_bytes'))
  assert.ok(comparisonPaths.includes('output.weight.descriptor.storage_row_stride_bytes'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.logical_token_rows.315.stride'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.logical_token_rows.315.source_layout'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.logical_token_rows.315.q8_0_blocks.20160.value_start'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.logical_token_rows.315.q8_0_blocks.20160.dequantized_values'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.logical_token_rows.315.q8_0_value_checks.645120.block_offset'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.logical_token_rows.315.q8_0_value_checks.645120.dequantized'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.descriptor_token_columns.315.stride'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.descriptor_token_columns.315.source_layout'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.descriptor_token_columns.315.q8_0_blocks.9.value_start'))
  assert.ok(comparisonPaths.includes('output.weight.decoded.descriptor_token_columns.315.q8_0_value_checks.315.dequantized'))

  const mismatched = dump()
  mismatched.tensors[0].descriptor.gguf_dimension_strides = [1, 999]
  await writeFile(mismatchPath, `${JSON.stringify(mismatched, null, 2)}\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [compareScript, '--left', leftPath, '--right', mismatchPath], { cwd: resolve(scriptDir, '..') }),
    error => {
      assert.equal(error.code, 1)
      assert.match(error.stdout, /first_tensor_failure=output\.weight\.descriptor\.gguf_dimension_strides/)
      assert.match(error.stdout, /failure_reason=json_mismatch/)
      return true
    },
  )

  const rowStrideMismatch = dump()
  rowStrideMismatch.tensors[0].decoded.logical_token_rows[0].stride = 32000
  await writeFile(rowStrideMismatchPath, `${JSON.stringify(rowStrideMismatch, null, 2)}\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [compareScript, '--left', leftPath, '--right', rowStrideMismatchPath], { cwd: resolve(scriptDir, '..') }),
    error => {
      assert.equal(error.code, 1)
      assert.match(error.stdout, /first_tensor_failure=output\.weight\.decoded\.logical_token_rows\.315\.stride/)
      assert.match(error.stdout, /failure_reason=json_mismatch/)
      return true
    },
  )

  const rowLayoutMismatch = dump()
  rowLayoutMismatch.tensors[0].decoded.logical_token_rows[0].source_layout = 'token_row'
  await writeFile(rowLayoutMismatchPath, `${JSON.stringify(rowLayoutMismatch, null, 2)}\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [compareScript, '--left', leftPath, '--right', rowLayoutMismatchPath], { cwd: resolve(scriptDir, '..') }),
    error => {
      assert.equal(error.code, 1)
      assert.match(error.stdout, /first_tensor_failure=output\.weight\.decoded\.logical_token_rows\.315\.source_layout/)
      assert.match(error.stdout, /failure_reason=json_mismatch/)
      return true
    },
  )

  const q8ValueMismatch = dump()
  q8ValueMismatch.tensors[0].decoded.logical_token_rows[0].q8_0_value_checks[0].quant_value = 2
  await writeFile(q8ValueMismatchPath, `${JSON.stringify(q8ValueMismatch, null, 2)}\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [compareScript, '--left', leftPath, '--right', q8ValueMismatchPath], { cwd: resolve(scriptDir, '..') }),
    error => {
      assert.equal(error.code, 1)
      assert.match(error.stdout, /first_tensor_failure=output\.weight\.decoded\.logical_token_rows\.315\.q8_0_value_checks\.645120\.quant_value/)
      assert.match(error.stdout, /failure_reason=json_mismatch/)
      return true
    },
  )

  console.log('compare-tensor-dumps self-test passed')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

function dump() {
  return {
    object: 'camelid.tensor_dump',
    path: '/tmp/tinyllama.gguf',
    tensors: [
      {
        name: 'output.weight',
        descriptor: {
          gguf_dimensions: [2048, 32000],
          gguf_dimension_strides: [1, 2048],
          runtime_shape: [2048, 32000],
          runtime_row_major_strides: [32000, 1],
          tensor_type: 'Q8_0',
          absolute_offset: 128,
          relative_offset: 0,
          n_bytes: 69632000,
          element_count: 65536000,
          block_count: 2048000,
          storage_block_size: 32,
          storage_type_size_bytes: 34,
          storage_row_values: 2048,
          storage_row_count: 32000,
          storage_row_stride_values: 2048,
          storage_row_size_bytes: 2176,
          storage_row_stride_bytes: 2176,
        },
        decoded: {
          first_values: [0.5, -0.25],
          max_abs_window_start: 2048,
          max_abs_window: [0.75, -0.5],
          stats: {
            min: -1,
            max: 1,
            mean: 0,
            rms: 0.5,
            max_abs: 1,
            max_abs_index: 4096,
          },
          rows: [
            {
              row: 315,
              start: 10080000,
              stride: 1,
              len: 32000,
              first_values: [0.25, 0.5],
              max_abs_window_start: 10080080,
              max_abs_window: [0.75, -0.25],
              q8_0_blocks: [],
              q8_0_value_checks: [],
            },
          ],
          logical_token_rows: [
            {
              token_id: 315,
              start: 645120,
              stride: 1,
              len: 2048,
              source_layout: 'gguf_output_token_major_shape_reinterpreted',
              first_values: [0.25, 0.5],
              max_abs_window_start: 645280,
              max_abs_window: [0.75, -0.25],
              q8_0_blocks: [
                { block: 20160, value_start: 645120, scale: 0.01, quant_values: [1, -2, 3], dequantized_values: [0.01, -0.02, 0.03] },
              ],
              q8_0_value_checks: [
                { element_index: 645120, block: 20160, block_offset: 0, scale: 0.01, quant_value: 1, dequantized: 0.01, decoded: 0.01, absolute_delta: 0 },
              ],
            },
          ],
          descriptor_token_columns: [
            {
              token_id: 315,
              start: 315,
              stride: 32000,
              len: 2048,
              source_layout: 'descriptor_output_column',
              first_values: [0.25, 0.5],
              max_abs_window_start: 320315,
              max_abs_window: [0.75, -0.25],
              q8_0_blocks: [
                { block: 9, value_start: 288, scale: 0.01, quant_values: [1, -2, 3], dequantized_values: [0.01, -0.02, 0.03] },
              ],
              q8_0_value_checks: [
                { element_index: 315, block: 9, block_offset: 27, scale: 0.01, quant_value: 1, dequantized: 0.01, decoded: 0.01, absolute_delta: 0 },
              ],
            },
          ],
        },
        q8_0: {
          block_count: 2048000,
          scale: {
            min: 0,
            max: 0.25,
            mean: 0.01,
            rms: 0.02,
            max_abs: 0.25,
            max_abs_index: 3,
          },
          first_scales: [0.01, 0.02],
          first_block_quants: [1, -1, 2],
          max_abs_scale_block: 3,
          max_abs_scale_block_quants: [3, -4, 5],
        },
      },
    ],
  }
}
