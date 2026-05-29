# Current-head Llama 3 8B bounded 1024/2048 guardrail rerun — ab8e465

Git head: `ab8e465b50c3dca9c81d078f86c24cdc027013eb`

Committed artifact root: `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T194559Z-head-ab8e465b50c3`

Boundary: exact `llama3_8b_instruct_q8_0` bounded 1024/2048 prompt packs only. This does not promote model-native/larger context, arbitrary templates, neighboring rows, broad 8B/Llama-family support, portability, or production throughput.

Preflight:

- Local `main` was clean at `ab8e465b50c3dca9c81d078f86c24cdc027013eb` before this evidence slice.
- Canonical host process scan showed existing backend/Vite activity, including other 8B-capable servers, so this used a fresh worktree/ports and did not duplicate an already-running 8B prompt-pack job.
- Canonical worktree: maintainer-private approved Ubuntu validation-lane worktree; committed public artifact root is listed below.

Canonical command shape:

- `scripts/with-rustup-cargo.sh build --release`
- `node scripts/run-llama3-prompt-pack.mjs --pack qa/prompt-packs/llama3-context-1024-smoke.json ... --require-prompt-match --require-generated-match --start-llama-server`
- `node scripts/run-llama3-prompt-pack.mjs --pack qa/prompt-packs/llama3-context-2048-smoke.json ... --require-prompt-match --require-generated-match --start-llama-server`

Results:

| Pack | Prompt tokens | Generated text | Max RSS | Q8 file reads | Result |
| --- | ---: | --- | ---: | ---: | --- |
| 1024 | 881 | `CMLD-102` | 979668 KiB | 3210 calls / 54703408384 bytes | PASS |
| 2048 | 1910 | `CMLD-204` | 1825148 KiB | 4879 calls / 69538945536 bytes | PASS |

Both rows matched prompt tokens, generated token IDs, and generated text against llama.cpp.

Local gates:

- `cargo test q8_0_file_reader --lib -- --nocapture`: PASS (4 tests)
- `node scripts/test-check-public-evidence-claims.mjs`: PASS
- `node scripts/check-public-evidence-claims.mjs`: PASS before adding this bundle
- Bundle-specific claim/checksum/privacy gates are recorded in the commit validation output.
