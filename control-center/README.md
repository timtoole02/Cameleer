# Cameleer Control Center

**Cameleer Control Center** is the frontend UI for the Cameleer workspace. It is built using React, TypeScript, and Vite, packaged natively with Tauri.

## What this app is
This app serves as the command UI for local agentic workflows. It communicates with the Rust backend via Tauri `invoke` commands wrapped securely in the `src/api/` folder. It displays chats, kanban boards, active agents, and backend logs.

## How to run in dev
```bash
npm install
npm run tauri dev
```
This will compile the Rust backend, launch a local Vite dev server, and open the native window.

## How backend health works
On startup, `src/App.tsx` calls `getBackendHealth()` (bound to `get_backend_health` in Rust). 
- If the Rust backend connects and the SQLite database is ready, the app renders normally and sets the top-right badge to **Connected**.
- If the database is missing or migrations fail, the app renders the **Recovery Panel** detailing the exact degraded state.

## How to build
```bash
npm run tauri build
```
Note: Ensure you are not building inside an external drive that generates macOS `._*` extended attribute files, or set `export COPYFILE_DISABLE=1` / use a custom `CARGO_TARGET_DIR`.

## Current P0 limitations
- Agent Chat may not trigger replies if no valid local LLM is loaded.
- Kanban drag-and-drop state is persisted but requires a backend reload context refresh.

## Troubleshooting
If you encounter `Backend: offline`:
1. Check `npm run smoke:p0` to verify required files exist.
2. Open Dev Tools inside the Tauri window and review the Console for `invoke` errors.
3. If Tauri complains about `stream did not contain valid UTF-8`, run `find . -name "._*" -delete` to purge macOS AppleDouble metadata files.
