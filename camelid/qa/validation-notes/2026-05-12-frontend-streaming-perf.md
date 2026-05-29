# 2026-05-12 — Frontend streaming performance polish

Scope: Mac frontend responsiveness / WebUI streaming polish only. This does not add model parity, API readiness, RSS/timing, context, portability, production-throughput, or support-promotion evidence for any row.

Main-session change:
- `frontend/src/hooks/useDashboardData.js` no longer restarts the 2.5s dashboard polling interval whenever `localConversations`, `localMemories`, or `localModels` changes. `loadDashboard()` reads those mutable local values through refs, so streamed token updates do not retrigger the polling effect or force interval churn.
- Live assistant streaming patches are now coalesced through `requestAnimationFrame` instead of applying a React conversation-state update for every delta chunk.
- Immediate state transitions remain immediate for the important milestones: opening/preparing, first bytes/role events, and generating-state transitions.

Reported local validation from the main-session frontend pass:
- `npm run build`
- `npm run smoke:streaming`
- `npm run smoke:model-state`
- `npm run smoke:ui`

TPM coordination / remaining frontend-perf lanes:
- Measure render frequency in `ChatWorkspace` during live assistant streaming; the next pass should separate message-row/markdown work from whole-workspace rerenders.
- Audit unnecessary non-chat rerenders while a chat stream is active, especially app-shell/dashboard consumers that should not repaint on token cadence.
- Capture true TTFT/decode measurements on a scrubbed local validation lane before turning this polish into any broader performance claim.

Claim boundary:
- This is a UI hot-path quick win and coordination note only.
- It does not promote production throughput, portability, or any model/support row.
