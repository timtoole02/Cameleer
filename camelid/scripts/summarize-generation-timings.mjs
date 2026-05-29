#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const outPath = args.get('out') || args.get('json-out') || null
const inputPaths = args.getAll('input')
const positional = args.positionals
const paths = [...inputPaths, ...positional]

if (paths.length === 0) {
  throw new Error('usage: node scripts/summarize-generation-timings.mjs [--out report.json] <completion/chat response json...>')
}

const responses = []
for (const path of paths) {
  const payload = JSON.parse(await readFile(path, 'utf8'))
  const timings = payload?.camelid?.timings_ms
  if (!timings) {
    throw new Error(`${path}: missing camelid.timings_ms`)
  }
  responses.push(summarizeResponse(path, payload, timings))
}

const report = {
  schema: 'camelid.generation_timing_summary.v1',
  generated_utc: new Date().toISOString(),
  inputs: responses,
  aggregate: aggregateResponses(responses),
  notes: [
    'Summarizes Camelid response-local timing diagnostics; use alongside RSS/process samples for performance claims.',
    'The linear hot-path bucket is attention Q/K/V/O plus FFN gate/up/down layer timing. On lazy Q8_0 runs this is the primary file-backed Q8 reader/dot cost surface.',
    'This report is measurement evidence only and does not broaden support beyond exact rows validated by parity/API/frontend artifacts.'
  ],
}

if (outPath) {
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

console.log(`schema=${report.schema}`)
console.log(`input_count=${responses.length}`)
console.log(`max_forward_total_ms=${formatMs(report.aggregate.max_forward_total_ms)}`)
console.log(`avg_linear_hot_path_ms=${formatMs(report.aggregate.avg_linear_hot_path_ms)}`)
console.log(`avg_linear_hot_path_share=${formatRatio(report.aggregate.avg_linear_hot_path_share)}`)
console.log(`top_bottleneck=${report.aggregate.top_bottlenecks[0]?.path ?? 'none'}`)

function summarizeResponse(path, payload, timings) {
  const layers = Array.isArray(timings.layers) ? timings.layers : []
  const layerSummaries = layers.map(layer => summarizeLayer(layer))
  const totals = sumLayerBuckets(layerSummaries)
  const generation = timings.generation || {}
  const promptEvaluation = timings.prompt_evaluation || {}
  const prefill = promptEvaluation.prefill || {}
  const firstToken = promptEvaluation.first_token || {}
  const forwardTotal = numeric(generation.forward_total)
  const layersTotal = numeric(generation.layers_total)
  const generate = numeric(timings.generate)
  const linearHotPath = totals.linear_hot_path_ms
  const attentionProjection = totals.attention_projection_ms
  const ffnProjection = totals.ffn_projection_ms
  const nonLinearLayer = totals.non_linear_layer_ms
  return {
    path,
    file: basename(path),
    model: payload.model ?? null,
    object: payload.object ?? null,
    prompt_tokens: payload.usage?.prompt_tokens ?? null,
    completion_tokens: payload.usage?.completion_tokens ?? null,
    timings_ms: {
      tokenize: numeric(timings.tokenize),
      weight_load: numeric(timings.weight_load),
      weight_cache_hit: Boolean(timings.weight_cache_hit),
      prompt_cache_hit: Boolean(timings.prompt_cache_hit),
      session_create: numeric(timings.session_create),
      generate,
      forward_total: forwardTotal,
      embedding: numeric(generation.embedding),
      layers_total: layersTotal,
      final_norm: numeric(generation.final_norm),
      logits: numeric(generation.logits),
      sample: numeric(generation.sample),
      prompt_eval_prompt_tokens: numeric(promptEvaluation.prompt_token_count),
      prompt_eval_prefill_tokens: numeric(promptEvaluation.prefill_token_count),
      prefill_forward_total: numeric(prefill.forward_total),
      prefill_layers_total: numeric(prefill.layers_total),
      first_token_forward_total: numeric(firstToken.forward_total),
      first_token_layers_total: numeric(firstToken.layers_total),
      first_token_logits: numeric(firstToken.logits),
    },
    layer_count: layers.length,
    buckets_ms: {
      linear_hot_path: linearHotPath,
      attention_projection: attentionProjection,
      ffn_projection: ffnProjection,
      non_linear_layer: nonLinearLayer,
      attention_context: totals.attention_context_ms,
      ffn_activation: totals.ffn_activation_ms,
    },
    shares: {
      linear_hot_path_of_forward: ratio(linearHotPath, forwardTotal),
      linear_hot_path_of_layers: ratio(linearHotPath, layersTotal),
      attention_projection_of_forward: ratio(attentionProjection, forwardTotal),
      ffn_projection_of_forward: ratio(ffnProjection, forwardTotal),
      logits_of_forward: ratio(numeric(generation.logits), forwardTotal),
    },
    slowest_layers: layerSummaries
      .slice()
      .sort((a, b) => b.total_ms - a.total_ms)
      .slice(0, 8),
    top_bottlenecks: topComponentBottlenecks(layerSummaries, numeric(generation.logits)),
  }
}

function summarizeLayer(layer) {
  const attentionProjection = sumFields(layer, ['attention_q', 'attention_k', 'attention_v', 'attention_output'])
  const ffnProjection = sumFields(layer, ['ffn_gate', 'ffn_up', 'ffn_down'])
  const linearHotPath = attentionProjection + ffnProjection
  const attentionContext = numeric(layer.attention_context)
  const ffnActivation = numeric(layer.ffn_activation)
  const nonLinearLayer = Math.max(0, numeric(layer.total) - linearHotPath)
  return {
    layer_index: layer.layer_index,
    total_ms: numeric(layer.total),
    linear_hot_path_ms: linearHotPath,
    attention_projection_ms: attentionProjection,
    ffn_projection_ms: ffnProjection,
    non_linear_layer_ms: nonLinearLayer,
    attention_context_ms: attentionContext,
    ffn_activation_ms: ffnActivation,
    components_ms: {
      attention_norm: numeric(layer.attention_norm),
      attention_q: numeric(layer.attention_q),
      attention_k: numeric(layer.attention_k),
      attention_v: numeric(layer.attention_v),
      attention_rope: numeric(layer.attention_rope),
      kv_cache_write: numeric(layer.kv_cache_write),
      attention_context: attentionContext,
      attention_output: numeric(layer.attention_output),
      attention_residual: numeric(layer.attention_residual),
      ffn_norm: numeric(layer.ffn_norm),
      ffn_gate: numeric(layer.ffn_gate),
      ffn_up: numeric(layer.ffn_up),
      ffn_activation: ffnActivation,
      ffn_down: numeric(layer.ffn_down),
      ffn_residual: numeric(layer.ffn_residual),
    },
  }
}

function sumLayerBuckets(layers) {
  return layers.reduce((acc, layer) => {
    acc.linear_hot_path_ms += layer.linear_hot_path_ms
    acc.attention_projection_ms += layer.attention_projection_ms
    acc.ffn_projection_ms += layer.ffn_projection_ms
    acc.non_linear_layer_ms += layer.non_linear_layer_ms
    acc.attention_context_ms += layer.attention_context_ms
    acc.ffn_activation_ms += layer.ffn_activation_ms
    return acc
  }, {
    linear_hot_path_ms: 0,
    attention_projection_ms: 0,
    ffn_projection_ms: 0,
    non_linear_layer_ms: 0,
    attention_context_ms: 0,
    ffn_activation_ms: 0,
  })
}

function topComponentBottlenecks(layers, logitsMs) {
  const entries = []
  for (const layer of layers) {
    for (const [component, value] of Object.entries(layer.components_ms)) {
      entries.push({ path: `layers.${layer.layer_index}.${component}`, ms: value })
    }
  }
  entries.push({ path: 'generation.logits', ms: logitsMs })
  return entries
    .filter(entry => Number.isFinite(entry.ms))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 12)
}

function aggregateResponses(responses) {
  const forwardTotals = responses.map(response => response.timings_ms.forward_total)
  const linearHotPaths = responses.map(response => response.buckets_ms.linear_hot_path)
  return {
    input_count: responses.length,
    max_forward_total_ms: max(forwardTotals),
    avg_forward_total_ms: avg(forwardTotals),
    avg_generate_ms: avg(responses.map(response => response.timings_ms.generate)),
    avg_weight_load_ms: avg(responses.map(response => response.timings_ms.weight_load)),
    avg_linear_hot_path_ms: avg(linearHotPaths),
    avg_linear_hot_path_share: avg(responses.map(response => response.shares.linear_hot_path_of_forward).filter(Number.isFinite)),
    max_logits_ms: max(responses.map(response => response.timings_ms.logits)),
    top_bottlenecks: responses
      .flatMap(response => response.top_bottlenecks.map(entry => ({ ...entry, input: response.file })))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 12),
  }
}

function sumFields(object, fields) {
  return fields.reduce((sum, field) => sum + numeric(object[field]), 0)
}

function numeric(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null
}

function avg(values) {
  const finite = values.filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0
}

function max(values) {
  const finite = values.filter(Number.isFinite)
  return finite.length ? Math.max(...finite) : 0
}

function formatMs(value) {
  return Number.isFinite(value) ? value.toFixed(3) : 'n/a'
}

function formatRatio(value) {
  return Number.isFinite(value) ? value.toFixed(4) : 'n/a'
}

function parseArgs(argv) {
  const parsed = new Map()
  parsed.positionals = []
  parsed.getAll = key => parsed.get(key) ?? []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      parsed.positionals.push(arg)
      continue
    }
    const [key, inline] = arg.slice(2).split('=', 2)
    const next = argv[i + 1]
    const value = inline ?? (next && !next.startsWith('--') ? argv[++i] : 'true')
    if (key === 'input') {
      const values = parsed.get(key) ?? []
      values.push(value)
      parsed.set(key, values)
    } else {
      parsed.set(key, value)
    }
  }
  return parsed
}
