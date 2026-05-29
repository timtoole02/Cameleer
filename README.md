# ✦ Cameleer ✦

> **A premium, safe, and blazing-fast autonomous AI Agent platform written entirely in Rust.**

---

Cameleer is a next-generation, self-hosted AI agent gateway designed from the ground up and engineered for superior performance, strict safety controls, and native single-binary convenience. It connects your personal messaging environments (like Telegram, Discord, and a local interactive console) to modern LLMs (Anthropic, Gemini, OpenAI, and local Ollama) and executes autonomous "skills" represented by standardized Markdown files (`SKILL.md`).

---

## ⚡ Why Cameleer?

- **Blazing Performance**: Built on top of Rust's async I/O engine (`tokio`), Cameleer runs with an incredibly low memory footprint (less than 15MB at idle!), making it ideal for cheap VPS instances, home servers, or Raspberry Pis.
- **Enterprise-Grade Safety Sandbox**: Rogue agent commands are a thing of the past. Cameleer features a strict command whitelist, blocks recursive deletes, and provides *Human-in-the-Loop* approval prompts (inline buttons on Telegram/Discord or interactive CLI confirm gates) before executing any shell commands.
- **SQLite Persistence**: Chat logs, key-value memory blocks, and comprehensive audit traces of every command executed are saved to an embedded, zero-configuration local SQLite database.
- **Single Binary Convenience**: Compiles into a single, dependency-free executable. There is no Node.js runtime, no `node_modules` hell, and no complex docker setups required. Just download and run.
- **Multi-Channel Concurrency**: Handles multiple gateway integrations in parallel. Control your agent from a beautiful local interactive shell or message it on-the-go from Telegram or Discord.

---

## 🚀 Quick Start

### 1. Build and Compile
Ensure you have the Rust toolchain installed:
```bash
cargo build --release
```

### 2. Onboard and Initialize
Run the onboarding sequence to automatically generate configuration templates, database schemas, and default skills:
```bash
cargo run onboard
```

### 3. Run the Interactive CLI Console
Launch the agent directly. By default, it drops you into our gorgeous colored interactive shell:
```bash
cargo run
```

---

## ⚙️ Configuration

Your settings are stored in TOML format at `~/.cameleer/config.toml`. You can configure:
- **LLM Provider**: Swap between `ollama` (default local models), `anthropic`, `openai`, or `gemini`.
- **Security Whitelist**: Explicitly control the set of binaries (e.g., `["ls", "pwd", "cat", "curl", "grep"]`) the agent is authorized to use.
- **Command Approvals**: Toggle `require_approval = true` to force manual confirmations before any mutating operations.
- **Gateways (Console, Telegram, Discord)**: Enable bots, enter tokens, and restrict authorization strictly to specific channels or your personal user accounts.

For complete step-by-step setup guides, check out [walkthrough.md](walkthrough.md).

---

## 📂 Writing Skills

Skills are portable markdown playbooks stored under `~/.cameleer/skills/`. To write a skill, simply create a folder with a `SKILL.md` inside:

```markdown
---
name: weather-check
description: Fetches current weather information for a specified city using wttr.in.
---

# Weather Check Playbook
Use this skill when the user asks for the weather forecast or temperature.

## Workflow
1. Identify the city name from the user's message.
2. Execute the shell command:
   `curl "wttr.in/YOUR_CITY?format=3"` (Replace YOUR_CITY with the target city).
3. Report the exact output of curl directly to the user.
```

Cameleer parses the YAML frontmatter and dynamically registers it into the agent's reasoning cycle on startup!

---

## 🛡️ License
Cameleer is released under the MIT License.
