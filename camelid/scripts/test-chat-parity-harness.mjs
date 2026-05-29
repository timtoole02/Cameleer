#!/usr/bin/env node
import assert from 'node:assert/strict'

import { normalizePromptPack, renderExpectedPrompt, resolveReferenceContext } from './lib/chat-parity-harness.mjs'

assert.equal(
  renderExpectedPrompt([
    { role: 'system', content: 'Answer briefly.' },
    { role: 'user', content: 'Say alpha.' },
    { role: 'assistant', content: 'alpha' },
    { role: 'user', content: 'Now say beta.' },
  ], 'compact'),
  '<|start_header_id|>system<|end_header_id|>\n\nAnswer briefly.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\nSay alpha.<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\nalpha<|eot_id|><|start_header_id|>user<|end_header_id|>\n\nNow say beta.<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n',
)

assert.equal(
  renderExpectedPrompt([
    { role: 'user', content: 'Complete cam' },
    { role: 'assistant', content: 'elid' },
  ], 'compact'),
  '<|start_header_id|>user<|end_header_id|>\n\nComplete cam<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\nelid<|eot_id|>',
)

assert.equal(
  renderExpectedPrompt([
    { role: 'system', content: 'Answer briefly.' },
    { role: 'user', content: 'Name one primary color.' },
  ], 'tinyllama-marker'),
  '<|system|>\nAnswer briefly.</s>\n<|user|>\nName one primary color.</s>\n<|assistant|>\n',
)

assert.equal(
  renderExpectedPrompt([
    { role: 'user', content: 'Complete cam' },
    { role: 'assistant', content: 'elid' },
  ], 'tinyllama-marker'),
  '<|user|>\nComplete cam</s>\n<|assistant|>\nelid</s>\n',
)

assert.equal(
  renderExpectedPrompt([
    { role: 'system', content: ' Be brief. ' },
    { role: 'user', content: ' Hello there. ' },
    { role: 'assistant', content: ' Hi ' },
    { role: 'user', content: 'Now say bye' },
  ], 'mistral_instruct'),
  '<s>[INST] Be brief.\n\nHello there. [/INST] Hi</s><s>[INST] Now say bye [/INST]',
)

const normalizedPack = normalizePromptPack({
  schema: 'camelid.llama3.prompt-pack.v1',
  pack_id: 'llama3-context-512-smoke-v1',
  target_context_window: 512,
  defaults: {
    max_tokens: 5,
    render_mode: 'compact',
  },
  prompts: [
    {
      id: 'shape-a',
      messages: [
        { role: 'system', content: 'Stay brief.' },
        { role: 'user', content: 'Say blue.' },
      ],
    },
    {
      id: 'shape-b',
      message: 'hello',
      render_mode: 'compact',
      max_tokens: 7,
      target_context_window: 640,
    },
  ],
})
assert.equal(normalizedPack.defaults.max_tokens, 5)
assert.equal(normalizedPack.defaults.render_mode, 'compact')
assert.equal(normalizedPack.target_context_window, 512)
assert.equal(normalizedPack.prompts[0].max_tokens, 5)
assert.equal(normalizedPack.prompts[0].render_mode, 'compact')
assert.equal(normalizedPack.prompts[0].target_context_window, 512)
assert.equal(normalizedPack.prompts[1].max_tokens, 7)
assert.equal(normalizedPack.prompts[1].target_context_window, 640)
const mistralPack = normalizePromptPack({
  schema: 'camelid.mistral.prompt-pack.v1',
  pack_id: 'mistral-one-token-smoke-v1',
  defaults: { render_mode: 'mistral_instruct', max_tokens: 1 },
  prompts: [{
    id: 'hello',
    messages: [{ role: 'user', content: 'hello' }],
  }],
})
assert.equal(mistralPack.defaults.render_mode, 'mistral_instruct')
assert.equal(mistralPack.prompts[0].render_mode, 'mistral_instruct')

assert.throws(
  () => normalizePromptPack({ schema: 'camelid.unknown.prompt-pack.v1', pack_id: 'bad', prompts: [{ message: 'hi' }] }),
  /unsupported/,
)
assert.throws(
  () => normalizePromptPack({
    schema: 'camelid.llama3.prompt-pack.v1',
    pack_id: 'bad-render',
    defaults: { render_mode: 'tinyllama-marker' },
    prompts: [{ message: 'hi' }],
  }),
  /not allowed/,
)
assert.throws(
  () => normalizePromptPack({
    schema: 'camelid.tinyllama.prompt-pack.v1',
    pack_id: 'bad-messages',
    defaults: { render_mode: 'tinyllama-marker' },
    prompts: [{ messages: [{ role: 'user', content: '' }] }],
  }),
  /non-empty string/,
)
assert.throws(
  () => normalizePromptPack({
    schema: 'camelid.mistral.prompt-pack.v1',
    pack_id: 'bad-mistral-render',
    defaults: { render_mode: 'compact' },
    prompts: [{ message: 'hi' }],
  }),
  /not allowed/,
)

assert.equal(resolveReferenceContext({ promptTokenCount: 120, maxTokens: 5 }), 512)
assert.equal(resolveReferenceContext({ promptTokenCount: 520, maxTokens: 5 }), 541)
assert.equal(resolveReferenceContext({ promptTokenCount: 520, maxTokens: 5, explicitContext: 600 }), 600)
assert.throws(
  () => resolveReferenceContext({ promptTokenCount: 520, maxTokens: 5, explicitContext: 530 }),
  /too small/,
)

console.log('chat-parity-harness self-test passed')
