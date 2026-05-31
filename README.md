# Cameleer

**Cameleer** is a local-first enterprise agent workspace powered by Camelid and compatible model backends.

## Features (v0.1)

- **Agent Directory:** Create, manage, and assign AI agents with specific roles and personas.
- **Kanban & Backlog:** Fully functional task tracking system with persistent state.
- **Workspace Chat:** Chat directly with your assigned agents or in a global channel.
- **Runtime & Audit:** View live agent run logs, pending tool approvals, and complete audit history.
- **Models:** Configure external providers (OpenAI-compatible) or manage local model artifacts.

## Development

Cameleer is a [Tauri](https://tauri.app/) application built with a React/TypeScript frontend and a Rust/SQLite backend.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- SQLite3

### Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Production Build

```bash
# Build the application
npm run tauri build
```

## Architecture

The system is strictly divided into domains. The frontend communicates with the Tauri backend exclusively via `invoke` commands wrapped in `src/api/`. State is managed by Zustand for UI layout, while all entity data (Cards, Agents, Runs) is fetched dynamically from the `local_state.db` SQLite database managed by Rust.

## License

MIT
