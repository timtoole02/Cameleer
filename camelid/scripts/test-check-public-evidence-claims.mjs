#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const tempRoot = await mkdtemp(join(tmpdir(), 'camelid-evidence-claims-'))
const goodRoot = join(tempRoot, 'good')
const badRoot = join(tempRoot, 'bad')
const staleMixtralRoot = join(tempRoot, 'stale-mixtral')
const privatePathRoot = join(tempRoot, 'private-path')
const privateWindowsCachePath = ['file:///C:', 'Users', 'tim', 'AppData', 'Local', 'camelid', 'model.gguf'].join('/')
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

await writeBundle(goodRoot, { mutate: false })
await writeSingleRowContextBundle(goodRoot, { mutate: false })
await writeEightBContextBundle(goodRoot, { mutate: false })
await writeEightBContext1024And2048Bundle(goodRoot, { mutate: false })
await writeMistralContext51210242048Bundle(goodRoot, { mutate: false })
await writeLegacyPublicContextBundle(goodRoot, { mutate: false })
await writeMixtralPromotionAndBlockerEvidence(goodRoot, { reconciled: true })
await writeBackendLocalGuardrailBundle(goodRoot, { mutate: false })
await writeBundle(badRoot, { mutate: true })
await writeSingleRowContextBundle(badRoot, { mutate: true })
await writeEightBContextBundle(badRoot, { mutate: true })
await writeEightBContext1024And2048Bundle(badRoot, { mutate: true })
await writeMistralContext51210242048Bundle(badRoot, { mutate: true })
await writeLegacyPublicContextBundle(badRoot, { mutate: true })
await writeMixtralPromotionAndBlockerEvidence(badRoot, { reconciled: false })
await writeBackendLocalGuardrailBundle(badRoot, { mutate: true })
await writeMixtralPromotionAndBlockerEvidence(staleMixtralRoot, { reconciled: true, omitDependencySupersedes: true })
await writePrivatePathEvidence(privatePathRoot)

const good = spawnSync(process.execPath, ['scripts/check-public-evidence-claims.mjs', '--root', goodRoot], {
  cwd: process.cwd(),
  encoding: 'utf8',
})
assert.equal(good.status, 0, good.stderr || good.stdout)
assert.match(good.stdout, /public evidence claim check passed/)

const bad = spawnSync(process.execPath, ['scripts/check-public-evidence-claims.mjs', '--root', badRoot], {
  cwd: process.cwd(),
  encoding: 'utf8',
})
assert.notEqual(bad.status, 0, 'invalid context evidence should fail')
assert.match(bad.stderr, /generated_tokens_match must be true/)
assert.match(bad.stderr, /source_prompt_pack must be qa\/prompt-packs\/llama3-context-1024-smoke\.json/)
assert.match(bad.stderr, /q8_file_reads\.read_bytes mismatch/)
assert.match(bad.stderr, /prefill_q8_file_reads\.read_calls mismatch/)
assert.match(bad.stderr, /summary head mismatch/)
assert.match(bad.stderr, /row_id must be mistral_7b_instruct_v0_3_q8_0/)
assert.match(bad.stderr, /raw_artifact must be a safe relative path/)
assert.match(bad.stderr, /backend_generated_tokens must stay \[34,2735,35,12,7854\]/)
assert.match(bad.stderr, /Mixtral promotion claims conflict with later long-output blocker evidence/)
assert.match(bad.stderr, /backend local guardrail no_remote_validation_used must be true/)
assert.match(bad.stderr, /backend local guardrail command public-scrub must exit 0/)
assert.match(bad.stderr, /backend local guardrail support_boundary must preserve Mixtral blocked/)

const staleMixtral = spawnSync(process.execPath, ['scripts/check-public-evidence-claims.mjs', '--root', staleMixtralRoot], {
  cwd: process.cwd(),
  encoding: 'utf8',
})
assert.notEqual(staleMixtral.status, 0, 'Mixtral reconciliation must supersede promotion dependency bundles')
assert.match(staleMixtral.stderr, /supersedes must include .*mixtral-8x7b-v0\.1-q8-api-smoke-test/)

const privatePath = spawnSync(process.execPath, ['scripts/check-public-evidence-claims.mjs', '--root', privatePathRoot], {
  cwd: process.cwd(),
  encoding: 'utf8',
})
assert.notEqual(privatePath.status, 0, 'public evidence manifests must not expose local/private paths')
assert.match(privatePath.stderr, /must not expose local\/private path .*\/Users\/timtoole\/\.cameleer\/workspace\/projects\/Camelid\/target\/private\/report\.json/)
assert.match(privatePath.stderr, /must not expose local\/private path .*file:\/\/localhost\/home\/tim\/\.cache\/camelid\/model\.gguf/)
assert.match(privatePath.stderr, /must not expose local\/private path .*file:\/\/localhost\/Volumes\/private-models\/llama\.gguf/)
assert.match(
  privatePath.stderr,
  new RegExp(`must not expose local/private path .*${escapeRegExp(privateWindowsCachePath)}`),
)
assert.match(privatePath.stderr, /must not expose local\/private path .*\/private\/tmp\/camelid\/report\.json/)

async function writePrivatePathEvidence(root) {
  const dir = join(root, 'private-path-test')
  const privateMacPath = ['', 'Users', 'timtoole', '.cameleer', 'workspace', 'projects', 'Camelid', 'target', 'private', 'report.json'].join('/')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify({
    schema: 'camelid.private_path_guard_test.v1',
    raw_artifact: privateMacPath,
    nested: { model_uri: 'file://localhost/home/tim/.cache/camelid/model.gguf' },
    mounted_model: 'file://localhost/Volumes/private-models/llama.gguf',
    windows_cache: privateWindowsCachePath,
    private_tmp: '/private/tmp/camelid/report.json',
  }, null, 2)}\n`)
}

async function writeBackendLocalGuardrailBundle(root, { mutate }) {
  const dir = join(root, 'backend-local-current-head-exact-row-guardrail-test')
  await mkdir(dir, { recursive: true })
  const manifest = {
    schema: 'camelid.backend_local_current_head_exact_row_guardrail.v1',
    local_only: true,
    no_remote_validation_used: !mutate,
    head: 'b4d2d3a54fc773d2e2be65ccc2617501ef835e1a',
    head_short: 'b4d2d3a54fc7',
    passed: true,
    commands: {
      'cargo-test-capabilities': 0,
      'public-evidence-claims': 0,
      'public-scrub': mutate ? 1 : 0,
      'git-diff-check': 0,
    },
    support_boundary: mutate
      ? 'support promoted broadly'
      : 'Mixtral remains bounded/partial and blocked after early-token parity; Llama rows remain exact-row bounded only where row-specific evidence exists; no broad/full-support promotion claimed.',
  }
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

async function writeMixtralPromotionAndBlockerEvidence(root, { reconciled, omitDependencySupersedes = false }) {
  const promotionDir = join(root, 'mixtral-8x7b-v0.1-q8-manifest-checksum-test')
  const syncDir = join(root, 'mixtral-8x7b-v0.1-q8-promotion-sync-test')
  const gate9Dir = join(root, 'mixtral-8x7b-v0.1-q8-gate9a-50tok-test')
  const backendDir = join(root, 'mixtral-8x7b-v0.1-q8-backend-parity-refresh-test')
  const apiDir = join(root, 'mixtral-8x7b-v0.1-q8-api-smoke-test')
  const webuiDir = join(root, 'mixtral-8x7b-v0.1-q8-webui-readiness-test')
  const rssDir = join(root, 'mixtral-8x7b-v0.1-q8-rss-timing-runtime-test')
  const reconcileDir = join(root, 'mixtral-8x7b-v0.1-q8-blocker-reconciliation-test')
  await mkdir(promotionDir, { recursive: true })
  await mkdir(syncDir, { recursive: true })
  await mkdir(gate9Dir, { recursive: true })
  await mkdir(backendDir, { recursive: true })
  await mkdir(apiDir, { recursive: true })
  await mkdir(webuiDir, { recursive: true })
  await mkdir(rssDir, { recursive: true })
  const promotionDependencies = [
    'mixtral-8x7b-v0.1-q8-backend-parity-refresh-test',
    'mixtral-8x7b-v0.1-q8-api-smoke-test',
    'mixtral-8x7b-v0.1-q8-webui-readiness-test',
    'mixtral-8x7b-v0.1-q8-rss-timing-runtime-test',
  ]
  const promotionManifest = {
    schema: 'camelid.mixtral_exact_row_manifest.v1',
    model: { filename: 'Mixtral-8x7B-Instruct-v0.1.Q8_0.gguf', sha256: 'c'.repeat(64) },
    scope: 'validated exact row only; no broad Mixtral-family support claim',
    promotion_gate_artifacts: promotionDependencies.map((bundle) => ({ bundle, files: ['summary.json'] })),
  }
  const promotionSync = {
    schema: 'camelid.mixtral_exact_row_promotion_sync.v1',
    support_label: 'supported_exact_row_smoke',
    scope: 'validated exact row only; checked short-prompt envelope only',
    required_prior_gates: promotionDependencies.map((name) => relative(process.cwd(), join(root, name))),
  }
  const gate9Summary = {
    schema: 'camelid.mixtral_gate9a_long_output.v1',
    model: 'Mixtral-8x7B-Instruct-v0.1.Q8_0.gguf',
    scope: 'exact row only; no support claim change',
    all_completed: false,
    all_token_parity: false,
    stop_reason: 'stopped_on_error_or_divergence_before_50',
  }
  await writeFile(join(promotionDir, 'manifest.json'), `${JSON.stringify(promotionManifest, null, 2)}\n`)
  await writeFile(join(syncDir, 'summary.json'), `${JSON.stringify(promotionSync, null, 2)}\n`)
  await writeFile(join(gate9Dir, 'summary.json'), `${JSON.stringify(gate9Summary, null, 2)}\n`)
  for (const dir of [backendDir, apiDir, webuiDir, rssDir]) {
    await writeFile(join(dir, 'summary.json'), `${JSON.stringify({ bundle: dir.split('/').pop(), all_passed: true }, null, 2)}\n`)
  }
  if (!reconciled) return
  await mkdir(reconcileDir, { recursive: true })
  const supersededBundles = omitDependencySupersedes
    ? ['mixtral-8x7b-v0.1-q8-manifest-checksum-test', 'mixtral-8x7b-v0.1-q8-promotion-sync-test']
    : [...promotionDependencies, 'mixtral-8x7b-v0.1-q8-manifest-checksum-test', 'mixtral-8x7b-v0.1-q8-promotion-sync-test']
  const reconciliation = {
    schema: 'camelid.mixtral_blocker_reconciliation.v1',
    current_status: 'active_validation_partial_runtime',
    support_label: 'unsupported_bounded_one_token_runtime_only',
    support_boundary: 'Mixtral remains unsupported/blocked beyond bounded one-token runtime evidence; no broad Mixtral support is claimed.',
    supersedes: supersededBundles.map((name) => relative(process.cwd(), join(root, name))),
    blocker_evidence: [relative(process.cwd(), join(root, 'mixtral-8x7b-v0.1-q8-gate9a-50tok-test'))],
  }
  await writeFile(join(reconcileDir, 'manifest.json'), `${JSON.stringify(reconciliation, null, 2)}\n`)
}

async function writeBundle(root, { mutate }) {
  const dir = join(root, 'four-row-context-512-test')
  await mkdir(dir, { recursive: true })
  const boundary = 'Closes only the first bounded 512-context pack. It does not promote neighboring rows, other quantizations, larger contexts, broader chat-template behavior, or full Llama-family support.'
  const rows = [
    row('tinyllama_1_1b_chat_q8_0', 291),
    row('llama32_1b_instruct_q8_0', 245),
    row('llama32_3b_instruct_q8_0', 245),
    row('llama3_8b_instruct_q8_0', 245),
  ]
  if (mutate) rows[3].generated_tokens_match = false
  const manifest = {
    schema: 'camelid.four_row_context_512_public_evidence.v1',
    passed: true,
    checkout_clean: true,
    pack: {
      target_context_window: 512,
      max_tokens: 5,
      source_prompt_pack: 'qa/prompt-packs/llama3-context-512-smoke.json',
    },
    rows,
    claim_boundary: boundary,
  }
  const summary = {
    schema: 'camelid.four_row_context_512_public_summary.v1',
    passed: true,
    checks: {
      checkout_clean: true,
      prompt_tokens_all_match: true,
      generated_tokens_all_match: true,
      generated_text_all_match: true,
      all_rows_have_bounded_rss: true,
    },
    rows: rows.map((item) => ({
      row_id: item.row_id,
      context_window: item.context_window,
      reference_prompt_token_count: item.reference_prompt_token_count,
      max_tokens: item.max_tokens,
      max_resident_set_kib: item.max_resident_set_kib,
      passed: item.prompt_tokens_match && item.generated_tokens_match && item.generated_text_match,
    })),
    claim_boundary: boundary,
  }
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(join(dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
}

async function writeLegacyPublicContextBundle(root, { mutate }) {
  const dir = join(root, 'llama32-1b-context-2048-legacy-test')
  await mkdir(dir, { recursive: true })
  const generatedTokens = mutate ? [34, 2735, 35, 12, 4278] : [34, 2735, 35, 12, 7854]
  const manifest = {
    schema: 'camelid.public-evidence-bundle.v1',
    id: 'llama32-1b-context-2048-legacy-test',
    source_head: '62f8cbc',
    created_at_utc: '2026-05-06T01:05:00Z',
    model_row: 'llama32_1b_instruct_q8_0',
    model: '$CAMELID_MODEL_DIR/Llama-3.2-1B-Instruct-Q8_0.gguf',
    pack_id: 'llama3-context-2048-smoke-v1',
    target_context_window: 2048,
    reference_prompt_token_count: 1910,
    max_tokens: 5,
    result: {
      passed: true,
      prompt_tokens_all_match: true,
      generated_tokens_all_match: true,
      generated_text_all_match: true,
      backend_generated_tokens: generatedTokens,
      reference_generated_tokens: [34, 2735, 35, 12, 7854],
      backend_text: 'CMLD-204',
      reference_text: 'CMLD-204',
    },
    boundary:
      'Closes only the third bounded 2048-context pack for the exact Llama 3.2 1B row. It does not promote neighboring rows, other quantizations, model-native/larger context buckets, arbitrary templates, broad/full Llama-family support, production throughput, or portability support.',
    primary_artifacts: [
      'pack/summary.json',
      'pack/llama32-1b-q8-roughly-2048-token-recall/report.json',
    ],
  }
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

async function writeSingleRowContextBundle(root, { mutate }) {
  const dir = join(root, 'llama32-1b-context-1024-test')
  await mkdir(dir, { recursive: true })
  const rowItem = contextRow({
    rowId: 'llama32_1b_instruct_q8_0',
    contextWindow: 1024,
    promptId: 'roughly-1024-token-recall',
    generatedText: 'CMLD-102',
    rawArtifact: 'target/llama32-1b-context-1024-test/summary.json',
  })
  const manifest = {
    schema: 'camelid.llama32_1b_context_1024_public_evidence.v1',
    passed: true,
    checkout_clean: true,
    pack: {
      target_context_window: 1024,
      max_tokens: 5,
      source_prompt_pack: mutate ? 'qa/prompt-packs/llama3-context-512-smoke.json' : 'qa/prompt-packs/llama3-context-1024-smoke.json',
      prompt_count: 1,
    },
    rows: [rowItem],
    claim_boundary:
      'Closes only the second bounded 1024-context pack for the exact Llama 3.2 1B row. It does not promote neighboring rows, other quantizations, model-native/larger context buckets, arbitrary templates, broad/full Llama-family support, production throughput, or portability support.',
  }
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

async function writeEightBContextBundle(root, { mutate }) {
  const dir = join(root, 'llama3-8b-context-2048-test')
  await mkdir(dir, { recursive: true })
  const rowItem = contextRow({
    rowId: 'llama3_8b_instruct_q8_0',
    contextWindow: 2048,
    promptId: 'roughly-2048-token-recall',
    generatedText: mutate ? 'CMLD-102' : 'CMLD-204',
    rawArtifact: 'target/llama3-8b-context-2048-test/summary.json',
  })
  const manifest = {
    schema: 'camelid.llama3_8b_context_2048_public_evidence.v1',
    passed: true,
    checkout_clean: true,
    pack: {
      target_context_window: 2048,
      max_tokens: 5,
      source_prompt_pack: 'qa/prompt-packs/llama3-context-2048-smoke.json',
      prompt_count: 1,
    },
    rows: [rowItem],
    claim_boundary:
      'Closes only the third bounded 2048-context pack for the exact Llama 3 8B row. It does not promote neighboring rows, other quantizations, model-native/larger context buckets, arbitrary templates, broad/full Llama-family support, production throughput, or portability support.',
  }
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

async function writeEightBContext1024And2048Bundle(root, { mutate }) {
  const dir = join(root, 'llama3-8b-context-1024-2048-test')
  await mkdir(dir, { recursive: true })
  const boundary = 'Promotes only exact llama3_8b_instruct_q8_0 bounded 1024/2048 prompt packs. It does not promote neighboring rows, other quantizations, model-native/larger context buckets, arbitrary templates, broad/full Llama-family support, production throughput, or portability support.'
  const currentHead = '9e3c64f2cfab098f9cccbc8e5f879ecd99d73666'
  const rows = [
    contextRow({
      rowId: 'llama3_8b_instruct_q8_0',
      contextWindow: 1024,
      promptId: 'roughly-1024-token-recall',
      generatedText: 'CMLD-102',
      rawArtifact: 'target/llama3-8b-context-1024-2048-test/pack-1024/report.json',
      q8FileReads: q8FileReads({ readCalls: 3210, readBytes: 54703408384 }),
      prefillQ8FileReads: q8FileReads({ readCalls: 1111, readBytes: 2147483648 }),
    }),
    contextRow({
      rowId: 'llama3_8b_instruct_q8_0',
      contextWindow: 2048,
      promptId: 'roughly-2048-token-recall',
      generatedText: 'CMLD-204',
      rawArtifact: 'target/llama3-8b-context-1024-2048-test/pack-2048/report.json',
      q8FileReads: q8FileReads({ readCalls: 4879, readBytes: 69538945536 }),
      prefillQ8FileReads: q8FileReads({ readCalls: 2222, readBytes: 4294967296 }),
    }),
  ]
  const summaryRows = rows.map((row) => ({
    row_id: row.row_id,
    context_window: row.context_window,
    reference_prompt_token_count: row.reference_prompt_token_count,
    max_tokens: row.max_tokens,
    max_resident_set_kib: row.max_resident_set_kib,
    passed: row.passed,
    q8_file_reads: { ...row.q8_file_reads },
    prefill_q8_file_reads: { ...row.prefill_q8_file_reads },
  }))
  if (mutate) {
    summaryRows[1].q8_file_reads.read_bytes += 1
    summaryRows[0].prefill_q8_file_reads.read_calls += 1
  }
  const manifest = {
    schema: 'camelid.llama3_8b_context_1024_2048_current_head_public_evidence.v1',
    git_head: currentHead,
    passed: true,
    checkout_clean: true,
    pack: {
      max_tokens: 5,
      ids: ['llama3-context-1024-smoke-v1', 'llama3-context-2048-smoke-v1'],
      source_prompt_packs: ['qa/prompt-packs/llama3-context-1024-smoke.json', 'qa/prompt-packs/llama3-context-2048-smoke.json'],
    },
    rows,
    claim_boundary: boundary,
  }
  const summary = {
    schema: 'camelid.llama3_8b_context_1024_2048_current_head_summary.v1',
    source_manifest: 'manifest.json',
    head: mutate ? 'aaaaaaaaaaaa098f9cccbc8e5f879ecd99d73666' : currentHead,
    passed: true,
    rows: summaryRows,
    claim_boundary: boundary,
  }
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(join(dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
}

async function writeMistralContext51210242048Bundle(root, { mutate }) {
  const dir = join(root, 'mistral-7b-context-512-1024-2048-test')
  await mkdir(dir, { recursive: true })
  const boundary = 'Promotes only exact mistral_7b_instruct_v0_3_q8_0 bounded 512/1024/2048 prompt packs. It does not promote neighboring rows, other quantizations, model-native/larger context buckets, arbitrary templates, Mistral-family support, production throughput, or portability support.'
  const rows = [
    mistralContextRow({
      contextWindow: 512,
      promptId: 'mistral-roughly-512-token-recall',
      referencePromptTokenCount: 315,
      rawArtifact: 'target/mistral-7b-context-512-1024-2048-test/pack-512/report.json',
    }),
    mistralContextRow({
      contextWindow: 1024,
      promptId: 'mistral-roughly-1024-token-recall',
      referencePromptTokenCount: 721,
      rawArtifact: 'target/mistral-7b-context-512-1024-2048-test/pack-1024/report.json',
    }),
    mistralContextRow({
      contextWindow: 2048,
      promptId: 'mistral-roughly-2048-token-recall',
      referencePromptTokenCount: 1498,
      rawArtifact: mutate
        ? '/redacted/private/mistral-7b-context-512-1024-2048-test/pack-2048/report.json'
        : 'target/mistral-7b-context-512-1024-2048-test/pack-2048/report.json',
    }),
  ]
  if (mutate) rows[1].row_id = 'mistral_7b_instruct_v0_2_q8_0'
  const manifest = {
    schema: 'camelid.mistral_7b_context_512_1024_2048_current_head_public_evidence.v1',
    passed: true,
    pack: {
      max_tokens: 5,
      ids: ['mistral-context-512-smoke-v1', 'mistral-context-1024-smoke-v1', 'mistral-context-2048-smoke-v1'],
      source_prompt_packs: ['qa/prompt-packs/mistral-context-512-smoke.json', 'qa/prompt-packs/mistral-context-1024-smoke.json', 'qa/prompt-packs/mistral-context-2048-smoke.json'],
    },
    checks: {
      prompt_tokens_all_match: true,
      generated_tokens_all_match: true,
      generated_text_all_match: true,
      api_health_loaded_generation_ready: true,
      v1_completions_passed: true,
      v1_chat_completions_passed: true,
      privacy_scrub_required: true,
    },
    rows,
    claim_boundary: boundary,
  }
  const summary = {
    schema: 'camelid.mistral_7b_context_512_1024_2048_current_head_summary.v1',
    source_manifest: 'manifest.json',
    passed: true,
    rows: rows.map((row) => ({
      row_id: row.row_id,
      context_window: row.context_window,
      reference_prompt_token_count: row.reference_prompt_token_count,
      max_tokens: row.max_tokens,
      max_resident_set_kib: row.max_resident_set_kib,
      passed: row.passed,
    })),
    claim_boundary: boundary,
  }
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(join(dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
}

function mistralContextRow({ contextWindow, promptId, referencePromptTokenCount, rawArtifact }) {
  return {
    row_id: 'mistral_7b_instruct_v0_3_q8_0',
    context_window: contextWindow,
    max_tokens: 5,
    prompt_id: promptId,
    reference_prompt_token_count: referencePromptTokenCount,
    prompt_tokens_match: true,
    generated_tokens_match: true,
    generated_text_match: true,
    first_generated_token_diff_index: -1,
    generated_text: ' The repeat marker is "',
    llama_text: ' The repeat marker is "',
    backend_generated_tokens: [1183, 14518, 19612, 1117, 1113],
    llama_generated_tokens: [1183, 14518, 19612, 1117, 1113],
    max_resident_set_kib: 6742016,
    model_sha256: 'd'.repeat(64),
    raw_artifact: rawArtifact,
    passed: true,
  }
}

function contextRow({ rowId, contextWindow, promptId, generatedText, rawArtifact, q8FileReads, prefillQ8FileReads }) {
  return {
    row_id: rowId,
    context_window: contextWindow,
    max_tokens: 5,
    prompt_id: promptId,
    reference_prompt_token_count: contextWindow === 2048 ? 1910 : 881,
    prompt_tokens_match: true,
    generated_tokens_match: true,
    generated_text_match: true,
    first_generated_token_diff_index: -1,
    generated_text: generatedText,
    max_resident_set_kib: 2897852,
    model_sha256: 'b'.repeat(64),
    raw_artifact: rawArtifact,
    passed: true,
    ...(q8FileReads ? { q8_file_reads: q8FileReads } : {}),
    ...(prefillQ8FileReads ? { prefill_q8_file_reads: prefillQ8FileReads } : {}),
  }
}

function q8FileReads({ readCalls, readBytes }) {
  return {
    read_calls: readCalls,
    read_bytes: readBytes,
    cache_hits: 0,
    cache_hit_bytes: 0,
    cache_misses: 0,
    cache_miss_bytes: 0,
    cache_inserts: 0,
    cache_insert_bytes: 0,
    cache_evictions: 0,
    cache_evicted_bytes: 0,
    cache_merges: 0,
    cache_merged_bytes: 0,
    cache_entries: 0,
    cache_bytes: 0,
    cache_capacity_bytes: 0,
  }
}

function row(rowId, tokenCount) {
  return {
    row_id: rowId,
    context_window: 512,
    max_tokens: 5,
    reference_prompt_token_count: tokenCount,
    prompt_tokens_match: true,
    generated_tokens_match: true,
    generated_text_match: true,
    first_generated_token_diff_index: -1,
    max_resident_set_kib: 1024,
    model_sha256: 'a'.repeat(64),
    raw_artifact: `target/${rowId}/summary.json`,
  }
}
