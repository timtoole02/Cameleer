# 2026-05-06 — 8B runtime/perf artifact triage and bounded-context promotion

Scope: exact Llama 3 8B Instruct Q8_0 only. This promotes only the copied/scrubbed bounded 1024- and 2048-context packs backed by current-head public artifacts; it does not widen to model-native/larger context, production throughput, portability, arbitrary templates, neighboring 8B rows, or broad Llama-family support.

## Artifact source state

- Source head for copied public artifacts: `ae672d935a9df500fe67e3fcc17ab692c0cdada8` (`origin/main` at run time).
- Validation lane: clean public Ubuntu validation lane.
- Runtime shape: lazy Q8 on, retained Q8 blocks off, `CAMELID_PREFILL_CHUNK_TOKENS=256`, Q8 file cache `0`, Q8 file reader chunk bytes `67108864`, parallel linear enabled.

## Public PASS artifacts

| Pack | Artifact | Prompt tokens / ctx | Result | Generated | Wall | timed max RSS | sampled backend RSS |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| 8B second bounded 1024-context | `qa/evidence-bundles/llama3-8b-context-1024-20260506T144810Z-head-ae672d935a9d/manifest.json` | 881 / 1024 | PASS: prompt tokens, generated tokens, and generated text matched llama.cpp | `CMLD-102` (`[34,2735,35,12,4278]`) | `3:02.05` | `17373104 KiB` | not recorded |
| 8B third bounded 2048-context | `qa/evidence-bundles/llama3-8b-context-2048-20260506T144037Z-head-ae672d935a9d/manifest.json` | 1910 / 2048 | PASS: prompt tokens, generated tokens, and generated text matched llama.cpp | `CMLD-204` (`[34,2735,35,12,7854]`) | `8:27.08` | `17507392 KiB` | `1537484 KiB` |

Both bundles include `SHA256SUMS`, `summary.json`, `pack.stdout.log`, `pack.time.txt`, sanitized command/report files, runtime env, and model SHA256.

## Runtime/code follow-up captured in this slice

- The Q8 file-backed multi-row matmul path now writes directly into the row-major output buffer instead of filling a per-chunk scratch matrix and copying/transposing it back into output.
- The removed scratch path was `Q8_0_FILE_READER_CHUNK_OUTPUT`; the remaining reused buffers cover the row bytes, decoded row scales, and quantized inputs.
- This is a memory/scratch reduction only. It does not create a broad performance or portability claim without separate future artifacts.

## Guardrail status

- The older `qa/validation-notes/2026-05-05-llama3-8b-context-1024-blocker.md` and `qa/validation-notes/2026-05-05-llama3-8b-context-2048-blocker.md` remain red-box history, superseded only for these copied current-head bounded packs.
- Docs/API/frontend are aligned to expose 8B `bounded_context_1024_pack=validated_second_pack`, `bounded_context_2048_pack=validated_third_pack`, and latest checked output `CMLD-204` while preserving fail-closed exact-row language.
