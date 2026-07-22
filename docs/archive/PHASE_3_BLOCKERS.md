# Phase 3 Blockers

The following API calls do not currently exist in the Rust backend (`src-tauri/src/lib.rs`), blocking complete frontend integration:

1. **Memory Domain**:
   - `get_memories`
   - `create_memory`
   *Status*: Stubbed in `src/api/memory.ts`.

2. **Full Workspace Configuration**:
   - `get_workspace_details`
   *Status*: Implicitly loaded via `get_backend_status` or fallback strings.

These are explicitly documented for the upcoming phases to resolve.
