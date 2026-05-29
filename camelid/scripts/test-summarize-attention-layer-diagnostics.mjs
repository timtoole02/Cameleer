#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const temp = mkdtempSync(join(tmpdir(), 'camelid-attention-summary-'))
const leftPath = join(temp, 'left.json')
const rightPath = join(temp, 'right.json')
const outPath = join(temp, 'summary.json')

writeFileSync(leftPath, JSON.stringify(fixture({ token: 10, attentionOutputRms: 1, query0: 1, context0: 1, score0: 0.25, probability0: 0.75 }), null, 2))
writeFileSync(rightPath, JSON.stringify(fixture({ token: 20, attentionOutputRms: 3, query0: 1.5, context0: -2, score0: 2.25, probability0: 0.25 }), null, 2))

const stdout = execFileSync('node', [
  'scripts/summarize-attention-layer-diagnostics.mjs',
  '--left', leftPath,
  '--right', rightPath,
  '--layers', '0',
  '--json-out', outPath,
], { encoding: 'utf8' })

assert.match(stdout, /generated_tokens_match=false/)
assert.match(stdout, /first_changed_stage=attention_output/)
assert.match(stdout, /largest_stage_deltas=/)
assert.match(stdout, /dominant_metric":"rms_abs_delta"/)
assert.match(stdout, /largest_attention_trace_deltas=/)
assert.match(stdout, /dominant_metric":"context_first_values_max_abs_diff"/)

const report = JSON.parse(readFileSync(outPath, 'utf8'))
assert.deepEqual(report.generated_tokens.left, [10])
assert.deepEqual(report.generated_tokens.right, [20])
assert.equal(report.layer_summaries[0].deltas.first_changed_stage, 'attention_output')
const [largestStage] = report.layer_summaries[0].deltas.largest_stage_deltas
assert.equal(largestStage.stage, 'attention_output')
assert.equal(largestStage.dominant_metric, 'rms_abs_delta')
assert.equal(largestStage.max_abs_delta, 2)
assert.equal(largestStage.metrics.first_values_max_abs_diff, 2)
assert.equal(largestStage.max_abs_window_start_match, true)

const [largest] = report.layer_summaries[0].deltas.largest_attention_trace_deltas
assert.equal(largest.attention_head, 0)
assert.equal(largest.kv_head, 0)
assert.equal(largest.dominant_metric, 'context_first_values_max_abs_diff')
assert.equal(largest.max_abs_delta, 3)
assert.equal(largest.metrics.score_max_abs_diff, 2)
assert.equal(largest.metrics.probability_max_abs_diff, 0.5)
assert.equal(largest.first_position_diff_index, 0)

function fixture({ token, attentionOutputRms, query0, context0, score0, probability0 }) {
  return {
    camelid: {
      generated_token_ids: [token],
      top_logits: [{ token_id: token, logit: 1, rank: 1 }],
      dense: {
        layers: [{
          layer_index: 0,
          residual_flow: {
            attention_delta: residualDelta(),
            ffn_delta: residualDelta(),
          },
          ...Object.fromEntries(stageNames().map(name => [name, stage(name === 'attention_output' ? attentionOutputRms : 1)])),
          attention_trace: {
            scale: 0.125,
            position_count: 2,
            head_dim: 4,
            heads: [{
              attention_head: 0,
              kv_head: 0,
              query_first_values: [query0, 0, 0, 0],
              context_first_values: [context0, 0, 0, 0],
              reconstructed_context_first_values: [context0, 0, 0, 0],
              context_reconstruction_max_abs_delta: 0,
              context_reconstruction_max_abs_delta_index: 0,
              probability_sum: 1,
              probability_entropy: 0.5,
              probability_rms: 0.6,
              max_probability: probability0,
              max_probability_position: 0,
              positions: [{
                position: 0,
                score: score0,
                reconstructed_score: score0,
                score_reconstruction_delta: 0,
                probability: probability0,
                key_first_values: [1, 0, 0, 0],
                qk_products_first_values: [query0, 0, 0, 0],
                qk_products_max_abs_window_start: 0,
                qk_products_max_abs_window: [query0, 0, 0, 0],
                value_first_values: [context0, 0, 0, 0],
              }],
            }],
          },
        }],
      },
    },
  }
}

function stage(rms) {
  return {
    rms,
    max_abs: rms + 1,
    max_abs_index: 0,
    checkpoint: {
      first_values: [rms, 0],
      max_abs_window_start: 0,
      max_abs_window: [rms + 1, 0],
    },
  }
}

function residualDelta() {
  return {
    max_abs_delta: 0,
    max_abs_delta_index: 0,
    delta_first_values: [0, 0],
    reconstructed_first_values: [1, 2],
    reported_first_values: [1, 2],
  }
}

function stageNames() {
  return [
    'attention_norm',
    'attention_q',
    'attention_k',
    'attention_q_rope',
    'attention_k_rope',
    'attention_v',
    'attention_context',
    'attention_output',
    'attention_residual',
    'ffn_norm',
    'ffn_gate',
    'ffn_up',
    'ffn_activation',
    'ffn_output',
    'ffn_residual',
  ]
}
