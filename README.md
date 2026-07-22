# Cameleer

**Cameleer** is a local-first enterprise agent workspace powered by Camelid and compatible model backends.

## What Cameleer is / is not

**Cameleer is** the macOS (Apple-Silicon) Tauri desktop app in
[`control-center/`](control-center/) — a React frontend over a Rust/SQLite backend that
vendors the [`camelid`](camelid/) GGUF inference engine as a bundled runtime. That app is
the one and only Cameleer v0.1 artifact.

**Cameleer is not** the pre-pivot multi-agent chat gateway it grew out of — that code is
quarantined under [`tools/legacy-gateway/`](tools/legacy-gateway/), excluded from the
workspace, and neither built nor shipped.

For the honest, evidence-linked state of every capability (what is **Supported** vs merely
**Runnable**, with `file:line`/test/receipt citations), see **[STATUS.md](STATUS.md)** — the
single source of truth. Claims in this README that lack a linked artifact are being
reconciled against STATUS.md during the HARDPAN pass.

## Features (v0.1 P0)

- **Agent Directory:** Create, manage, and assign AI agents with specific roles and personas.
- **Kanban & Backlog:** Task tracking system.
- **Workspace Chat:** Chat directly with assigned agents.
- **Runtime & Audit:** View live agent run logs and pending tool approvals. (The Audit tab currently surfaces only mission-apply events — see the known gap in [STATUS.md](STATUS.md).)
- **Models:** Configure external providers or manage local model artifacts.

> For exactly what is **Supported** (wired + tested) vs merely **Runnable**, with
> `file:line`/test/receipt citations, see **[STATUS.md](STATUS.md)** — the single
> source of truth. This feature list is a high-level overview, not a support matrix.

## Architecture

The system is strictly divided into domains. The frontend communicates with the Tauri backend exclusively via `invoke` commands wrapped in `control-center/src/api/`. State is managed by Zustand for UI layout, while all entity data is fetched dynamically from the SQLite database at `~/.cameleer/cameleer_workspace.db` (`control-center/src-tauri/src/storage.rs:9,18`), managed by Rust.

## Development

Cameleer is a [Tauri](https://tauri.app/) application built with a React/TypeScript frontend and a Rust/SQLite backend.
See `control-center/README.md` for specific frontend development instructions and smoke tests.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- SQLite3

### Getting Started

```bash
cd control-center
npm install
npm run tauri dev
```

### Production Build

```bash
cd control-center
npm run tauri build
```

## Status — v0.1.0-rc (macOS / Apple Silicon)

Every claim below links a receipt under
[`control-center/receipts/`](control-center/receipts/) or a test. Full breakdown in
**[STATUS.md](STATUS.md)**.

* **Backend: 88 tests pass** (`cargo test -p control-center`) —
  [backend](control-center/receipts/backend-baseline.check-receipt.json) +
  [G3 safety](control-center/receipts/g3-safety-tests.check-receipt.json) receipts.
  The safety-critical core (command sandbox, tool controller, ReAct loop, validation
  engine, model adapter) is covered by adversarial tests.
* **Frontend:** `tsc` clean, `vitest` green (3/3), real ESLint, P0 smoke passes —
  [frontend receipt](control-center/receipts/frontend-baseline.check-receipt.json).
* **Packaging:** `npm run tauri build` produces `Cameleer.app` + `.dmg` with the
  camelid runtime bundled in `Contents/Resources/` and verified executable —
  [packaging receipt](control-center/receipts/packaging-local.check-receipt.json).
* **End-to-end (Definition of Done):** the real ReAct loop runs against **live
  camelid inference** (Llama-3.2-1B), producing real run steps + a real tool-invocation
  record, with all state surviving a database close/reopen —
  [e2e receipt](control-center/receipts/g4-live-e2e.e2e-receipt.json).
* Durable state lives in `~/.cameleer/cameleer_workspace.db`; migrations are idempotent.
* **CI** (`.github/workflows/ci.yml`): frontend checks on Linux, backend
  fmt/clippy(`-D warnings`)/test + a full package build on macOS.

**Known gaps** (see STATUS.md): the Audit tab surfaces only mission-apply events; several
backend subsystems are **Runnable** (callable) but not surfaced in the UI and are labeled as
such, not shipped.

See [`docs/AUDIT_REAL_VS_FAKE.md`](docs/AUDIT_REAL_VS_FAKE.md) for the original evidence-based
audit that this pass built on.

## License

MIT
