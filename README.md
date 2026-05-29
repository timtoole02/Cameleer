# ✦ Cameleer ✦

> **A premium, safe, and blazing-fast autonomous local AI Agent platform written entirely in Rust.**

---

Cameleer is a next-generation, self-hosted autonomous AI agent workspace designed from the ground up for superior performance, strict safety controls, and local-first execution. It features a fully integrated, high-performance local GGUF inference engine (**`camelid`**) supporting native Apple Silicon Metal GPU acceleration out-of-the-box, packaged into a gorgeous, self-contained standalone macOS application (`Cameleer.app`). 

Connect your agents to standard cloud APIs (Anthropic, Gemini, OpenAI) or route them to your own locally-stored GGUF models concurrently with absolute data privacy—all managed under a strict, human-in-the-loop shell command sandbox.

---

## ⚡ Why Cameleer?

- **Integrated Local AI (via `camelid`)**: Direct, offline GGUF inference powered by a high-performance Rust-native backend. No API keys, no subscription plans, and 100% data privacy.
- **Native Metal GPU Acceleration**: Harnesses the full power of Apple Silicon out-of-the-box, implementing advanced Metal Q8 retained acceleration pathways for lightning-fast model responses.
- **Enterprise-Grade Safety Sandbox**: Rogue agent commands are a thing of the past. Cameleer features a strict command whitelist, blocks recursive deletes, and provides *Human-in-the-Loop* approval prompts (inline buttons on Telegram/Discord or interactive CLI confirm gates) before executing any shell commands.
- **Fully Self-Contained macOS App**: The production application (`Cameleer.app`) bundles the local `camelid` engine directly inside it. Just double-click the app from your Desktop, and the background inference starts up automatically.
- **SQLite Persistence**: Chat logs, key-value memory blocks, and comprehensive audit traces of every command executed are saved to an embedded, zero-configuration local SQLite database.
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
