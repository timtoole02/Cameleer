# Cameleer

**Cameleer** is a local-first enterprise agent workspace powered by Camelid and compatible model backends.

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
* This repository has completed the **P0 Stabilization Gate**. 
* UI is verified readable and strictly adheres to CSS variables.
* Legacy repair scripts are quarantined to `tools/legacy-repair/`.
* The Rust backend commands are actively wired and healthy.

## License

MIT
