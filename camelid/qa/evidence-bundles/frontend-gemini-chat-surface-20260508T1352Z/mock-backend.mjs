import http from 'node:http'

const port = Number(process.env.MOCK_PORT || 51952)
const host = '127.0.0.1'

const payloads = {
  '/v1/health': {
    ok: true,
    engine: 'backendinference',
    loaded_now: true,
    active_model_id: 'llama-3.2-3b-instruct-q8',
    generation_ready: true,
  },
  '/v1/models': {
    object: 'list',
    data: [
      {
        id: 'llama-3.2-3b-instruct-q8',
        object: 'model',
        name: 'Llama 3.2 3B Instruct Q8_0',
      },
    ],
  },
  '/api/models/current': {
    id: 'llama-3.2-3b-instruct-q8',
    name: 'Llama 3.2 3B Instruct Q8_0',
    path: '/models/Llama-3.2-3B-Instruct-Q8_0.gguf',
    tokenizer: { status: 'available', model: 'llama-bpe' },
    llama_config: { context_length: 2048 },
    llama_tensors: { count: 255 },
    gguf: { metadata: { general: { file_type: 7 } } },
  },
  '/api/capabilities': {
    support_contract: {
      current_gate: 'exact_rows_only',
      notes: 'Screenshot mock exercises the unlocked exact-row chat state; it is visual frontend evidence, not a live model-generation claim.',
    },
    api_features: [
      {
        id: 'openai_chat_completions',
        status: 'supported_exact_row_smoke',
        notes: 'Enabled only when runtime health and exact compatibility row both pass.',
      },
      {
        id: 'streaming_chat',
        status: 'planned_not_wired',
        notes: 'Non-streaming bounded smoke path only in this UI state.',
      },
      {
        id: 'tool_calls',
        status: 'planned_not_wired',
        notes: 'Tool calls remain guarded and are not advertised as ready.',
      },
    ],
    model_compatibility: [
      {
        id: 'llama32_3b_instruct_q8_0',
        family: 'llama_bpe_decoder',
        quantization: 'Q8_0',
        status: 'supported_exact_row_smoke',
        evidence: 'Bounded exact-row local chat smoke; not broad Llama-family support.',
        next_step: 'Longer-generation polish, production throughput, portability, and arbitrary-template support remain outside this UI claim.',
      },
    ],
    planned_model_families: [],
  },
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`)
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Content-Type', 'application/json')

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const body = payloads[url.pathname]
  if (!body) {
    response.writeHead(404)
    response.end(JSON.stringify({ error: { message: `No mock route for ${url.pathname}` } }))
    return
  }

  response.writeHead(200)
  response.end(JSON.stringify(body))
})

server.listen(port, host, () => {
  console.log(`mock Camelid backend listening on http://${host}:${port}`)
})
