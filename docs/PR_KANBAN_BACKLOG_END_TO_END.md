# Kanban and Backlog End-to-End Acceptance

## Summary

This branch turns the Backlog to Kanban path into a validated product workflow. Backlog items can be refined with readiness fields, converted into persisted Kanban tasks, assigned to an agent/model, run through Camelid, reviewed with a work receipt, approved into Done, and found again after restart.

## Branch State

- Source branch: `fix/kanban-backlog-end-to-end`
- Accepted workflow head: `b9384db Connect backlog conversion workflow`
- Local handoff branch adds docs-only acceptance notes above `b9384db`
- Remote source branch `fix/kanban-backlog-end-to-end`: `b9384db`
- Remote integration branch `verify/p0-real-run`: `b1375ba`
- Main baseline: `origin/main` at `ce87188`

Remote branch tips were confirmed with `git ls-remote` on 2026-06-01 because the local `origin` fetch refspec tracks `main` only.

## Commits Included Since `origin/main`

- `d52c393` Add backlog refinement smoke checks
- `538dd2e` Add Cameleer integration gate smoke checks
- `4a137bd` Make backlog readiness meter live
- `819c38f` Guard backlog conversion for saved items
- `b1375ba` Document Cameleer integration gate proof
- `9cc32ab` Harden backlog conversion readiness
- `b9384db` Connect backlog conversion workflow

Docs-only handoff commits above the accepted workflow head:

- `1fab400` Document Kanban backlog acceptance handoff
- `2fea45e` Clarify Kanban backlog handoff branch state

## Product Acceptance Covered

- Backlog readiness uses the live form state and blocks incomplete conversion.
- Empty acceptance criteria no longer count as ready.
- Saved backlog items convert idempotently into Kanban tasks.
- Converted tasks preserve title, instructions, priority, type, criteria, and agent handoff context.
- Kanban task detail refreshes by persisted task id after actions.
- Agent run history remains visible for the selected task.
- Receipt-backed completion keeps Done blocked until an approved work receipt exists.

## Validation Evidence

The live acceptance pass on 2026-06-01 used the real Tauri app and macOS accessibility, not browser-only mocks:

- Created `Test backlog to Kanban flow`
- Converted it to `CAM-101`
- Assigned Software Engineer with Llama 3.2 1B
- Started work through Camelid
- Generated a draft work receipt
- Approved completion into Done
- Restarted the app and verified `CAM-101` remained in Done with receipt attached

Validation commands recorded for the accepted branch:

- `git diff --check`
- `cargo fmt --check`
- `CARGO_TARGET_DIR="/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-control-center-check" cargo check`
- `CARGO_TARGET_DIR="/Volumes/SSK Drive/OpenClaw/cargo-targets/cameleer-control-center-check" cargo test`
- `npm run typecheck`
- `npm run build`
- `npm run smoke:p0`
- `npm run smoke:backlog`
- `npm run smoke:kanban`
- `npm run tauri dev`

Native `screencapture` was blocked by the session display context, so the acceptance evidence is accessibility text plus persisted database verification.

## Remaining Risks

- `origin/verify/p0-real-run` is still behind this branch and needs an intentional update or PR merge.
- Internal disk remains tight compared with the requested release buffer, so keep build targets on SSK until more space is reclaimed.
- Existing Rust warning noise is not addressed by this branch.

## Handoff Checklist

- Open the PR from `fix/kanban-backlog-end-to-end` into `main`, or intentionally fast-forward/update `verify/p0-real-run` from this branch first.
- Keep the accepted workflow evidence anchored to `b9384db`; later docs-only commits only prepare the branch for review.
- Before merge, rerun the focused gate from `control-center`: `npm run smoke:p0`, `npm run smoke:backlog`, and `npm run smoke:kanban`.
- Use SSK-backed Cargo targets for any Rust revalidation while internal disk remains below the desired release buffer.
