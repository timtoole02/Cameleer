#!/usr/bin/env node
import assert from 'node:assert/strict'

import { extractSseEvents, readChatCompletionJsonPayload, readStreamingChatCompletion } from '../src/lib/chatCompletionStream.js'

const partial = 'data: {"choices":[{"delta":{"content":"hel"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"lo"}}]}'
const firstPass = extractSseEvents(partial)
assert.equal(firstPass.events.length, 1, 'complete SSE events should flush while partial backend chunks stay buffered')
assert.match(firstPass.remainder, /"lo"/, 'partial SSE data should remain buffered until the blank-line event boundary arrives')
const secondPass = extractSseEvents(`${firstPass.remainder}\n\ndata: [DONE]\n\n`)
assert.equal(secondPass.events.length, 2, 'the remaining partial SSE event should flush after its boundary arrives')

const jsonPayload = readChatCompletionJsonPayload({
  choices: [{ message: { content: 'json reply' }, finish_reason: 'stop' }],
  usage: { completion_tokens: 2 },
})
assert.equal(jsonPayload.content, 'json reply', 'non-streaming JSON fallback should preserve assistant content')
assert.equal(jsonPayload.completionTokens, 2, 'JSON usage should remain exact when the backend provides it')

function streamFromChunks(chunks) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

const fallbackEvents = []
const fallbackDeltas = []
const fallback = await readStreamingChatCompletion(new Response(JSON.stringify({
  choices: [{ message: { content: 'json fallback reply' }, finish_reason: 'stop' }],
  usage: { completion_tokens: 3 },
}), {
  status: 200,
  headers: { 'content-type': 'application/json' },
}), (delta, fullContent, metrics) => {
  fallbackDeltas.push({ delta, fullContent, firstByteMs: metrics.firstByteMs, firstContentMs: metrics.firstContentMs })
}, {
  onStreamEvent(event) {
    fallbackEvents.push(event.type)
  },
})
assert.equal(fallback.content, 'json fallback reply', 'JSON fallback should preserve assistant content through the streaming reader')
assert.equal(fallback.completionTokens, 3, 'JSON fallback should preserve exact backend completion-token usage')
assert.equal(fallback.firstByteMs, 0, 'JSON fallback should expose response-header progress so the UI can stay visibly active')
assert.ok(fallback.firstContentMs >= 0, 'JSON fallback should expose first-content timing once the body is parsed')
assert.deepEqual(fallbackEvents, ['json_fallback'], 'JSON fallback should notify callers before the final assistant content is available')
assert.deepEqual(fallbackDeltas.map((item) => item.fullContent), ['json fallback reply'], 'JSON fallback should still deliver one visible content update')

const response = new Response(streamFromChunks([
  'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"```js\\nconst"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":" answer = 42"}}]}\n',
  '\n',
  'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":7,"total_tokens":10}}\n\n',
  'data: [DONE]\n\n',
]), {
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
})

const deltas = []
const streamEvents = []
const streamed = await readStreamingChatCompletion(response, (delta, fullContent, metrics) => {
  deltas.push({ delta, fullContent, completionTokens: metrics.completionTokens })
}, {
  onStreamEvent(event) {
    streamEvents.push(event.type)
  },
})

assert.equal(streamed.content, '```js\nconst answer = 42', 'stream parser should preserve incomplete fenced code content safely for live rendering')
assert.equal(streamed.finishReason, 'stop', 'stream parser should preserve finish_reason from the terminal chunk')
assert.deepEqual(deltas.map((item) => item.fullContent), ['```js\nconst', '```js\nconst answer = 42'], 'stream deltas should update visible content before backend completion')
assert.deepEqual(deltas.map((item) => item.completionTokens), [1, 2], 'stream metrics should advance while generation is active')
assert.equal(streamed.completionTokens, 7, 'stream parser should preserve exact backend completion-token usage from the terminal chunk')
assert.deepEqual(streamed.usage, { prompt_tokens: 3, completion_tokens: 7, total_tokens: 10 }, 'stream parser should preserve exact backend usage evidence instead of replacing it with estimates')
assert.ok(streamEvents.includes('bytes'), 'stream parser should expose first-byte progress before content')
assert.ok(streamEvents.includes('role'), 'stream parser should expose role-only chunks while waiting for first content token')
assert.ok(streamEvents.includes('usage'), 'stream parser should expose backend usage chunks before finalizing the assistant row')

const multilinePayload = await readStreamingChatCompletion(new Response(streamFromChunks([
  'data: {"choices":[{"delta":{"content":"multi"}}],\n',
  'data: "usage":{"completion_tokens":4}}\n\n',
  'data: [DONE]\n\n',
]), {
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
}), () => {})
assert.equal(multilinePayload.content, 'multi', 'SSE parser should join multi-line data payloads before parsing JSON')
assert.equal(multilinePayload.completionTokens, 4, 'SSE parser should preserve usage from joined multi-line data payloads')

const batchedPayloadDeltas = []
const batchedPayload = await readStreamingChatCompletion(new Response(streamFromChunks([
  'data: {"choices":[{"delta":{"content":"batch"}}]}\n',
  'data: {"choices":[{"delta":{"content":"ed"}}]}\n\n',
  'data: [DONE]\n\n',
]), {
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
}), (_delta, fullContent) => {
  batchedPayloadDeltas.push(fullContent)
})
assert.equal(batchedPayload.content, 'batched', 'SSE parser should keep accepting backend batches with several JSON payloads in one event')
assert.deepEqual(batchedPayloadDeltas, ['batch', 'batched'], 'batched payloads should still stream each visible update')

const partialBeforeError = []
const errorEvents = []
await assert.rejects(
  () => readStreamingChatCompletion(new Response(streamFromChunks([
    'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
    'event: error\n',
    'data: {"error":{"code":"generation_step_failed","message":"backend failed after headers"}}\n\n',
    'data: [DONE]\n\n',
  ]), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  }), (_delta, fullContent) => {
    partialBeforeError.push(fullContent)
  }, {
    onStreamEvent(event) {
      errorEvents.push(event.type)
    },
  }),
  (error) => {
    assert.equal(error.message, 'backend failed after headers')
    assert.equal(error.code, 'generation_step_failed')
    assert.deepEqual(error.payload, { error: { code: 'generation_step_failed', message: 'backend failed after headers' } })
    return true
  },
  'SSE error events sent after streaming headers should reject instead of becoming an empty assistant reply',
)
assert.deepEqual(partialBeforeError, ['partial'], 'stream parser should expose visible partial content before a later SSE error')
assert.ok(errorEvents.includes('error'), 'stream parser should surface structured SSE error events to callers')

console.log('Streaming parser smoke passed')
