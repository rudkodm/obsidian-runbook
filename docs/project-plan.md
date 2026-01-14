# Obsidian Executable Runbook – Project Plan

This document outlines the implementation phases and tasks for the MVP.

---

## Architecture Decision: Pending Validation

Before committing to an architecture, we need to validate what's possible within Obsidian's plugin environment.

### Two Possible Architectures

**Option A: Plugin-Only (Preferred if feasible)**
- Single TypeScript codebase
- Use Node.js `child_process` or `node-pty` directly from plugin
- No separate binary to bundle/distribute
- Similar to how VS Code's terminal works

**Option B: Plugin + External Agent (Fallback)**
- Plugin (TypeScript) + Agent (Go/Rust)
- WebSocket communication between them
- Requires bundling binaries per platform

**Phase 0 will determine which architecture we use.**

---

## Phase 0: Architecture Validation (Hello World)

> **Goal:** Build a minimal proof-of-concept plugin to validate Node.js API access before committing to an architecture.

### 0.1 Minimal Plugin Setup
- [ ] Create bare-bones Obsidian plugin structure
- [ ] Verify plugin loads in Obsidian Desktop
- [ ] Add desktop-only check (detect and warn on mobile)

### 0.2 Test Node.js API Access
- [ ] Test `require('child_process')` availability
- [ ] Test `child_process.spawn()` to run a simple command (`echo hello`)
- [ ] Capture stdout and display in Notice/modal
- [ ] Document any restrictions or errors

### 0.3 Test PTY Access (node-pty)
- [ ] Attempt to use `node-pty` native module
- [ ] Document if native modules work or fail
- [ ] If fails, document the error (e.g., Electron version mismatch, sandboxing)

### 0.4 Test Persistent Shell Session
- [ ] Spawn a shell process (`bash` or `sh`)
- [ ] Send multiple commands sequentially
- [ ] Verify state persists (e.g., `export FOO=bar` then `echo $FOO`)
- [ ] Capture and display output

### 0.5 Architecture Decision
- [ ] Document findings in `docs/architecture-decision.md`
- [ ] Choose Option A (plugin-only) or Option B (plugin + agent)
- [ ] Update this plan accordingly

### Validation Success Criteria

| Test | Pass Condition |
|------|----------------|
| child_process.spawn | Can execute `echo hello` and capture output |
| Persistent shell | Can run `export X=1` then `echo $X` returns `1` |
| node-pty (optional) | Either works, or we document the fallback |

---

## Phase 1: Project Scaffolding

*Scope depends on Phase 0 outcome.*

### 1.1 Plugin Setup
- [ ] Initialize plugin structure with TypeScript
- [ ] Configure esbuild for bundling
- [ ] Create manifest.json with plugin metadata
- [ ] Set up development workflow (hot reload)
- [ ] Add desktop-only runtime check (disable on mobile)

### 1.2 Execution Backend Setup

**If Option A (plugin-only):**
- [ ] Create shell session manager module
- [ ] Wrap child_process or node-pty in clean API

**If Option B (plugin + agent):**
- [ ] Initialize Go/Rust module
- [ ] Set up project structure
- [ ] Configure cross-platform build scripts

---

## Phase 2: Core Execution Layer

### If Option A: Direct Shell Execution
- [ ] Create `ShellSession` class
- [ ] Implement `spawn()` to start shell
- [ ] Implement `execute(command)` to send commands
- [ ] Implement output capture with event emitter
- [ ] Handle shell exit and restart

### If Option B: WebSocket Communication
- [ ] Define message protocol (JSON schema)
- [ ] Implement WebSocket server in agent
- [ ] Implement WebSocket client in plugin
- [ ] Add connection status tracking
- [ ] Create status bar indicator

---

## Phase 3: PTY & Shell Session Management

### 3.1 Shell Session Implementation
- [ ] Spawn default shell (bash/zsh based on env)
- [ ] Handle stdin write (command execution)
- [ ] Capture stdout/stderr
- [ ] Implement output buffering with size limits

### 3.2 Session Lifecycle
- [ ] Support single persistent session (v1)
- [ ] Track session state (alive, shell type)
- [ ] Handle shell exit and restart
- [ ] Clean up on plugin unload

---

## Phase 4: Plugin Editor Integration

### 4.1 CodeMirror 6 Integration
- [ ] Detect cursor position within code blocks
- [ ] Detect code block boundaries (start/end lines)
- [ ] Extract language from fenced code block
- [ ] Get current line text
- [ ] Get selected text

### 4.2 Language Allowlist
- [ ] Define supported languages (bash, sh, python)
- [ ] Validate language before execution
- [ ] Show error toast for unsupported languages

### 4.3 Execute Line/Selection Command
- [ ] Register `runbook:execute-line-or-selection` command
- [ ] Bind default hotkey (Cmd/Ctrl + Enter)
- [ ] Extract text to execute (selection or current line)
- [ ] Send to shell session
- [ ] Show toast on success/error

### 4.4 Cursor Auto-Advance (Optional)
- [ ] Add setting for auto-advance
- [ ] Move cursor to next line after execution
- [ ] Skip empty lines option

---

## Phase 5: Execute Block & Inline Output

### 5.1 Code Block Decoration (Reading View)
- [ ] Create CodeMirror ViewPlugin for code blocks
- [ ] Render Execute (▶) button on supported code blocks
- [ ] Style button appropriately

### 5.2 Execute Entire Block
- [ ] Extract full code block content on button click
- [ ] Send to shell session for execution
- [ ] Track execution state (pending, running, complete)

### 5.3 Inline Output Rendering
- [ ] Capture command output
- [ ] Render output container below code block
- [ ] Display timestamp and exit code
- [ ] Add copy-to-clipboard button
- [ ] Add clear output button
- [ ] Handle large output (collapsible, show last N lines)

---

## Phase 6: Session Lifecycle Management

### If Option A (plugin-only):
- [ ] Start shell session on plugin load
- [ ] Graceful shutdown on plugin unload
- [ ] Handle shell crashes and restart

### If Option B (plugin + agent):
- [ ] Detect agent binary path
- [ ] Spawn agent via child_process on plugin load
- [ ] Monitor agent health
- [ ] Graceful shutdown on Obsidian close
- [ ] Manual start fallback with instructions

---

## Phase 7: Settings & Configuration

### 7.1 Plugin Settings Tab
- [ ] Default shell override
- [ ] Auto-advance cursor toggle
- [ ] Strip prompt prefixes toggle ($ and >)
- [ ] Dangerous command patterns (warn before execute)

**If Option B, also:**
- [ ] Agent URL/port configuration
- [ ] Auto-start agent toggle
- [ ] Agent binary path override

### 7.2 Frontmatter Support
- [ ] Parse note frontmatter for overrides
- [ ] Support `terminalSession` property (future use)

---

## Phase 8: Safety & UX Polish

### 8.1 Dangerous Command Warnings
- [ ] Define regex patterns for dangerous commands
- [ ] Show confirmation modal before execution
- [ ] Add setting to disable warnings

### 8.2 Error Handling & Feedback
- [ ] Show toast notifications for errors
- [ ] Display connection/session status clearly
- [ ] Handle timeout scenarios
- [ ] Provide clear error messages

### 8.3 UI Polish
- [ ] Consistent styling with Obsidian themes
- [ ] Loading states during execution
- [ ] Keyboard accessibility

---

## Phase 9: Testing & Documentation

### 9.1 Testing
- [ ] Unit tests for plugin utilities
- [ ] Unit tests for shell session management
- [ ] Integration tests for command execution
- [ ] Manual test checklist for all platforms

### 9.2 Documentation
- [ ] User guide (README.md)
- [ ] Installation instructions
- [ ] Configuration reference
- [ ] Troubleshooting guide

---

## Phase 10: Packaging & Distribution

### 10.1 Plugin Packaging
- [ ] Create release workflow (GitHub Actions)
- [ ] Generate plugin zip for manual install

**If Option B, also:**
- [ ] Bundle agent binaries for each platform
- [ ] Or: implement download-on-first-run

### 10.2 Community Release
- [ ] Submit to Obsidian community plugins
- [ ] Create demo video/GIF

---

## Implementation Order

```
Phase 0 (Validation)
    │
    ├── Success: Option A ──→ Simpler path, plugin-only
    │
    └── Fallback: Option B ──→ Plugin + Agent

Then: Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
```

**Start with Phase 0.** Do not proceed until architecture is validated.

---

## Tech Stack Summary

| Component | Option A | Option B |
|-----------|----------|----------|
| Plugin | TypeScript, Obsidian API, CodeMirror 6 | Same |
| Execution | child_process / node-pty | Go/Rust agent |
| Communication | Direct function calls | WebSocket |
| Distribution | Plugin only | Plugin + platform binaries |

---

## File Structure

### Option A (Plugin-Only)
```
obsidian-runbook/
├── docs/
│   ├── design.md
│   ├── project-plan.md
│   └── architecture-decision.md
├── src/
│   ├── main.ts
│   ├── settings.ts
│   ├── shell/
│   │   └── session.ts
│   ├── editor/
│   │   ├── code-block-detector.ts
│   │   └── execute-decoration.ts
│   └── types.ts
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

### Option B (Plugin + Agent)
```
obsidian-runbook/
├── docs/
├── plugin/
│   ├── src/
│   │   ├── main.ts
│   │   ├── websocket-client.ts
│   │   └── ...
│   └── ...
├── agent/
│   ├── cmd/agent/main.go
│   ├── internal/
│   └── ...
└── README.md
```

---

**Status:** Phase 0 – Validation pending
