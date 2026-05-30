# ✦ Cameleer ✦

> **Cameleer is an enterprise agentic AI workspace powered by Camelid.**

---

**Camelid** remains the underlying local GGUF inference engine.
**Cameleer** becomes the enterprise agent operating system, providing agents, tasks, memory, orchestration, and enterprise workflow.

## ⚡ What is Cameleer?

Instead of just chatting with a single AI, Cameleer acts as your command center to coordinate a nested hierarchy of specialized AI Agents. 

Use this mental model:
```
Cameleer
  ├── Agent Workspace
  ├── Agent Registry
  ├── Agent Runtime Loop
  ├── Kanban / Backlog
  ├── Shared Memory
  ├── Project Context
  ├── Tool Router
  ├── Model Router
  └── Camelid Runtime Adapter
        └── /v1/chat/completions
```

- **Kanban Board**: Drag and drop tasks across Backlog, Ready, In Progress, Review, Blocked, and Done.
- **Nested Agent Org Chart**: Assign child agents to parent agents for massive task delegation.
- **Shared Memory**: Global, project, and agent-scoped memory retrieval across the entire system.
- **Tool Router**: Strict schemas allowing agents to interact with files, tasks, and memory.
- **Local Inference Engine (`Camelid`)**: The powerful, background inference runner powering the intelligence.

---

## 🍏 macOS Installation Guide

### 1. Prerequisites
- **Rust**:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **Node.js**:
  ```bash
  brew install node
  ```

### 2. Compile and Run
```bash
git clone https://github.com/timtoole02/Cameleer.git
cd Cameleer/control-center
npm install
CARGO_TARGET_DIR="target" npm run tauri build
```
Once packaged, deploy the `Cameleer.app` bundle and launch the Enterprise Agent Workspace!

---

## 🛡️ License
Cameleer is released under the MIT License.
