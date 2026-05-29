#!/usr/bin/env node
import { spawn, execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
const execFileP = promisify(execFile)

const args = parseArgs(process.argv.slice(2))
const packPath = resolve(req('pack'))
const outDir = resolve(req('out-dir'))
const model = resolve(req('model'))
const modelId = args.get('model-id') || 'llama32_1b_instruct_q8_0'
const backend = (args.get('backend') || 'http://127.0.0.1:19381').replace(/\/$/, '')
const llamaUrl = (args.get('llama-url') || 'http://127.0.0.1:19383').replace(/\/$/, '')
const llamaServer = resolve(req('llama-server'))
const llamaTokenize = resolve(req('llama-tokenize'))
const context = Number.parseInt(req('context'), 10)
const waitMs = Number.parseInt(args.get('wait-ms') || '1200000', 10)
const curlMaxTime = args.get('curl-max-time') || '1800'

await mkdir(outDir, { recursive: true })
const pack = JSON.parse(await readFile(packPath, 'utf8'))
const prompt = pack.prompts[0]
const messages = prompt.messages
const maxTokens = prompt.max_tokens || pack.defaults?.max_tokens || 5
const rendered = renderLlama32MetadataTemplate(messages)
await writeFile(join(outDir, 'metadata-rendered-prompt.txt'), rendered)
await writeFile(join(outDir, 'messages.json'), JSON.stringify({ messages }, null, 2) + '\n')
const referencePromptTokens = JSON.parse((await run(llamaTokenize, ['-m', model, '--ids', '--log-disable', '--no-bos', '-f', join(outDir, 'metadata-rendered-prompt.txt')])).stdout.trim())

let child
try {
  const url = new URL(llamaUrl)
  const llamaArgs = ['--host', url.hostname, '--port', url.port || '19383', '-m', model, '-ngl', '0', '-c', String(context), '--no-warmup', '-fa', 'off']
  await writeFile(join(outDir, 'llama-server-command.txt'), shellJoin(llamaServer, llamaArgs) + '\n')
  child = spawn(llamaServer, llamaArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', chunk => process.stderr.write(`[llama-server] ${chunk}`))
  child.stderr.on('data', chunk => process.stderr.write(`[llama-server] ${chunk}`))

  await waitFor(`${backend}/v1/health`, 'backend', waitMs)
  await waitFor(`${llamaUrl}/health`, 'llama-server', waitMs)
  await curlJson(`${backend}/api/models/load`, { path: model, id: modelId })

  const llamaCompletion = await curlJson(`${llamaUrl}/completion`, { prompt: referencePromptTokens, n_predict: maxTokens, temperature: 0, cache_prompt: false, n_probs: 20 })
  const llamaText = llamaCompletion.content || ''
  const llamaGeneratedTokens = (llamaCompletion.completion_probabilities || []).map(x => Number.isInteger(x?.id) ? x.id : null).filter(x => x !== null)
  const diagnosticTokenIds = [...new Set([...llamaGeneratedTokens, ...(llamaCompletion.completion_probabilities || []).flatMap(x => x?.top_logprobs || []).map(x => x?.id).filter(Number.isInteger)])].slice(0, 16)

  const backendChat = await curlJson(`${backend}/v1/chat/completions`, { model: modelId, messages, max_tokens: maxTokens, stream: false, temperature: 0, camelid_logit_token_ids: diagnosticTokenIds })
  const backendPromptTokens = backendChat.camelid?.prompt_token_ids || []
  const backendGeneratedTokens = backendChat.camelid?.generated_token_ids || []
  const backendText = backendChat.choices?.[0]?.message?.content || ''
  const report = {
    schema: 'camelid.metadata-jinja-llama32-1b-current-head-parity.v1',
    pack: packPath,
    prompt_id: prompt.id,
    model,
    model_id: modelId,
    context,
    max_tokens: maxTokens,
    backend,
    llama_server: llamaUrl,
    renderer: 'metadata_jinja_llama3_2_default_date_26_Jul_2024',
    reference_prompt_token_count: referencePromptTokens.length,
    backend_prompt_token_count: backendPromptTokens.length,
    prompt_tokens_match: JSON.stringify(backendPromptTokens) === JSON.stringify(referencePromptTokens),
    generated_tokens_match: JSON.stringify(backendGeneratedTokens) === JSON.stringify(llamaGeneratedTokens),
    generated_text_match: backendText === llamaText,
    first_prompt_token_diff_index: firstArrayDifference(backendPromptTokens, referencePromptTokens),
    first_generated_token_diff_index: firstArrayDifference(backendGeneratedTokens, llamaGeneratedTokens),
    first_generated_text_diff_index: firstStringDifference(backendText, llamaText),
    backend_prompt_tokens: backendPromptTokens,
    reference_prompt_tokens: referencePromptTokens,
    backend_generated_tokens: backendGeneratedTokens,
    llama_generated_tokens: llamaGeneratedTokens,
    backend_text: backendText,
    llama_text: llamaText,
    backend_usage: backendChat.usage,
    llama_usage: llamaCompletion.timings,
    camelid: backendChat.camelid,
    llama_completion: llamaCompletion,
  }
  report.passed = report.prompt_tokens_match && report.generated_tokens_match && report.generated_text_match
  await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`context=${context}`)
  console.log(`reference_prompt_token_count=${report.reference_prompt_token_count}`)
  console.log(`prompt_tokens_match=${report.prompt_tokens_match}`)
  console.log(`generated_tokens_match=${report.generated_tokens_match}`)
  console.log(`generated_text_match=${report.generated_text_match}`)
  console.log(`report_json=${join(outDir, 'report.json')}`)
  if (!report.passed) process.exitCode = 1
} finally {
  child?.kill('SIGTERM')
}

async function curlJson(url, body) {
  const curlArgs = ['-fsS', '--max-time', curlMaxTime, '-H', 'Accept: application/json']
  if (body !== undefined) curlArgs.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body))
  curlArgs.push(url)
  const { stdout } = await execFileP('curl', curlArgs, { maxBuffer: 100 * 1024 * 1024 })
  return stdout ? JSON.parse(stdout) : null
}
async function waitFor(url,label,waitMs){const start=Date.now(); let last=''; while(Date.now()-start<waitMs){try{await execFileP('curl',['-fsS','--max-time','10',url],{maxBuffer:1024*1024}); return}catch(e){last=e.message; await new Promise(r=>setTimeout(r,1000))}} throw new Error(`timed out waiting for ${label}: ${last}`)}
function renderLlama32MetadataTemplate(messages) { const bos = '<|begin_of_text|>'; let idx = 0; let system = ''; if (messages[0]?.role?.trim() === 'system') { system = String(messages[0].content || '').trim(); idx = 1 } let out = bos; out += '<|start_header_id|>system<|end_header_id|>\n\n'; out += 'Cutting Knowledge Date: December 2023\n'; out += 'Today Date: 26 Jul 2024\n\n'; out += system; out += '<|eot_id|>'; for (; idx < messages.length; idx++) { const m = messages[idx]; out += `<|start_header_id|>${String(m.role).trim()}<|end_header_id|>\n\n${String(m.content || '').trim()}<|eot_id|>` } if (messages.at(-1)?.role?.trim() !== 'assistant') out += '<|start_header_id|>assistant<|end_header_id|>\n\n'; return out }
function parseArgs(argv){const m=new Map(); for(let i=0;i<argv.length;i++){const a=argv[i]; if(!a.startsWith('--')) continue; const [k,v]=a.slice(2).split('=',2); m.set(k, v ?? (argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : 'true'))} return m}
function req(k){const v=args.get(k); if(!v) throw new Error(`--${k} is required`); return v}
function run(cmd, a){return new Promise((res,rej)=>{const p=spawn(cmd,a,{stdio:['ignore','pipe','pipe']}); let stdout='', stderr=''; p.stdout.on('data',c=>stdout+=c); p.stderr.on('data',c=>stderr+=c); p.once('error',rej); p.once('close',code=> code===0?res({stdout,stderr}):rej(new Error(`${cmd} failed ${code}: ${stderr}`)))})}
function firstArrayDifference(a,b){for(let i=0;i<Math.min(a.length,b.length);i++) if(a[i]!==b[i]) return i; return a.length===b.length?null:Math.min(a.length,b.length)}
function firstStringDifference(a,b){for(let i=0;i<Math.min(a.length,b.length);i++) if(a[i]!==b[i]) return i; return a.length===b.length?null:Math.min(a.length,b.length)}
function shellJoin(cmd,args){return [cmd,...args].map(x=>/^[A-Za-z0-9_/:=.,-]+$/.test(String(x))?String(x):`'${String(x).replace(/'/g, `'\\''`)}'`).join(' ')}
