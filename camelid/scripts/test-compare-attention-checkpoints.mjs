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
const compareScript = join(scriptDir, 'compare-attention-checkpoints.mjs')
const tempDir = await mkdtemp(join(tmpdir(), 'camelid-attention-checkpoints-'))

try {
  const leftPath = join(tempDir, 'left.json')
  const rightPath = join(tempDir, 'right.json')
  const reportPath = join(tempDir, 'report.json')
  await writeFile(leftPath, `${JSON.stringify(bundle({ score: 0.5, probability: 0.75 }), null, 2)}\n`)
  await writeFile(rightPath, `${JSON.stringify(bundle({ score: 0.625, probability: 0.75 }), null, 2)}\n`)

  const mismatch = await runCompare([
    '--left', leftPath,
    '--right', rightPath,
    '--json-out', reportPath,
  ])

  assert.equal(mismatch.code, 1)
  assert.match(mismatch.stdout, /matches=false/)
  assert.match(mismatch.stdout, /first_failure=layers\.2\.attention_trace\.heads\.0\.top_probability_positions\.17\.score/)

  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  assert.equal(report.matches, false)
  assert.equal(report.first_failure.path, 'layers.2.attention_trace.heads.0.top_probability_positions.17.score')

  const self = await runCompare(['--left', leftPath, '--right', leftPath])
  assert.equal(self.code, 0)
  assert.match(self.stdout, /matches=true/)

  console.log('compare-attention-checkpoints self-test passed')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

async function runCompare(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [compareScript, ...args], {
      cwd: resolve(scriptDir, '..'),
    })
    return { code: 0, stdout, stderr }
  } catch (error) {
    return {
      code: error.code ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    }
  }
}

function bundle({ score, probability }) {
  return {
    schema: 'camelid.attention-checkpoints.v1',
    prompt_token_ids: [1, 529, 29989, 1792],
    dense_metadata: {
      attention_head_count: 4,
      attention_head_count_kv: 2,
      embedding_length: 8,
      rope_dimension_count: 4,
      rope_pairing: 'adjacent_even_odd',
      rope_direction: 'forward',
      rope_position_mode: 'zero_based',
      rms_norm_epsilon: 0.00001,
    },
    layers: [
      {
        layer_index: 2,
        attention_input: stats([0.1, -0.2, 0.3, -0.4]),
        attention_norm: stats([0.2, -0.1, 0.4, -0.3]),
        q: projection('attention_norm', 'attention_q', [0.5, 0.25, -0.25, -0.5], [0.45, 0.2, -0.2, -0.45]),
        k: projection('attention_norm', 'attention_k', [0.1, 0.2, 0.3, 0.4], [0.12, 0.22, 0.32, 0.42]),
        v: projection('attention_norm', 'attention_v', [-0.1, 0.1, -0.2, 0.2]),
        o: {
          input_stage: 'attention_context',
          input: stats([0.05, 0.1, 0.15, 0.2]),
          output_stage: 'attention_output',
          output: stats([0.25, 0.2, 0.15, 0.1]),
        },
        attention_trace: {
          scale: 0.5,
          position_count: 18,
          head_dim: 4,
          heads: [
            {
              attention_head: 0,
              kv_head: 0,
              query_first_values: [0.45, 0.2, -0.2, -0.45],
              context_first_values: [0.05, 0.1, 0.15, 0.2],
              reconstructed_context_first_values: [0.05, 0.1, 0.15, 0.2],
              context_reconstruction_max_abs_delta_index: 0,
              context_reconstruction_max_abs_delta: 0,
              probability_sum: 1,
              probability_entropy: 0.5,
              probability_rms: 0.75,
              max_probability_position: 17,
              max_probability: probability,
              top_probability_positions: [
                {
                  position: 17,
                  score,
                  probability,
                  key_first_values: [0.12, 0.22, 0.32, 0.42],
                  value_first_values: [-0.1, 0.1, -0.2, 0.2],
                },
              ],
              positions: [
                {
                  position: 17,
                  score,
                  probability,
                  key_first_values: [0.12, 0.22, 0.32, 0.42],
                  value_first_values: [-0.1, 0.1, -0.2, 0.2],
                  reconstructed_score: score,
                  score_reconstruction_delta: 0,
                  qk_products_first_values: [0.054, 0.044, -0.064, -0.189],
                  qk_products_max_abs_window_start: 0,
                  qk_products_max_abs_window: [0.054, 0.044, -0.064, -0.189],
                },
              ],
            },
          ],
        },
        attention_residual: stats([0.35, 0, 0.45, -0.3]),
        ffn_input: stats([0.35, 0, 0.45, -0.3]),
      },
    ],
  }
}

function projection(inputStage, outputStage, output, ropeOutput) {
  const result = {
    input_stage: inputStage,
    output_stage: outputStage,
    output: stats(output),
  }
  if (ropeOutput) result.rope_output = stats(ropeOutput)
  return result
}

function stats(values) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const maxAbs = Math.max(...values.map(value => Math.abs(value)))
  const maxAbsIndex = values.findIndex(value => Math.abs(value) === maxAbs)
  return {
    shape: [values.length],
    len: values.length,
    min,
    min_index: values.indexOf(min),
    max,
    max_index: values.indexOf(max),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    rms: Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length),
    max_abs: maxAbs,
    max_abs_index: maxAbsIndex,
    first_values: values,
    max_abs_window_start: 0,
    max_abs_window: values,
  }
}
