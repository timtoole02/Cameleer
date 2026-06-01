# Stabilize Cameleer P0 App, Kanban, Backlog, and Bundled Camelid Runtime

## Summary

This branch is the integration gate for the Cameleer P0 app slice. It keeps feature work paused and adds focused merge-gate proof around the backlog refinement workflow, receipt-backed Kanban completion, and bundled Camelid runtime launch path.

## Commits Included

- `8ca9855` bundle Camelid runtime with Cameleer app
- `d66cfb5` add receipt-backed agent Kanban board
- `dd6406b` add backlog refinement workflow
- `f24fc68` merge origin/main to clear GitHub conflict state
- `d52c393` add backlog refinement smoke checks
- `538dd2e` add Cameleer integration gate smoke checks
- `4a137bd` make backlog readiness meter live
- `819c38f` guard backlog conversion for saved items
- Current validation-gate commit aligns P0 smoke coverage with the saved-item conversion guard and documents visual proof.

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
- Headless visual walkthrough screenshots were captured locally from the actual React pages with mocked Tauri calls:
  - `/Users/timtoole/.openclaw/workspace/tmp/cameleer-gate/visual-chat.png`
  - `/Users/timtoole/.openclaw/workspace/tmp/cameleer-gate/visual-kanban.png`
  - `/Users/timtoole/.openclaw/workspace/tmp/cameleer-gate/visual-kanban-detail.png`
  - `/Users/timtoole/.openclaw/workspace/tmp/cameleer-gate/visual-kanban-receipt.png`
  - `/Users/timtoole/.openclaw/workspace/tmp/cameleer-gate/visual-backlog.png`
  - `/Users/timtoole/.openclaw/workspace/tmp/cameleer-gate/visual-settings.png`

Native desktop screenshot capture was not available from this validation session (`screencapture` could not create an image from the display), so native-runtime proof is from Tauri launch logs, process state, and runtime/API checks. Visual proof is from the React page walkthrough screenshots above.

## Known Limitations

- Internal disk cleanup improved available space from about 1.1 GiB to about 8.7 GiB, but did not reach the requested 15-25 GiB target without moving or deleting higher-risk personal/source/model data.
- Rust builds pass with existing warning noise.
- Native Tauri window screenshot capture remained blocked by the session display context; visual screenshots were captured via a headless React page walkthrough instead.

## Disk Note

- Internal disk before cleanup: about 1.1 GiB free.
- Internal disk after cleanup and validation: about 8.7 GiB free.
- SSK Drive after validation: about 292 GiB free.
- Cargo validation used `/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-integration-gate`.

## Remaining Follow-up Slices

- Free a larger internal-disk buffer or move more rebuildable caches safely before release packaging.
- Do a human-visible native-window walkthrough with screenshots.
- Clean existing Rust warning noise in a dedicated cleanup slice.
