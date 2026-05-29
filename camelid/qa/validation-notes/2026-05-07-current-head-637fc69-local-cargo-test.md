# 2026-05-07 current-head local cargo test

- Lane: backend validation/docs slice.
- Host: local macOS workspace.
- Branch/HEAD at start: `main` / `637fc69` (`Reuse Q8 file-reader scales for single rows`).
- Support truth preserved: exact-row only — TinyLlama Q8 gate; Llama 3.2 1B/3B Q8_0 bounded 2048; Llama 3 8B Q8_0 bounded 512 only; 8B 1024/2048 remain red/not promoted without fresh PASS artifacts plus docs/API/frontend alignment.

## Commands

```console
$ git status --short --branch
## main...origin/main

$ git rev-parse --short HEAD
637fc69

$ git log --oneline -5
637fc69 Reuse Q8 file-reader scales for single rows
10a0a19 Publish bounded four-row parity claim
af53771 Record current-head exact guardrails
30f86fc Polish guarded chat landing
fdbceac Scrub 8B validation note host paths

$ cargo test
...
test result: ok. 134 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.20s
...
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
...
test result: ok. 53 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
...
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
...
test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
...
test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
...
test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
...
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
...
test result: ok. 19 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
...
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

## Result

Local `cargo test` passed on current HEAD before any support-claim widening. This note is validation evidence only; it does not promote 8B 1024/2048 or any broad/full support bucket.
