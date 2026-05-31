# Frontend Architecture

## Overview
The Cameleer frontend has been completely restructured to eliminate the legacy monolithic `App.tsx` and move towards a domain-driven, maintainable React application.

## Directory Structure
- `src/api/`: Typed API wrappers for Tauri invokes (e.g., `agents.ts`, `chat.ts`).
- `src/components/`: Reusable React components.
  - `layout/`: Global layout structures (`Sidebar.tsx`, `TopNav.tsx`, `WorkspaceArea.tsx`).
  - `common/`: Reusable UI states (`LoadingSpinner`, `ErrorBanner`, `EmptyState`).
  - `*/`: Quarantined or legacy domain components.
- `src/pages/`: Top-level page assemblies that route via state (`ChatPage.tsx`, `KanbanPage.tsx`, etc.).
- `src/state/`: Centralized Zustand state management (`appStore.ts`).
- `src/types/`: Domain models aligned perfectly with Rust backend structs (`agent.ts`, `kanban.ts`, etc.).
- `src/tests/`: Vitest configuration and DOM rendering tests.

## API Contracts
All interaction with the local SQLite backend must flow through `src/api/*`.
Components should *never* invoke Tauri commands directly.
Instead, components handle the loading, error, and empty states gracefully, leaving the data fetching entirely to the structured API layer.

## State Management
Zustand is employed via `useAppStore` strictly for high-level UI routing (e.g., `activeTab`, `backendHealth`) rather than storing all relational entity data, which should be freshly fetched from the backend.
