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
const compareScript = join(scriptDir, 'compare-dense-stage-flow.mjs')
const tempDir = await mkdtemp(join(tmpdir(), 'camelid-dense-stage-flow-'))

try {
  const leftPath = join(tempDir, 'left.json')
  const rightPath = join(tempDir, 'right.json')
  const reportPath = join(tempDir, 'report.json')
  await writeFile(leftPath, `${JSON.stringify(capture({ generated: [10], qFirst: 1, ffnRms: 2, selectedLogit: 3, finalNormMaxDelta: 0 }), null, 2)}\n`)
  await writeFile(rightPath, `${JSON.stringify(capture({ generated: [20], qFirst: 1.25, ffnRms: 5, selectedLogit: 2.5, finalNormMaxDelta: 0.75 }), null, 2)}\n`)

  const { stdout } = await execFileAsync(process.execPath, [
    compareScript,
    '--left', leftPath,
    '--right', rightPath,
    '--top', '4',
    '--json-out', reportPath,
  ], { cwd: resolve(scriptDir, '..') })

  assert.match(stdout, /prompt_tokens_match=true/)
  assert.match(stdout, /first_changed_stage=layers\.0\.attention_q/)
  assert.match(stdout, /dense_layout_metadata_deltas=/)
  assert.match(stdout, /largest_residual_metric_deltas=/)
  assert.match(stdout, /largest_reconstruction_deltas=/)
  assert.match(stdout, /largest_attention_trace_deltas=/)
  assert.match(stdout, /output_projection_token_deltas=/)

  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  assert.equal(report.prompt_tokens_match, true)
  assert.deepEqual(report.generated_token_delta, { left: [10], right: [20], match: false })
  assert.equal(report.first_changed_stage.path, 'layers.0.attention_q')
  assert.equal(report.first_changed_stage.first_values_max_abs_delta, 0.25)
  assert.equal(report.first_changed_stage.shape_match, false)
  assert.deepEqual(report.first_changed_stage.left_shape, [2])
  assert.deepEqual(report.first_changed_stage.right_shape, [1, 2])
  assert.ok(report.largest_stage_deltas.some(delta => delta.path === 'layers.0.ffn_output' && delta.rms_delta === 3))
  assert.deepEqual(report.largest_residual_metric_deltas.map(delta => delta.path), [
    'layers.0.residual_flow.ffn_delta',
    'layers.0.residual_flow.attention_delta',
  ])
  assert.equal(report.largest_residual_metric_deltas[0].reported_rms_delta, 3)
  assert.deepEqual(report.largest_reconstruction_deltas.map(delta => delta.path), [
    'final_norm',
    'layers.0.attention_q_reconstruction',
    'layers.0.ffn_activation_reconstruction',
  ])
  assert.equal(report.largest_reconstruction_deltas[0].max_abs_delta_delta, 0.75)
  assert.equal(report.largest_attention_trace_deltas.length, 1)
  const attentionDelta = report.largest_attention_trace_deltas[0]
  assert.equal(attentionDelta.path, 'layers.0.attention_trace.heads.0')
  assert.equal(attentionDelta.layer_index, 0)
  assert.equal(attentionDelta.attention_head, 0)
  assert.equal(attentionDelta.kv_head, 0)
  assert.equal(attentionDelta.dominant_metric, 'score_max_abs_diff')
  assert.equal(attentionDelta.max_abs_delta, 2)
  assert.equal(attentionDelta.first_position_diff_index, 1)
  assert.equal(attentionDelta.metrics.context_first_values_max_abs_diff, 1)
  assert.equal(attentionDelta.metrics.score_max_abs_diff, 2)
  assert.equal(attentionDelta.attention_head_match, true)
  assert.equal(attentionDelta.kv_head_match, true)
  assert.equal(attentionDelta.sampled_position_count_match, true)
  assert.ok(report.dense_metadata_deltas.some(delta => delta.key === 'projection_orientations'))
  assert.ok(report.dense_layout_metadata_deltas.some(delta => delta.path === 'rope_pairing'))
  assert.ok(report.dense_layout_metadata_deltas.some(delta => delta.path === 'rectangular_linear_diagnostic_layout'))
  assert.ok(report.dense_layout_metadata_deltas.some(delta => delta.path === 'projection_orientations.attention_k.runtime_interpretation'))
  assert.deepEqual(report.output_projection_token_deltas, [
    {
      token_id: 10,
      reported_logit_delta: 0.5,
      reconstructed_logit_delta: 0.5,
      max_abs_component_index_match: false,
      max_abs_component_delta: 0.25,
    },
  ])

  const { stdout: selfStdout } = await execFileAsync(process.execPath, [compareScript, '--left', leftPath, '--right', leftPath], {
    cwd: resolve(scriptDir, '..'),
  })
  assert.match(selfStdout, /first_changed_stage=none/)

  console.log('compare-dense-stage-flow self-test passed')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

function capture({ generated, qFirst, ffnRms, selectedLogit, finalNormMaxDelta }) {
  return {
    camelid: {
      prompt_token_ids: [1, 529, 29989, 1792],
      generated_token_ids: generated,
      dense_metadata: {
        rms_norm_effective_epsilon: selectedLogit === 3 ? 0.00001 : 0.000001,
        rope_pairing: selectedLogit === 3 ? 'adjacent_even_odd' : 'split_half',
        rectangular_linear_diagnostic_layout: selectedLogit === 3 ? 'descriptor' : 'transposed',
        projection_orientations: {
          attention_k: {
            shape: [2, 4],
            input_width: 4,
            output_width: 2,
            descriptor_layout: 'input_output',
            runtime_interpretation: selectedLogit === 3 ? 'descriptor' : 'transposed',
            square_diagnostic_applies: false,
          },
        },
      },
      dense: {
        embedding: stats({ first: [0.5, 0.25], rms: 0.6, maxAbsIndex: 0 }),
        layers: [
          {
            layer_index: 0,
            residual_flow: {
              attention_input: stats({ first: [0.5, 0.25], rms: 0.6, maxAbsIndex: 0 }),
              attention_delta: residualDelta({ inputRms: 0.6, deltaRms: selectedLogit === 3 ? 0.25 : 0.75, reportedRms: 0.8, ratio: selectedLogit === 3 ? 0.4 : 1.2, cosine: selectedLogit === 3 ? 0.1 : -0.2 }),
              ffn_input: stats({ first: [0.75, 0.25], rms: 0.8, maxAbsIndex: 0 }),
              ffn_delta: residualDelta({ inputRms: 0.8, deltaRms: ffnRms, reportedRms: ffnRms + 0.5, ratio: ffnRms / 0.8, cosine: 0.25 }),
            },
            attention_norm: stats({ first: [0.5, 0.25], rms: 0.6, maxAbsIndex: 0 }),
            attention_q: stats({ first: [qFirst, -0.5], rms: 1.2, maxAbsIndex: 0, shape: selectedLogit === 3 ? [2] : [1, 2] }),
            attention_q_reconstruction: reconstruction({ reportedMaxAbs: qFirst, maxDelta: selectedLogit === 3 ? 0 : 0.5 }),
            attention_k: stats({ first: [0.1, -0.1], rms: 0.2, maxAbsIndex: 0 }),
            attention_q_rope: stats({ first: [qFirst, -0.5], rms: 1.2, maxAbsIndex: 0 }),
            attention_k_rope: stats({ first: [0.1, -0.1], rms: 0.2, maxAbsIndex: 0 }),
            attention_v: stats({ first: [0.2, 0.3], rms: 0.4, maxAbsIndex: 1 }),
            attention_context: stats({ first: [0.2, 0.3], rms: 0.4, maxAbsIndex: 1 }),
            attention_output: stats({ first: [0.25, 0], rms: 0.25, maxAbsIndex: 0 }),
            attention_trace: attentionTrace({ changed: selectedLogit !== 3 }),
            attention_residual: stats({ first: [0.75, 0.25], rms: 0.8, maxAbsIndex: 0 }),
            ffn_norm: stats({ first: [0.75, 0.25], rms: 0.8, maxAbsIndex: 0 }),
            ffn_gate: stats({ first: [1, 2], rms: 2, maxAbsIndex: 1 }),
            ffn_up: stats({ first: [1, 1], rms: 1, maxAbsIndex: 0 }),
            ffn_activation: stats({ first: [0.73, 1.76], rms: 1.4, maxAbsIndex: 1 }),
            ffn_activation_reconstruction: reconstruction({ reportedMaxAbs: selectedLogit === 3 ? 1.76 : 2.01, maxDelta: 0 }),
            ffn_output: stats({ first: [ffnRms, 0], rms: ffnRms, maxAbsIndex: 0 }),
            ffn_residual: stats({ first: [ffnRms + 0.75, 0.25], rms: ffnRms + 0.5, maxAbsIndex: 0 }),
          },
        ],
        final_hidden: stats({ first: [ffnRms + 0.75, 0.25], rms: ffnRms + 0.5, maxAbsIndex: 0 }),
        final_norm: reconstruction({ reportedMaxAbs: 1, maxDelta: finalNormMaxDelta }),
        output_norm: stats({ first: [1, 0.1], rms: 0.8, maxAbsIndex: 0 }),
        logits: stats({ first: [selectedLogit, -1], rms: 2, maxAbsIndex: 0 }),
      },
      output_projection: [
        {
          token_id: 10,
          reported_logit: selectedLogit,
          reconstructed_logit: selectedLogit,
          max_abs_component_index: selectedLogit === 3 ? 0 : 1,
          max_abs_component: selectedLogit === 3 ? 1 : 0.75,
        },
      ],
    },
  }
}

function stats({ first, rms, maxAbsIndex, shape = [first.length] }) {
  const min = Math.min(...first)
  const max = Math.max(...first)
  const maxAbs = Math.max(...first.map(value => Math.abs(value)))
  return {
    shape,
    len: first.length,
    min,
    max,
    mean: first.reduce((sum, value) => sum + value, 0) / first.length,
    rms,
    max_abs: maxAbs,
    min_index: first.indexOf(min),
    max_index: first.indexOf(max),
    max_abs_index: maxAbsIndex,
    checkpoint: {
      shape,
      len: first.length,
      first_values: first,
      max_abs_window_start: 0,
      max_abs_window: first,
    },
  }
}

function attentionTrace({ changed }) {
  return {
    scale: 0.125,
    position_count: 2,
    head_dim: 2,
    heads: [
      {
        attention_head: 0,
        kv_head: 0,
        query_first_values: changed ? [0.5, 0.2] : [0.1, 0.2],
        context_first_values: changed ? [0.2, 1.3] : [0.2, 0.3],
        reconstructed_context_first_values: changed ? [0.2, 1.1] : [0.2, 0.3],
        context_reconstruction_max_abs_delta: changed ? 0.125 : 0,
        probability_entropy: changed ? 0.9 : 0.7,
        probability_rms: changed ? 0.75 : 0.5,
        positions: [
          { position: 0, score: 1, probability: 0.2 },
          { position: 1, score: changed ? 4 : 2, probability: changed ? 0.5 : 0.8 },
        ],
      },
    ],
  }
}

function residualDelta({ inputRms, deltaRms, reportedRms, ratio, cosine }) {
  return {
    input_rms: inputRms,
    delta_rms: deltaRms,
    reported_rms: reportedRms,
    delta_to_input_rms_ratio: ratio,
    delta_input_cosine_similarity: cosine,
    max_abs_delta: 0,
  }
}

function reconstruction({ reportedMaxAbs, maxDelta }) {
  return {
    reported_max_abs_index: 0,
    reported_max_abs: reportedMaxAbs,
    reported_max_abs_window: [reportedMaxAbs, 0.25],
    reconstructed_reported_max_abs_window: [reportedMaxAbs - maxDelta, 0.25],
    max_abs_delta: maxDelta,
  }
}
