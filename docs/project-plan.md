# Obsidian Executable Runbook – Project Plan

This document outlines the implementation phases and tasks for the MVP.

---

## Architecture Overview

The project consists of two main components:

1. **Obsidian Plugin** (TypeScript) – UI, editor integration, WebSocket client
2. **Execution Agent** (Go) – PTY management, WebSocket server, command execution

---

## Phase 1: Project Scaffolding

### 1.1 Obsidian Plugin Setup
- [ ] Initialize plugin structure with TypeScript
- [ ] Configure esbuild for bundling
- [ ] Create manifest.json with plugin metadata
- [ ] Set up development workflow (hot reload)
- [ ] Add desktop-only runtime check (disable on mobile)

### 1.2 Execution Agent Setup
- [ ] Initialize Go module
- [ ] Set up project structure (cmd/, internal/)
- [ ] Configure build scripts for cross-platform (macOS, Linux, Windows)
- [ ] Add basic CLI argument parsing

---

## Phase 2: Core Communication Layer

### 2.1 WebSocket Protocol Design
- [ ] Define message types (execute, output, health, etc.)
- [ ] Define request/response JSON schema
- [ ] Document protocol in docs/protocol.md

### 2.2 Agent WebSocket Server
- [ ] Implement WebSocket server on localhost:27123
- [ ] Add health check endpoint
- [ ] Handle connection lifecycle (connect, disconnect, reconnect)
- [ ] Add graceful shutdown handling

### 2.3 Plugin WebSocket Client
- [ ] Implement WebSocket client with auto-reconnect
- [ ] Add connection status tracking
- [ ] Create status bar indicator (connected/disconnected)
- [ ] Handle connection errors gracefully

---

## Phase 3: PTY & Shell Session Management

### 3.1 PTY Implementation (Agent)
- [ ] Create PTY wrapper using creack/pty (Go)
- [ ] Spawn default shell (bash/zsh based on env)
- [ ] Handle stdin write (command execution)
- [ ] Capture stdout/stderr
- [ ] Implement output buffering with size limits

### 3.2 Session Management
- [ ] Support single persistent session (v1)
- [ ] Track session state (alive, shell type)
- [ ] Handle shell exit and restart
- [ ] Clean up PTY on agent shutdown

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
- [ ] Send to agent via WebSocket
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
- [ ] Send to agent for execution
- [ ] Track execution state (pending, running, complete)

### 5.3 Inline Output Rendering
- [ ] Capture command output from agent
- [ ] Render output container below code block
- [ ] Display timestamp and exit code
- [ ] Add copy-to-clipboard button
- [ ] Add clear output button
- [ ] Handle large output (collapsible, show last N lines)

---

## Phase 6: Agent Lifecycle Management

### 6.1 Agent Auto-Start
- [ ] Detect agent binary path (bundled or configured)
- [ ] Spawn agent via child_process on plugin load
- [ ] Store PID for tracking
- [ ] Monitor agent process health

### 6.2 Agent Shutdown
- [ ] Send shutdown signal on Obsidian close
- [ ] Handle graceful vs forced termination
- [ ] Clean up zombie processes

### 6.3 Manual Start Fallback
- [ ] Detect when auto-start fails
- [ ] Show instructions for manual agent start
- [ ] Provide command in settings panel

---

## Phase 7: Settings & Configuration

### 7.1 Plugin Settings Tab
- [ ] Agent URL/port configuration
- [ ] Auto-start agent toggle
- [ ] Agent binary path override
- [ ] Auto-advance cursor toggle
- [ ] Strip prompt prefixes toggle ($ and >)

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
- [ ] Display connection status clearly
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
- [ ] Unit tests for agent core logic
- [ ] Integration tests for WebSocket communication
- [ ] Manual test checklist for all platforms

### 9.2 Documentation
- [ ] User guide (README.md)
- [ ] Installation instructions
- [ ] Configuration reference
- [ ] Troubleshooting guide

---

## Phase 10: Packaging & Distribution

### 10.1 Plugin Packaging
- [ ] Bundle agent binaries for each platform
- [ ] Create release workflow (GitHub Actions)
- [ ] Generate plugin zip for manual install

### 10.2 Community Release
- [ ] Submit to Obsidian community plugins
- [ ] Create demo video/GIF

---

## Suggested Implementation Order

For efficient development, implement in this order:

1. **Phase 1** – Get both projects compiling
2. **Phase 2** – Establish communication (WebSocket)
3. **Phase 3** – PTY working in agent
4. **Phase 4.1-4.3** – Basic line execution
5. **Phase 5** – Block execution with output
6. **Phase 6** – Agent lifecycle
7. **Phase 7** – Settings UI
8. **Phase 8** – Safety and polish
9. **Phase 9-10** – Testing and release

---

## Tech Stack Summary

| Component | Technology |
|-----------|------------|
| Plugin | TypeScript, Obsidian API, CodeMirror 6 |
| Agent | Go, creack/pty, gorilla/websocket |
| Build | esbuild (plugin), Go toolchain (agent) |
| Communication | WebSocket over localhost |

---

## File Structure (Proposed)

```
obsidian-runbook/
├── docs/
│   ├── design.md
│   ├── project-plan.md
│   └── protocol.md
├── plugin/
│   ├── src/
│   │   ├── main.ts
│   │   ├── settings.ts
│   │   ├── websocket-client.ts
│   │   ├── editor/
│   │   │   ├── code-block-detector.ts
│   │   │   └── execute-decoration.ts
│   │   └── types.ts
│   ├── manifest.json
│   ├── package.json
│   ├── tsconfig.json
│   └── esbuild.config.mjs
├── agent/
│   ├── cmd/
│   │   └── agent/
│   │       └── main.go
│   ├── internal/
│   │   ├── pty/
│   │   │   └── session.go
│   │   ├── server/
│   │   │   └── websocket.go
│   │   └── protocol/
│   │       └── messages.go
│   ├── go.mod
│   └── Makefile
└── README.md
```

---

**Status:** Ready for implementation
