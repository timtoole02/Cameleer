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
const summaryScript = join(scriptDir, 'summarize-generation-timings.mjs')
const tempDir = await mkdtemp(join(tmpdir(), 'camelid-generation-timings-'))

try {
  const completionPath = join(tempDir, 'completion.response.json')
  const chatPath = join(tempDir, 'chat.response.json')
  const reportPath = join(tempDir, 'timings.summary.json')
  await writeFile(completionPath, `${JSON.stringify(response('text_completion', 1), null, 2)}\n`)
  await writeFile(chatPath, `${JSON.stringify(response('chat.completion', 2), null, 2)}\n`)

  const { stdout } = await execFileAsync(process.execPath, [
    summaryScript,
    '--out', reportPath,
    completionPath,
    chatPath,
  ], { cwd: resolve(scriptDir, '..') })

  assert.match(stdout, /schema=camelid\.generation_timing_summary\.v1/)
  assert.match(stdout, /input_count=2/)
  assert.match(stdout, /avg_linear_hot_path_ms=126\.000/)
  assert.match(stdout, /top_bottleneck=layers\.1\.ffn_down/)

  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  assert.equal(report.schema, 'camelid.generation_timing_summary.v1')
  assert.equal(report.inputs.length, 2)
  assert.equal(report.inputs[0].layer_count, 2)
  assert.equal(report.inputs[0].buckets_ms.attention_projection, 30)
  assert.equal(report.inputs[0].buckets_ms.ffn_projection, 54)
  assert.equal(report.inputs[0].buckets_ms.linear_hot_path, 84)
  assert.equal(report.inputs[0].shares.linear_hot_path_of_forward, 84 / 100)
  assert.equal(report.aggregate.avg_linear_hot_path_ms, 126)
  assert.equal(report.aggregate.max_forward_total_ms, 200)
  assert.equal(report.aggregate.top_bottlenecks[0].path, 'layers.1.ffn_down')
  assert.equal(report.aggregate.top_bottlenecks[0].input, 'chat.response.json')

  const missingPath = join(tempDir, 'missing.json')
  await writeFile(missingPath, '{}\n')
  let failed = false
  try {
    await execFileAsync(process.execPath, [summaryScript, missingPath], { cwd: resolve(scriptDir, '..') })
  } catch (err) {
    failed = true
    assert.match(err.stderr, /missing camelid\.timings_ms/)
  }
  assert.equal(failed, true)

  console.log('summarize-generation-timings self-test passed')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

function response(object, multiplier) {
  return {
    object,
    model: 'fixture-q8',
    usage: {
      prompt_tokens: 3,
      completion_tokens: 1,
      total_tokens: 4,
    },
    camelid: {
      timings_ms: {
        tokenize: 1 * multiplier,
        weight_load: 2 * multiplier,
        weight_cache_hit: true,
        prompt_cache_hit: false,
        session_create: 3 * multiplier,
        generate: 220 * multiplier,
        generation: {
          forward_total: 100 * multiplier,
          embedding: 1 * multiplier,
          layers_total: 90 * multiplier,
          final_norm: 1 * multiplier,
          logits: 1 * multiplier,
          sample: 0.5 * multiplier,
        },
        layers: [
          layer(0, multiplier, 1),
          layer(1, multiplier, 2),
        ],
      },
    },
  }
}

function layer(layerIndex, multiplier, scale) {
  return {
    layer_index: layerIndex,
    total: 8 * scale * multiplier,
    attention_norm: 0.1 * scale * multiplier,
    attention_q: 1 * scale * multiplier,
    attention_k: 2 * scale * multiplier,
    attention_v: 3 * scale * multiplier,
    attention_rope: 0.2 * scale * multiplier,
    kv_cache_write: 0.1 * scale * multiplier,
    attention_context: 0.5 * scale * multiplier,
    attention_output: 4 * scale * multiplier,
    attention_residual: 0.1 * scale * multiplier,
    ffn_norm: 0.1 * scale * multiplier,
    ffn_gate: 5 * scale * multiplier,
    ffn_up: 6 * scale * multiplier,
    ffn_activation: 0.3 * scale * multiplier,
    ffn_down: 7 * scale * multiplier,
    ffn_residual: 0.1 * scale * multiplier,
  }
}
