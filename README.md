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

- **Kanban Board**: Drag and drop tasks across Backlog, Ready, In Progress, Review, Blocked, and Done. Enforces strict cryptographic execution receipts and task dependency mapping.
- **Nested Agent Org Chart**: Assign child agents to parent agents for massive task delegation.
- **Shared Memory**: Global, project, and agent-scoped memory retrieval across the entire system.
- **Tool Execution Sandbox**: Strict schemas allow agents to interact with files, tasks, and memory. The execution sandbox traps unsafe terminal commands (like `rm -rf`) and routes them to human approval. Path traversals outside the designated workspace are physically blocked.
- **Local Inference Engine (`Camelid`)**: The powerful, background inference daemon executing local, offline `.gguf` models on Apple Silicon Metal.

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
We provide an automated package script that handles testing, building, and assembling the Mac `.app` bundle:
```bash
git clone https://github.com/timtoole02/Cameleer.git
cd Cameleer
./package.sh
```
Once packaged, deploy the `Cameleer.app` bundle from `control-center/src-tauri/target/release/bundle/mac/` into your `/Applications` folder and launch the Enterprise Agent Workspace!

---

## 🛡️ License
Cameleer is released under the MIT License.
