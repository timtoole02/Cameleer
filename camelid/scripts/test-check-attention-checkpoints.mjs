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
const checkScript = join(scriptDir, 'check-attention-checkpoints.mjs')
const tempDir = await mkdtemp(join(tmpdir(), 'camelid-check-attention-checkpoints-'))

try {
  const validPath = join(tempDir, 'valid.json')
  const invalidPath = join(tempDir, 'invalid.json')
  const invalidTopProbabilityPath = join(tempDir, 'invalid-top-probability.json')
  const missingKvHeadPath = join(tempDir, 'missing-kv-head.json')

  await writeFile(validPath, `${JSON.stringify(bundle(), null, 2)}\n`)
  const invalidBundle = bundle()
  invalidBundle.layers[0].attention_trace.heads[0].probability_sum = 0.875
  await writeFile(invalidPath, `${JSON.stringify(invalidBundle, null, 2)}\n`)
  const invalidTopProbabilityBundle = bundle()
  invalidTopProbabilityBundle.layers[0].attention_trace.heads[0].top_probability_positions[1].probability = 0.45
  await writeFile(invalidTopProbabilityPath, `${JSON.stringify(invalidTopProbabilityBundle, null, 2)}\n`)
  const missingKvHeadBundle = bundle()
  missingKvHeadBundle.layers[0].attention_trace.heads[1] = sampleHead({ attentionHead: 1, kvHead: 0, query: [0.35, 0.15], context: [-0.05, -0.1] })
  await writeFile(missingKvHeadPath, `${JSON.stringify(missingKvHeadBundle, null, 2)}\n`)

  const valid = await runCheck(validPath)
  assert.equal(valid.code, 0)
  assert.match(valid.stdout, /schema=camelid\.attention-checkpoints\.v1/)
  assert.match(valid.stdout, /layers=2/)
  assert.match(valid.stdout, /valid=true/)

  const invalid = await runCheck(invalidPath)
  assert.equal(invalid.code, 1)
  assert.match(invalid.stdout, /valid=false/)
  assert.match(invalid.stdout, /first_failure=layers\.0\.attention_trace\.heads\.0\.probability_sum: expected sampled-head probability sum near 1/)

  const invalidTopProbability = await runCheck(invalidTopProbabilityPath)
  assert.equal(invalidTopProbability.code, 1)
  assert.match(invalidTopProbability.stdout, /valid=false/)
  assert.match(invalidTopProbability.stdout, /first_failure=layers\.0\.attention_trace\.heads\.0\.top_probability_positions\.1\.probability: expected descending probability order/)

  const missingKvHead = await runCheck(missingKvHeadPath)
  assert.equal(missingKvHead.code, 1)
  assert.match(missingKvHead.stdout, /valid=false/)
  assert.match(missingKvHead.stdout, /first_failure=layers\.0\.attention_trace\.heads: expected sampled heads to cover every grouped-query kv head/)

  console.log('check-attention-checkpoints self-test passed')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

async function runCheck(inputPath) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [checkScript, '--input', inputPath], {
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

function bundle() {
  return {
    schema: 'camelid.attention-checkpoints.v1',
    prompt_token_ids: [1, 529, 29989, 1792],
    dense_metadata: {
      attention_head_count: 4,
      attention_head_count_kv: 2,
      embedding_length: 8,
      rope_dimension_count: 2,
      rope_pairing: 'adjacent_even_odd',
      rope_direction: 'forward',
      rope_position_mode: 'zero_based',
      rms_norm_epsilon: 0.00001,
    },
    layers: [
      {
        layer_index: 2,
        attention_input: stats([0.1, -0.2, 0.3, -0.4, 0.5, -0.6, 0.7, -0.8]),
        attention_norm: stats([0.2, -0.1, 0.4, -0.3, 0.6, -0.5, 0.8, -0.7]),
        q: projection('attention_norm', 'attention_q', [0.5, 0.25, -0.25, -0.5, 0.4, 0.2, -0.2, -0.4], [0.45, 0.2, -0.2, -0.45, 0.35, 0.15, -0.15, -0.35]),
        k: projection('attention_norm', 'attention_k', [0.1, 0.2, 0.3, 0.4], [0.12, 0.22, 0.32, 0.42]),
        v: projection('attention_norm', 'attention_v', [-0.1, 0.1, -0.2, 0.2]),
        o: {
          input_stage: 'attention_context',
          input: stats([0.05, 0.1, 0.15, 0.2, -0.05, -0.1, -0.15, -0.2]),
          output_stage: 'attention_output',
          output: stats([0.25, 0.2, 0.15, 0.1, -0.25, -0.2, -0.15, -0.1]),
        },
        attention_trace: attentionTrace(),
        attention_residual: stats([0.35, 0, 0.45, -0.3, 0.25, -0.1, 0.55, -0.9]),
        ffn_input: stats([0.35, 0, 0.45, -0.3, 0.25, -0.1, 0.55, -0.9]),
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

function attentionTrace() {
  const scale = 1 / Math.sqrt(2)
  return {
    scale,
    position_count: 4,
    head_dim: 2,
    heads: [
      sampleHead({ attentionHead: 0, kvHead: 0, query: [0.45, 0.2], context: [0.05, 0.1] }),
      sampleHead({ attentionHead: 2, kvHead: 1, query: [0.35, 0.15], context: [-0.05, -0.1] }),
    ],
  }
}

function sampleHead({ attentionHead, kvHead, query, context }) {
  return {
    attention_head: attentionHead,
    kv_head: kvHead,
    query_first_values: query,
    context_first_values: context,
    reconstructed_context_first_values: context,
    context_reconstruction_max_abs_delta_index: 0,
    context_reconstruction_max_abs_delta: 0,
    probability_sum: 1,
    probability_entropy: 1.0,
    probability_rms: 0.5,
    max_probability_position: 3,
    max_probability: 0.4,
    top_probability_positions: [
      position(3, 0.4, 0.4),
      position(2, 0.3, 0.3),
      position(1, 0.2, 0.2),
      position(0, 0.1, 0.1),
    ],
    positions: [
      position(0, 0.1, 0.1),
      position(1, 0.2, 0.2),
      position(2, 0.3, 0.3),
      position(3, 0.4, 0.4),
    ],
  }
}

function position(index, score, probability) {
  return {
    position: index,
    score,
    probability,
    key_first_values: [0.12 + index * 0.01, 0.22 + index * 0.01],
    value_first_values: [-0.1 + index * 0.01, 0.1 - index * 0.01],
    reconstructed_score: score,
    score_reconstruction_delta: 0,
    qk_products_first_values: [0.054 + index * 0.001, 0.044 - index * 0.001],
    qk_products_max_abs_window_start: 0,
    qk_products_max_abs_window: [0.054 + index * 0.001, 0.044 - index * 0.001],
  }
}

function stats(values) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const maxAbs = Math.max(...values.map(value => Math.abs(value)))
  const maxAbsIndex = values.findIndex(value => Math.abs(value) === maxAbs)
  return {
    shape: [1, values.length],
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
