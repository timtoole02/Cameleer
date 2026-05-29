#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i]
  const value = process.argv[i + 1]
  if (!key.startsWith('--')) continue
  args.set(key.slice(2), value)
  i += 1
}

if (!args.has('input') || !args.has('json-out')) {
  console.error('usage: node scripts/extract-attention-checkpoints.mjs --input <diagnostics.json> --layers 0,2 --json-out <focused-trace.json>')
  console.error('extracts a compact layer-focused attention q/k/v/o checkpoint bundle from camelid chat diagnostics')
  process.exit(2)
}

const inputPath = args.get('input')
const outputPath = args.get('json-out')
const layers = parseLayerList(args.get('layers') ?? '0,2')
const root = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const diagnostics = findCamelidDiagnostics(root)
if (!diagnostics?.dense?.layers) {
  throw new Error(`could not find camelid.dense.layers in ${inputPath}`)
}

const dense = diagnostics.dense
const extracted = {
  schema: 'camelid.attention-checkpoints.v1',
  source: {
    input: inputPath,
    basename: path.basename(inputPath),
    name: root.name ?? null,
    prompt_tokens_match: root.prompt_tokens_match ?? null,
    selected_token_id: root.selected_token_id ?? diagnostics.generated_token_ids?.[0] ?? null,
    known_good_token_id: root.known_good_token_id ?? null,
  },
  prompt_token_ids: diagnostics.prompt_token_ids ?? null,
  generated_token_ids: diagnostics.generated_token_ids ?? null,
  dense_metadata: pickDenseMetadata(diagnostics.dense_metadata ?? root.dense_metadata),
  layers: layers.map(layerIndex => extractLayer(dense.layers, layerIndex)),
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(extracted, null, 2)}\n`)
console.log(`wrote ${outputPath}`)
console.log(`layers=${extracted.layers.map(layer => layer.layer_index).join(',')}`)

function parseLayerList(value) {
  const layers = value.split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => Number.parseInt(part, 10))
  if (layers.length === 0 || layers.some(layer => !Number.isInteger(layer) || layer < 0)) {
    throw new Error(`invalid --layers value: ${value}`)
  }
  return [...new Set(layers)]
}

function findCamelidDiagnostics(value) {
  if (value?.camelid) return value.camelid
  if (value?.backend?.diagnostics?.camelid) return value.backend.diagnostics.camelid
  if (value?.diagnostics?.camelid) return value.diagnostics.camelid
  if (value?.choices?.[0]?.message?.camelid) return value.choices[0].message.camelid
  if (value?.choices?.[0]?.camelid) return value.choices[0].camelid
  return null
}

function pickDenseMetadata(metadata) {
  if (!metadata) return null
  return {
    attention_head_count: metadata.attention_head_count ?? null,
    attention_head_count_kv: metadata.attention_head_count_kv ?? null,
    embedding_length: metadata.embedding_length ?? null,
    rope_dimension_count: metadata.rope_dimension_count ?? null,
    rope_pairing: metadata.rope_pairing ?? null,
    rope_direction: metadata.rope_direction ?? null,
    rope_position_mode: metadata.rope_position_mode ?? null,
    rms_norm_epsilon: metadata.rms_norm_epsilon ?? null,
    rms_norm_effective_epsilon: metadata.rms_norm_effective_epsilon ?? null,
    output_is_tied_embedding: metadata.output_is_tied_embedding ?? null,
    square_linear_diagnostic_layout: metadata.square_linear_diagnostic_layout ?? null,
    rectangular_linear_diagnostic_layout: metadata.rectangular_linear_diagnostic_layout ?? null,
    first_layer_projection_orientations: metadata.first_layer_projection_orientations ?? null,
  }
}

function extractLayer(layers, layerIndex) {
  const layer = layers[layerIndex]
  if (!layer) throw new Error(`diagnostics are missing layer ${layerIndex}`)
  return {
    layer_index: layerIndex,
    attention_input: compactStats(layer.residual_flow?.attention_input),
    attention_norm: compactStats(layer.attention_norm),
    q: {
      input_stage: 'attention_norm',
      output_stage: 'attention_q',
      output: compactStats(layer.attention_q),
      rope_output: compactStats(layer.attention_q_rope),
    },
    k: {
      input_stage: 'attention_norm',
      output_stage: 'attention_k',
      output: compactStats(layer.attention_k),
      rope_output: compactStats(layer.attention_k_rope),
    },
    v: {
      input_stage: 'attention_norm',
      output_stage: 'attention_v',
      output: compactStats(layer.attention_v),
    },
    o: {
      input_stage: 'attention_context',
      input: compactStats(layer.attention_context),
      output_stage: 'attention_output',
      output: compactStats(layer.attention_output),
    },
    attention_trace: compactAttentionTrace(layer.attention_trace),
    attention_residual: compactStats(layer.attention_residual),
    ffn_input: compactStats(layer.residual_flow?.ffn_input),
  }
}

function compactStats(stats) {
  if (!stats) return null
  return {
    shape: stats.checkpoint?.shape ?? null,
    len: stats.checkpoint?.len ?? null,
    min: stats.min,
    min_index: stats.min_index,
    max: stats.max,
    max_index: stats.max_index,
    mean: stats.mean,
    rms: stats.rms,
    max_abs: stats.max_abs,
    max_abs_index: stats.max_abs_index,
    first_values: stats.checkpoint?.first_values ?? [],
    max_abs_window_start: stats.checkpoint?.max_abs_window_start ?? null,
    max_abs_window: stats.checkpoint?.max_abs_window ?? [],
  }
}

function compactAttentionTrace(trace) {
  if (!trace) return null
  return {
    scale: trace.scale,
    position_count: trace.position_count,
    head_dim: trace.head_dim,
    heads: (trace.heads ?? []).map(compactAttentionHead),
  }
}

function compactAttentionHead(head) {
  const compact = {
    attention_head: head.attention_head,
    kv_head: head.kv_head,
    query_first_values: head.query_first_values ?? [],
    context_first_values: head.context_first_values ?? [],
    positions: (head.positions ?? []).map(position => ({
      position: position.position,
      score: position.score,
      reconstructed_score: position.reconstructed_score,
      score_reconstruction_delta: position.score_reconstruction_delta,
      probability: position.probability,
      key_first_values: position.key_first_values ?? [],
      qk_products_first_values: position.qk_products_first_values ?? [],
      qk_products_max_abs_window_start: position.qk_products_max_abs_window_start,
      qk_products_max_abs_window: position.qk_products_max_abs_window ?? [],
      value_first_values: position.value_first_values ?? [],
    })),
  }
  if (head.reconstructed_context_first_values !== undefined) {
    compact.reconstructed_context_first_values = head.reconstructed_context_first_values ?? []
    compact.context_reconstruction_max_abs_delta_index = head.context_reconstruction_max_abs_delta_index
    compact.context_reconstruction_max_abs_delta = head.context_reconstruction_max_abs_delta
    compact.probability_sum = head.probability_sum
    compact.probability_entropy = head.probability_entropy
    compact.probability_rms = head.probability_rms
    compact.max_probability_position = head.max_probability_position
    compact.max_probability = head.max_probability
    compact.top_probability_positions = (head.top_probability_positions ?? []).map(position => ({
      position: position.position,
      score: position.score,
      probability: position.probability,
      key_first_values: position.key_first_values ?? [],
      value_first_values: position.value_first_values ?? [],
    }))
  }
  return compact
}
