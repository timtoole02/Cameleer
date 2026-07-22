# legacy-gateway — pre-pivot, NOT part of Cameleer v0.1

This directory holds the **original Cameleer**: a multi-agent **chat gateway**
(Telegram / Discord / Web / Console) with an autonomous agent daemon, a skills
sandbox, and its own TUI. Cameleer was later *elevated from this multi-agent chat
client* into the local-first agent workspace that now lives in
[`../../control-center/`](../../control-center/).

**Status: quarantined.**

- It is **not** a member of the root workspace and is explicitly `exclude`d in
  [`../../Cargo.toml`](../../Cargo.toml), so no workspace command builds, tests, or
  ships it.
- It is **unbuilt and unmaintained** — kept for reference/history only.
- It is **not** the Cameleer binary. The one and only Cameleer v0.1 artifact is the
  Tauri app under `control-center/`.

Contents:

| Path | What it was |
|---|---|
| `src/main.rs` | CLI entrypoint (`onboard` / `run` subcommands) |
| `src/gateway/` | Telegram, Discord, Web, and Console chat gateways |
| `src/agent/` | Autonomous orchestrator, inference daemon, LLM client |
| `src/skills/` | ClawHub skills + sandbox |
| `src/config.rs`, `src/storage.rs` | Legacy config + SQLite storage |
| `main.m` | Objective-C macOS launcher stub |
| `test.png` | Stray fixture image moved out of the repo root |

If this gateway is ever revived, it should become its own named product/repo — that
is a scope expansion requiring explicit sign-off, not a silent workspace re-add
(guarded by `scripts/check-workspace-members.sh`).
