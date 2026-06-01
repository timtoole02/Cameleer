# Stabilize Cameleer P0 App, Kanban, Backlog, and Bundled Camelid Runtime

## Summary

This branch is the integration gate for the Cameleer P0 app slice. It keeps feature work paused and adds focused merge-gate proof around the backlog refinement workflow, receipt-backed Kanban completion, and bundled Camelid runtime launch path.

## Commits Included

- `8ca9855` bundle Camelid runtime with Cameleer app
- `d66cfb5` add receipt-backed agent Kanban board
- `dd6406b` add backlog refinement workflow
- `f24fc68` merge origin/main to clear GitHub conflict state
- `d52c393` add backlog refinement smoke checks
- Current validation-gate commit adds focused backlog and Kanban receipt smoke scripts plus a migration-version test fix.

## Validation Commands Run

- `git status`
- `git diff --check`
- `cargo fmt --check`
- `CARGO_TARGET_DIR="/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-integration-gate" cargo check`
- `CARGO_TARGET_DIR="/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-integration-gate" cargo test`
- `npm install`
- `CARGO_TARGET_DIR="/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-integration-gate" npm run typecheck`
- `CARGO_TARGET_DIR="/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-integration-gate" npm run build`
- `npm run smoke:p0`
- `npm run smoke:backlog`
- `npm run smoke:kanban`
- `CARGO_TARGET_DIR="/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-integration-gate" npm run tauri dev`

## Manual App Verification

- `npm run tauri dev` launched Vite and the Tauri app process.
- Tauri logged core service startup successfully.
- The bundled runtime prep step produced `control-center/src-tauri/camelid`.
- The launched app spawned Camelid as:
  - `/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-integration-gate/debug/camelid serve --addr 127.0.0.1:8181 --metal-linear --metal-q8 --model /Users/timtoole/.cameleer/models/Llama-3.2-1B-Instruct-Q8_0.gguf`
- Camelid `/health` reported `loaded_now: true`, `generation_ready: true`, and active model `Llama 3.2 1B Instruct`.
- Camelid `/v1/models` returned `Llama 3.2 1B Instruct`.
- A direct `/v1/chat/completions` smoke request returned `OK.`
- The local app database contains the expected Kanban/backlog/receipt tables.

Desktop screenshot capture was not available from this headless validation session (`screencapture` could not create an image from the display), so UI proof is from automated smoke coverage, Tauri launch logs, process state, and runtime/API checks.

## Known Limitations

- Internal disk cleanup improved available space from about 1.1 GiB to about 7.6 GiB, but did not reach the requested 15-25 GiB target without moving or deleting higher-risk personal/source/model data.
- Rust builds pass with existing warning noise.
- The current validation session could not perform visual click-through screenshots from the native Tauri window.

## Disk Note

- Internal disk before cleanup: about 1.1 GiB free.
- Internal disk after cleanup and validation: about 7.6 GiB free.
- SSK Drive after validation: about 294 GiB free.
- Cargo validation used `/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-integration-gate`.

## Remaining Follow-up Slices

- Free a larger internal-disk buffer or move more rebuildable caches safely before release packaging.
- Do a human-visible native-window walkthrough with screenshots.
- Clean existing Rust warning noise in a dedicated cleanup slice.
