# Sprint Log

## Sprint 1: Rebuild Kanban and Backlog Frontend in React with Apple-class UI tokens
- Dismantled `App.tsx` monolith into React components.
- Enforced `move_card` logic requiring `completion_evidence`.
- Added Apple-class design system tokens.

## Sprint 2: Rebuild Agent Chat and Workflow UI
- Fixed `save_and_emit_message` to correctly assign roles in `agent_tool_controller.rs` so messages display properly in the UI.
- Extracted `AgentChat` component from `App.tsx`.
- Updated `CardDrawer` to beautifully display progress logs (comments) and system activity logs alongside acceptance criteria and evidence.
- Verified compilation and passing tests.
