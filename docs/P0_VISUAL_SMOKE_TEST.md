# P0 Visual Smoke Test

## Launch Command
```bash
cd control-center
npm run tauri dev
```

## Expected Results

### Sidebar
- Must render dark background (`#07111d`) with highly visible light text.
- Must display 'Cameleer' branding.
- Navigation items (Chat, Kanban, Backlog, etc.) must be legible and properly highlighted when active.

### Header
- Must render with readable text.
- Project and Agent selections must be displayed prominently.
- Backend status badge must exist and render a readable contrast (e.g. green for connected, red for offline).

### Backend Badge
- Starts as `checking`.
- Resolves to `connected` (green), `degraded` (yellow), or `offline` (red).
- Must NEVER stay `unknown`.

### Chat Empty State
- If no messages exist, a distinct `<EmptyState />` component must be shown.
- Empty state must display the current active Project, Agent, Backend, and Model.
- Send button must be clearly disabled if the backend is offline or dependencies (agent/project) are missing.
- Send button input placeholder must explain why it is disabled.

### Offline Behavior
- If backend is truly offline/failing, the app must intercept the startup route and render `<RecoveryPanel />`.
- It must clearly state why it is offline, provide diagnostics, and offer a retry button.

## Verification Checklist
- [x] Sidebar text is readable
- [x] Header text is readable
- [x] Page title is readable
- [x] Backend badge is readable
- [x] Chat empty state is readable
- [x] Send button state is understandable
- [x] Navigation works
- [x] Backend status does not stay unknown
- [x] No page renders a blank white rectangle
