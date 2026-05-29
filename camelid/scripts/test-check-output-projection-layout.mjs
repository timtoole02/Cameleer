#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const scriptDir = dirname(fileURLToPath(import.meta.url))
const checkScript = join(scriptDir, 'check-output-projection-layout.mjs')
const tempDir = await mkdtemp(join(tmpdir(), 'camelid-output-layout-check-'))

try {
  const okPath = join(tempDir, 'ok.json')
  const badPath = join(tempDir, 'bad.json')
  const badStoragePath = join(tempDir, 'bad-storage.json')
  const badNBytesPath = join(tempDir, 'bad-n-bytes.json')
  const badQ8Path = join(tempDir, 'bad-q8.json')
  await writeFile(okPath, `${JSON.stringify(dump(), null, 2)}\n`)

  const { stdout } = await execFileAsync(process.execPath, [
    checkScript,
    '--tensor-dump', okPath,
    '--hidden', '2048',
    '--vocab', '32000',
  ], { cwd: resolve(scriptDir, '..') })
  assert.match(stdout, /output_projection_layout_ok=true/)
  assert.match(stdout, /storage_row_size_bytes=2176/)
  assert.match(stdout, /29907:gguf_output_token_major_shape_reinterpreted:start=61249536:stride=1/)
  assert.match(stdout, /29907:descriptor_output_column:start=29907:stride=32000/)

  const bad = dump()
  bad.tensors[0].decoded.logical_token_rows[0].stride = 32000
  await writeFile(badPath, `${JSON.stringify(bad, null, 2)}\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [checkScript, '--tensor-dump', badPath], { cwd: resolve(scriptDir, '..') }),
    error => {
      assert.equal(error.code, 1)
      assert.match(error.stdout, /output_projection_layout_ok=false/)
      assert.match(error.stdout, /first_failure=logical_token_rows\.29907\.stride/)
      return true
    },
  )

  const badStorage = dump()
  badStorage.tensors[0].descriptor.storage_row_stride_bytes = 32000
  await writeFile(badStoragePath, `${JSON.stringify(badStorage, null, 2)}\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [checkScript, '--tensor-dump', badStoragePath], { cwd: resolve(scriptDir, '..') }),
    error => {
      assert.equal(error.code, 1)
      assert.match(error.stdout, /output_projection_layout_ok=false/)
      assert.match(error.stdout, /first_failure=descriptor\.storage_row_stride_bytes/)
      return true
    },
  )

  const badNBytes = dump()
  badNBytes.tensors[0].descriptor.n_bytes += 2176
  await writeFile(badNBytesPath, `${JSON.stringify(badNBytes, null, 2)}\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [checkScript, '--tensor-dump', badNBytesPath], { cwd: resolve(scriptDir, '..') }),
    error => {
      assert.equal(error.code, 1)
      assert.match(error.stdout, /output_projection_layout_ok=false/)
      assert.match(error.stdout, /first_failure=descriptor\.n_bytes/)
      return true
    },
  )

  const badQ8 = dump()
  badQ8.tensors[0].decoded.logical_token_rows[0].q8_0_value_checks[0].absolute_delta = 0.125
  await writeFile(badQ8Path, `${JSON.stringify(badQ8, null, 2)}\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [checkScript, '--tensor-dump', badQ8Path], { cwd: resolve(scriptDir, '..') }),
    error => {
      assert.equal(error.code, 1)
      assert.match(error.stdout, /output_projection_layout_ok=false/)
      assert.match(error.stdout, /first_failure=logical_token_rows\.29907\.q8_0_value_checks\.61249536\.absolute_delta/)
      return true
    },
  )

  console.log('check-output-projection-layout self-test passed')
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
          rows: [],
          logical_token_rows: [
            {
              token_id: 29907,
              start: 61249536,
              stride: 1,
              len: 2048,
              source_layout: 'gguf_output_token_major_shape_reinterpreted',
              first_values: [],
              max_abs_window_start: 61249536,
              max_abs_window: [],
              q8_0_blocks: [],
              q8_0_value_checks: [
                {
                  element_index: 61249536,
                  block: 1914048,
                  block_offset: 0,
                  scale: 1,
                  quant_value: 1,
                  dequantized: 1,
                  decoded: 1,
                  absolute_delta: 0,
                },
              ],
            },
          ],
          descriptor_token_columns: [
            {
              token_id: 29907,
              start: 29907,
              stride: 32000,
              len: 2048,
              source_layout: 'descriptor_output_column',
              first_values: [],
              max_abs_window_start: 29907,
              max_abs_window: [],
              q8_0_blocks: [],
              q8_0_value_checks: [
                {
                  element_index: 29907,
                  block: 934,
                  block_offset: 19,
                  scale: 1,
                  quant_value: 1,
                  dequantized: 1,
                  decoded: 1,
                  absolute_delta: 0,
                },
              ],
            },
          ],
        },
      },
    ],
  }
}
