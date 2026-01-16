# Obsidian Executable Runbook Plugin – Design Document

## 1. Overview

This project aims to build an Obsidian plugin that enables **line-by-line and selection-based execution of code blocks directly from Markdown notes**, targeting DevOps engineers, SREs, and power users who use Obsidian as a runbook and operational notebook.

The core workflow is **debugging and executing large code blocks incrementally**, similar to a debugger or REPL-driven workflow, but inside Obsidian and backed by a real terminal session.

---

## 2. Problem Statement

Current Obsidian limitations:
- Code blocks are static documentation only
- No execution or feedback loop
- Constant context switching between Obsidian and terminal
- No stateful execution for debugging scripts line by line

This breaks flow during:
- Incident response
- Infra debugging
- Script development inside runbooks

---

## 3. Goals & Non-Goals

### Goals
- Execute **current line or selected lines** via hotkey
- Execute entire code block via **▶ Execute** button
- Send commands to a **persistent terminal session**
- Preserve shell state (`cd`, `export`, variables)
- Capture output and render **inline under blocks**
- Minimal friction: fast, explicit, predictable
- Safe by default (local-only execution)
- **Desktop-only support** (explicitly)

### Non-Goals (v1)
- Mobile support (Obsidian iOS/Android)
- Cloud execution
- Remote SSH execution
- Jupyter-style kernels
- Multi-user collaboration
- Automatic execution without user action

---

## 4. Target Users

- DevOps / SREs writing runbooks
- Infra engineers debugging scripts
- Indie hackers managing servers locally
- Advanced Obsidian users with terminal-heavy workflows

---

## 5. Core User Experience

### A) Line-by-Line / Selection Execution (Primary)
Hotkey: `Cmd/Ctrl + Enter`

Behavior:
1. If text is selected → execute selection
2. Else → execute current cursor line
3. Send text to **existing terminal session**
4. Append newline (Enter)
5. Optionally auto-advance cursor to next line

Constraints:
- Execution only allowed inside fenced code blocks
- Supported languages are explicitly allowlisted

### B) Execute Entire Code Block + Inline Output (Required)

Each runnable fenced code block should render an **Execute (▶)** button in preview/reading mode.

Behavior:
1. User clicks ▶ Execute on a code block
2. Plugin sends the entire code block text to the execution backend
3. Output is captured and rendered **directly under the code block** as a read-only "Output" section
4. Output section includes:
   - timestamp
   - exit code (or success indicator)
   - copy-to-clipboard
   - clear output

Output rendering rules:
- Preserve formatting (monospace)
- Support large output via collapsible container
- Default to showing last N KB with "Show more" if output is huge

---

## 6. Execution Model

### Terminal Bridge (Persistent Session)

The plugin does **not** execute code itself. Instead, it forwards code to a persistent shell session.

Two components:
1. **Obsidian Plugin (UI + Editor Integration)**
2. **Local Execution Agent (PTY Owner)**

---

## 7. Architecture

### Desktop-Only Architecture (Explicit Constraint)

This plugin is **Desktop-only**. Mobile Obsidian (iOS / Android) is **not supported** due to:
- No Node.js `child_process` access
- No PTY / local process spawning
- No safe local agent model

The plugin must detect runtime environment and **hard-disable itself on mobile** with a clear message.

### High-Level Diagram

Obsidian Desktop Plugin
→ spawns local Agent (child_process)
→ communicates over localhost (WebSocket)
→ Agent owns PTY-backed shell
→ Shell executes commands and returns output

---

## 8. Obsidian Plugin Responsibilities

### Editor Integration
- Use CodeMirror 6 APIs
- Detect:
  - Current cursor line
  - Active selection
  - Code block boundaries
  - Language of code fence

### Commands
- `Run current line / selection`
- (Future) `Run logical block`

### UX
- Hotkey-triggered execution
- Toast on invalid context (not in code block)
- Optional cursor auto-advance

---

## 9. Local Execution Agent

### Startup Model (Option 1 – Plugin-Managed)

- On Obsidian startup, plugin checks agent health on `localhost`
- If agent is not running and auto-start is enabled:
  - Plugin spawns agent via `child_process.spawn`
  - Stores PID and monitors process
- On Obsidian shutdown:
  - Plugin attempts graceful agent shutdown

Auto-start is **configurable** and can be disabled by the user.

### Responsibilities
- Maintain persistent shell session(s)
- Receive execution payloads via localhost
- Write to PTY stdin
- Capture stdout/stderr
- Return execution results to the plugin (for inline output)

### Execution Modes
- Fire-and-return (v1)
- Streaming (optional, v2)

### Implementation Options
- Go (recommended for PTY + cross-platform)
- Rust (alternative)

### Communication
- WebSocket (bidirectional)
- Localhost only
- No auth (v1)

## 10. Language Support (v1)

| Language | Mode |
|--------|------|
| bash | persistent shell |
| sh | persistent shell |
| python | shell-based REPL |

Language is inferred from fenced code block.

---

## 11. Safety & Guardrails

### Default Safety
- Local-only execution
- Explicit user action only
- No background or auto-run

### Optional Safeguards
- Command allowlist / denylist
- Regex warning prompts (e.g. `rm -rf`, `terraform apply`)
- Dry-run preview mode

---

## 12. Edge Cases & Decisions

### Multiline Constructs
- v1: execute exactly what is sent
- No attempt to auto-expand blocks

### Prompts in Docs
- Optional stripping of leading `$ ` or `> `

### Cursor Movement
- Optional auto-advance to next line start

---

## 13. Configuration

### Global Settings
- Agent URL/port (default `127.0.0.1:27123`)
- **Auto-start agent** (on/off)
- Agent binary path (auto-discovered + override)
- Default terminal session name
- Auto-advance cursor (on/off)
- Strip prompts (on/off)
- Safety toggles (warn patterns, allowlisted dirs)

### Per-Note Overrides (Frontmatter)
```yaml
terminalSession: ops-debug
```

---

## 14. Extensibility (Future)

- Runbook Mode (step tracking)
- Output capture inline
- Session switching
- SSH-backed execution
- CI / container runners

---

## 15. MVP Scope Summary

Included:
- Hotkey execution (line/selection)
- Execute button for code blocks
- Run entire block and render output under block
- Persistent terminal session
- Local-only execution

Excluded (v1):
- Remote execution (SSH, cloud)
- Cloud agents
- Live streaming output (optional v2)
- Smart logical-block inference

## 16. Risks

- **Desktop-only limitation** (mobile users cannot use this)
- Agent auto-start brittleness (paths, permissions, Gatekeeper/AV)
- Cross-platform PTY differences
- Security perception

Mitigation: explicit scope (desktop-only), local-only, opt-in auto-start, clear errors + fallback manual start instructions.

---

## 17. Success Criteria

- Can debug large scripts line-by-line without leaving Obsidian
- Zero unexpected executions
- Feels as fast as using a terminal directly

---

## 18. Open Questions

- Agent packaging strategy
- Session persistence across Obsidian restarts
- Output streaming vs fire-and-forget

---

**Status:** Draft v1
