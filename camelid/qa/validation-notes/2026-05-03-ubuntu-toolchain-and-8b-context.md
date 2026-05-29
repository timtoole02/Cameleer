# Ubuntu validation note — toolchain selection and Llama 3 8B context blocker

Date: 2026-05-03
Repo head validated: `bec0f8e`

## What changed

- Added `rust-version = "1.87"` to `Cargo.toml`.
- Added `rust-toolchain.toml` with `1.87.0` so rustup-managed hosts have a checked-in floor.
- Added `scripts/with-rustup-cargo.sh` to prefer `$HOME/.cargo/bin/cargo` on dual-install hosts.
- Updated `README.md` and `CONTRIBUTING.md` so Ubuntu validation hosts use the rustup toolchain instead of an older distro cargo.

## Ubuntu toolchain finding

On the approved Ubuntu validation host, bare `/usr/bin/cargo` is still `1.75.0` and cannot build current Camelid head.

Validated outcomes:

- `/usr/bin/cargo build --release --bin camelid` fails on current head.
- `./scripts/with-rustup-cargo.sh --version` resolves to rustup cargo and succeeds.
- `./scripts/with-rustup-cargo.sh +1.87.0 build --release --bin camelid` succeeds in a clean clone.
- Separate spot checks showed `cargo +1.86.0 build` still fails, while `cargo +1.87.0 build` succeeds.

Conclusion: the current checked-in floor is Rust/Cargo `1.87+`, and Ubuntu validation must not rely on the older distro cargo.

## Llama 3 8B exact-row follow-up on Ubuntu

### Short bounded chat still matches

A clean Ubuntu clone built with the rustup-selected toolchain still passes the exact-row compact `hello` parity check for `Meta-Llama-3-8B-Instruct-Q8_0.gguf`:

- prompt tokens matched llama.cpp
- 1 generated token matched llama.cpp
- generated text matched llama.cpp (`"Hello"`)

Important timing detail from Camelid's own response payload:

- `camelid.timings_ms.generate = 21515`

That is good enough for the existing short smoke lane, but it is already slow for support-grade expansion.

### First longer-context bucket is still blocked

The first bounded longer-context pack (`qa/prompt-packs/llama3-context-512-smoke.json`) was rerun on Ubuntu against the exact 8B row with `max_tokens=5` and a `300000 ms` client timeout.

Result:

- llama.cpp reference prompt eval + 5-token completion finished successfully
- Camelid timed out at `POST /v1/chat/completions` after `300000 ms`
- the pack therefore produced a real blocker for longer-context parity on the exact 8B row

Conclusion: exact-row short smoke remains intact, but 8B longer-context/performance support is still blocked on current head and should not be promoted beyond the current narrow support envelope.
