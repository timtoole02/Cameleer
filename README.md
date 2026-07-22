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
- **Runtime & Audit:** View live agent run logs, pending tool approvals, and complete audit history.
- **Models:** Configure external providers or manage local model artifacts.

## Architecture

The system is strictly divided into domains. The frontend communicates with the Tauri backend exclusively via `invoke` commands wrapped in `src/api/`. State is managed by Zustand for UI layout, while all entity data is fetched dynamically from the `local_state.db` SQLite database managed by Rust.

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

## Status

**v0.1 production candidate — verified on macOS (Apple Silicon).**

* `cargo test -p control-center` — 44/44 backend tests pass, including an
  end-to-end persistence test that closes and reopens the database and asserts
  all state survives (`src-tauri/src/e2e_persistence.rs`).
* Frontend `tsc` clean, `vitest` green, P0 smoke test passes.
* `npm run tauri build` produces a working `Cameleer.app` + `.dmg` with the
  Camelid inference runtime bundled in `Contents/Resources/`.
* Agent task runs drive a real bounded ReAct loop (plan → act → observe) with
  persisted run steps, tool invocations, and a work-receipt approval gate.
* Durable state lives in `~/.cameleer/cameleer_workspace.db` (same path every
  launch); migrations are idempotent.

See `docs/AUDIT_REAL_VS_FAKE.md` for the evidence-based real-vs-fake audit.

## License

MIT
