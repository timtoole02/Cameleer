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
const summarizeScript = join(scriptDir, 'summarize-dense-capture.mjs')
const tempDir = await mkdtemp(join(tmpdir(), 'camelid-dense-summary-'))

try {
  const inputPath = join(tempDir, 'capture.json')
  const outputPath = join(tempDir, 'summary.json')
  await writeFile(inputPath, `${JSON.stringify(minimalCapture(), null, 2)}\n`)

  const { stdout } = await execFileAsync(process.execPath, [summarizeScript, '--input', inputPath, '--json-out', outputPath], {
    cwd: resolve(scriptDir, '..'),
  })
  assert.match(stdout, /known_good_margin_summary=/)
  assert.match(stdout, /output_projection_pairwise=/)
  assert.match(stdout, /output_projection_component_stage_hits=/)
  assert.match(stdout, /output_projection_component_window_flow=/)
  assert.match(stdout, /output_projection_component_latest_stage_focus=/)
  assert.match(stdout, /output_projection_component_final_norm_bridge=/)

  const summary = JSON.parse(await readFile(outputPath, 'utf8'))
  assert.deepEqual(summary.backend_generated_tokens, [10])
  assert.deepEqual(summary.known_good_generated_tokens, [20])
  assert.deepEqual(summary.known_good_margin_summary, {
    checked: 1,
    found: 1,
    missing_token_ids: [],
    closest_ranked_token: { token_id: 20, rank: 2, margin: 1, text: 'known-good-token' },
    smallest_margin_token: { token_id: 20, rank: 2, margin: 1, text: 'known-good-token' },
    largest_margin_token: { token_id: 20, rank: 2, margin: 1, text: 'known-good-token' },
  })
  assert.equal(summary.output_projection.checked, 2)

  const selected = summary.output_projection.rows.find(row => row.token_id === 10)
  assert.ok(selected)
  assert.equal(selected.signed_component_sum, 1.5)
  assert.equal(selected.signed_component_reconstruction_delta, 0)

  const [pairwise] = summary.output_projection_pairwise
  assert.equal(pairwise.found, true)
  assert.equal(pairwise.reported_logit_gap, 1)
  assert.deepEqual(pairwise.shared_top_component_dimensions, [1])
  assert.deepEqual(pairwise.backend_only_top_component_dimensions, [2])
  assert.deepEqual(pairwise.known_good_only_top_component_dimensions, [3, 0])
  assert.deepEqual(pairwise.component_deltas.map(entry => entry.index), [1, 2, 3, 0])
  assert.equal(pairwise.component_deltas[0].component_delta, 0.25)
  assert.equal(pairwise.component_deltas[0].final_hidden_value, 2)
  assert.equal(pairwise.component_deltas[0].output_norm_weight_value, 1)
  assert.equal(pairwise.component_deltas[0].output_norm_scale, 0.5)
  assert.equal(pairwise.component_deltas[0].reconstructed_output_norm_value, 1)
  assert.equal(pairwise.component_deltas[0].output_norm_reconstruction_delta, 0)
  assert.equal(selected.top_positive_components[0].final_hidden_value, 2)
  assert.equal(selected.top_positive_components[0].reconstructed_output_norm_value, 1)

  assert.equal(summary.output_projection_component_stage_hits.checked, 2)
  const selectedHits = summary.output_projection_component_stage_hits.rows.find(row => row.label === 'backend_selected')
  assert.ok(selectedHits)
  assert.deepEqual(selectedHits.inspected_component_dimensions, [1, 2])
  assert.deepEqual(selectedHits.stage_hits[0].hits.map(hit => `${hit.scope}:${hit.stage}`), [
    'root:final_hidden',
    'root:output_norm',
    'layer:attention_norm',
  ])
  assert.deepEqual(selectedHits.stage_hits[1].hits, [])

  assert.equal(summary.output_projection_component_window_flow.checked, 2)
  const selectedWindowFlow = summary.output_projection_component_window_flow.rows.find(row => row.label === 'backend_selected')
  assert.ok(selectedWindowFlow)
  const selectedDimOneFlow = selectedWindowFlow.component_flows.find(flow => flow.index === 1)
  assert.ok(selectedDimOneFlow)
  assert.deepEqual(selectedDimOneFlow.checkpoint_window_hits.map(hit => `${hit.scope}:${hit.stage}:${hit.value}`), [
    'root:final_hidden:2',
    'root:output_norm:1',
    'layer:attention_norm:2',
  ])
  const selectedDimTwoFlow = selectedWindowFlow.component_flows.find(flow => flow.index === 2)
  assert.ok(selectedDimTwoFlow)
  assert.deepEqual(selectedDimTwoFlow.checkpoint_window_hits.map(hit => `${hit.scope}:${hit.stage}:${hit.value}`), [
    'root:final_hidden:0',
    'root:output_norm:0',
    'layer:attention_norm:0',
  ])

  assert.equal(summary.output_projection_component_latest_stage_focus.checked, 2)
  const selectedLatestFocus = summary.output_projection_component_latest_stage_focus.rows.find(row => row.label === 'backend_selected')
  assert.ok(selectedLatestFocus)
  const selectedDimOneFocus = selectedLatestFocus.dimensions.find(dimension => dimension.index === 1)
  assert.ok(selectedDimOneFocus)
  assert.equal(selectedDimOneFocus.window_hit_count, 3)
  assert.equal(selectedDimOneFocus.max_abs_hit_count, 3)
  assert.equal(selectedDimOneFocus.latest_layer_window_hit.stage, 'attention_norm')
  assert.equal(selectedDimOneFocus.latest_root_window_hit.stage, 'output_norm')
  assert.equal(selectedDimOneFocus.latest_layer_max_abs_hit.stage, 'attention_norm')
  assert.equal(selectedDimOneFocus.latest_root_max_abs_hit.stage, 'output_norm')
  assert.equal(selectedDimOneFocus.output_norm_reconstruction_delta, 0)

  assert.equal(summary.output_projection_component_final_norm_bridge.checked, 2)
  const selectedBridge = summary.output_projection_component_final_norm_bridge.rows.find(row => row.label === 'backend_selected')
  assert.ok(selectedBridge)
  const selectedDimOneBridge = selectedBridge.dimensions.find(dimension => dimension.index === 1)
  assert.ok(selectedDimOneBridge)
  assert.equal(selectedDimOneBridge.final_hidden_value, 2)
  assert.equal(selectedDimOneBridge.output_norm_weight_value, 1)
  assert.equal(selectedDimOneBridge.output_norm_scale, 0.5)
  assert.equal(selectedDimOneBridge.reconstructed_output_norm_value, 1)
  assert.equal(selectedDimOneBridge.output_norm_value, 1)
  assert.equal(selectedDimOneBridge.reconstructed_vs_reported_output_norm_delta, 0)
  assert.equal(selectedDimOneBridge.final_hidden_checkpoint_value, 2)
  assert.equal(selectedDimOneBridge.output_norm_checkpoint_value, 1)
  assert.equal(selectedDimOneBridge.final_hidden_checkpoint_delta, 0)
  assert.equal(selectedDimOneBridge.output_norm_checkpoint_delta, 0)
  assert.deepEqual(selectedDimOneBridge.root_checkpoint_hits.map(hit => `${hit.stage}:${hit.value}`), [
    'final_hidden:2',
    'output_norm:1',
  ])

  const knownGoodBridge = summary.output_projection_component_final_norm_bridge.rows.find(row => row.label === 'known_good')
  assert.ok(knownGoodBridge)
  const knownNegativeBridge = knownGoodBridge.dimensions.find(dimension => dimension.index === 0)
  assert.ok(knownNegativeBridge)
  assert.equal(knownNegativeBridge.component, -0.25)
  assert.equal(knownNegativeBridge.final_hidden_checkpoint_value, -1)
  assert.equal(knownNegativeBridge.output_norm_checkpoint_value, -0.5)
  assert.equal(knownNegativeBridge.output_norm_reconstruction_delta, 0)
  assert.equal(knownNegativeBridge.reconstructed_vs_reported_output_norm_delta, 0)

  console.log('summarize-dense-capture self-test passed')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

function minimalCapture() {
  return {
    prompt_tokens_match: true,
    generated_text_match: false,
    backend_text: 'backend-token',
    llama_text: 'known-good-token',
    llama_generated_token_ids: [20],
    camelid: {
      generated_token_ids: [10],
      top_logits: [
        { token_id: 10, text: 'backend-token', rank: 1, logit: 3.5 },
        { token_id: 20, text: 'known-good-token', rank: 2, logit: 2.5 },
      ],
      dense_metadata: { rms_norm_effective_epsilon: 0.00001 },
      dense: {
        layers: [
          {
            layer_index: 0,
            attention_norm: { rms: 1, max_abs: 2, max_abs_index: 1, checkpoint: { shape: [4], len: 4, first_values: [0, 2, 0, 0], max_abs_window_start: 0, max_abs_window: [0, 2, 0, 0] } },
            residual_flow: {
              attention_delta: { max_abs_delta: 0, delta_to_input_rms_ratio: 0.5, delta_input_cosine_similarity: 0.25 },
            },
          },
        ],
        final_norm: { epsilon: 0.00001, hidden_mean_square: 4, hidden_rms: 2, scale: 0.5, max_abs_delta: 0 },
        logits: { shape: [32], rms: 1, min: -1, max: 3.5, mean: 0, max_abs: 3.5, max_abs_index: 10 },
        final_hidden: { shape: [4], rms: 1, min: -1, max: 2, mean: 0, max_abs: 2, max_abs_index: 1, checkpoint: { shape: [4], len: 4, first_values: [-1, 2, 0, 0], max_abs_window_start: 0, max_abs_window: [-1, 2, 0, 0] } },
        output_norm: { shape: [4], rms: 1, min: -1, max: 1, mean: 0, max_abs: 1, max_abs_index: 1, checkpoint: { shape: [4], len: 4, first_values: [-0.5, 1, 0, 0], max_abs_window_start: 0, max_abs_window: [-0.5, 1, 0, 0] } },
      },
      output_projection: [
        {
          token_id: 10,
          layout: 'descriptor',
          reported_logit: 3.5,
          reconstructed_logit: 1.5,
          absolute_delta: 0,
          positive_component_sum: 2,
          negative_component_sum: -0.5,
          top_positive_components: [
            { index: 1, final_hidden_value: 2, output_norm_weight_value: 1, output_norm_scale: 0.5, reconstructed_output_norm_value: 1, output_norm_reconstruction_delta: 0, output_norm_value: 1, output_row_value: 1, component: 1 },
            { index: 2, final_hidden_value: 2, output_norm_weight_value: 1, output_norm_scale: 0.5, reconstructed_output_norm_value: 1, output_norm_reconstruction_delta: 0, output_norm_value: 1, output_row_value: 0.5, component: 0.5 },
          ],
          top_negative_components: [],
        },
        {
          token_id: 20,
          layout: 'descriptor',
          reported_logit: 2.5,
          reconstructed_logit: 1,
          absolute_delta: 0,
          positive_component_sum: 1.25,
          negative_component_sum: -0.25,
          top_positive_components: [
            { index: 1, final_hidden_value: 2, output_norm_weight_value: 1, output_norm_scale: 0.5, reconstructed_output_norm_value: 1, output_norm_reconstruction_delta: 0, output_norm_value: 1, output_row_value: 0.75, component: 0.75 },
            { index: 3, final_hidden_value: 2, output_norm_weight_value: 1, output_norm_scale: 0.5, reconstructed_output_norm_value: 1, output_norm_reconstruction_delta: 0, output_norm_value: 1, output_row_value: 0.25, component: 0.25 },
          ],
          top_negative_components: [
            { index: 0, final_hidden_value: -1, output_norm_weight_value: 1, output_norm_scale: 0.5, reconstructed_output_norm_value: -0.5, output_norm_reconstruction_delta: 0, output_norm_value: -0.5, output_row_value: 0.5, component: -0.25 },
          ],
        },
      ],
    },
  }
}
