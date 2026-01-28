# Obsidian Executable Runbook – Project Plan

This document outlines the implementation phases and tasks for the MVP.

---

## Architecture: Plugin-Only ✅

**Decision:** Use Node.js `child_process` directly from the plugin.

- Single TypeScript codebase
- No external agent binary
- Validated in Phase 0 - all tests passed

See `docs/architecture-decision.md` for details.

---

## Test Infrastructure

### Test Framework
- **Unit tests:** Vitest (fast, TypeScript-native)
- **Location:** `tests/` directory
- **Run:** `npm test`

### Test Strategy
- Each phase includes its own tests
- Tests run in Node.js (not inside Obsidian)
- Manual verification commands in plugin for integration testing

---

## Phase 0: Architecture Validation ✅ COMPLETE

All validation tests passed:

| Test | Result |
|------|--------|
| `child_process.spawn` | ✅ Works |
| Persistent shell | ✅ Works |
| Shell state persistence | ✅ Works |

---

## Phase 1: Project Scaffolding ✅ COMPLETE

### 1.1 Plugin Setup
- [x] Initialize plugin structure with TypeScript
- [x] Configure esbuild for bundling
- [x] Create manifest.json with plugin metadata
- [x] Set up development workflow
- [x] Add desktop-only runtime check

---

## Phase 2: Core Shell Execution ✅ COMPLETE

### 2.1 Test Setup
- [x] Add Vitest as dev dependency
- [x] Configure test script in package.json
- [x] Create `tests/` directory

### 2.2 ShellSession Class
- [x] Create `src/shell/session.ts`
- [x] Implement `spawn()` to start shell
- [x] Implement `execute(command)` to send commands
- [x] Implement output capture with event emitter
- [x] Handle shell exit and restart
- [x] Add session state tracking (alive/dead)

### 2.3 Shell Configuration
- [x] Detect default shell (bash/zsh/sh)
- [x] Handle Windows (cmd.exe/PowerShell) if needed

### 2.4 Unit Tests
- [x] `tests/shell/session.test.ts` (23 tests passing)
  - [x] Test shell spawns successfully
  - [x] Test execute returns output
  - [x] Test state persistence across commands
  - [x] Test shell restart works
  - [x] Test handles shell exit gracefully

### 2.5 Manual Verification Commands
- [x] `Runbook: Start shell session`
- [x] `Runbook: Get session status`
- [x] `Runbook: Restart shell`

---

## Phase 3: Editor Integration ✅ COMPLETE

### 3.1 CodeMirror 6 Integration
- [x] Detect cursor position within code blocks
- [x] Detect code block boundaries (start/end lines)
- [x] Extract language from fenced code block
- [x] Get current line text
- [x] Get selected text

### 3.2 Language Allowlist
- [x] Define supported languages (bash, sh, zsh, shell, python, py)
- [x] Validate language before execution
- [x] Show error toast for unsupported languages

### 3.3 Execute Line/Selection Command
- [x] Register `runbook:execute-line-or-selection` command
- [x] Bind default hotkey (Shift + Cmd/Ctrl + Enter)
- [x] Extract text to execute (selection or current line)
- [x] Send to shell session
- [x] Show toast on success/error

### 3.4 Cursor Auto-Advance
- [x] Move cursor to next line after execution
- [x] Strip prompt prefixes ($ and >)

### 3.5 Unit Tests
- [x] `tests/editor/code-block.test.ts` (36 tests passing)
  - [x] Test detects code block boundaries
  - [x] Test extracts language correctly
  - [x] Test handles cursor outside code block

---

## Phase 4: Execute Block & Inline Output ⚠️ UI NEEDS FINALIZATION

### 4.1 Code Block Decoration
- [x] Create MarkdownPostProcessor for code blocks
- [x] Render Execute (▶) button on supported code blocks
- [ ] Finalize button styling and positioning

### 4.2 Execute Entire Block
- [x] Extract full code block content on button click
- [x] Send to shell session for execution
- [x] Track execution state (pending, running, complete)

### 4.3 Inline Output Rendering
- [x] Capture command output
- [x] Render output container below code block
- [x] Display timestamp
- [x] Add copy-to-clipboard button
- [x] Add clear output button
- [x] Handle large output (collapsible)
- [ ] Finalize output container styling

### 4.4 Unit Tests
- [x] `tests/ui/output-container.test.ts` (23 tests passing)

### 4.5 Remaining UI Work
- [ ] Polish execute button appearance
- [ ] Improve output container visual design
- [ ] Ensure theme compatibility (light/dark)
- [ ] Loading state animations

---

## Phase 5: Terminal View ✅ COMPLETE

### 5.1 Terminal Panel
- [x] Create bottom panel view
- [x] Register view with Obsidian
- [x] Add command to toggle terminal panel
- [ ] Panel resize handle (deferred to Phase 8)

### 5.2 Tab Management
- [x] Tab bar UI for multiple terminals
- [x] Create new terminal tab (each = own shell session)
- [x] Close terminal tab
- [x] Switch between tabs
- [x] Active tab indicator
- [x] Tab naming/renaming

### 5.3 Terminal Display
- [x] Terminal output area with scrollback
- [ ] ANSI color code support (deferred to Phase 8)
- [x] Auto-scroll to bottom on new output
- [ ] Manual scroll with auto-scroll pause (deferred to Phase 8)

### 5.4 Terminal Input
- [x] Command input field
- [x] Execute on Enter
- [x] Command history (up/down arrows)
- [x] Per-session history

### 5.5 Integration with Code Blocks
- [x] Commands from code blocks execute in active terminal
- [x] Output appears in active terminal
- [x] Visual feedback when command sent to terminal

### 5.6 Unit Tests
- [x] `tests/terminal/terminal-manager.test.ts` (27 tests passing)

---

## Phase 6: Real Terminal (xterm.js + Python PTY) ✅ COMPLETE

**Note:** Used Python's `pty` module instead of `node-pty` to avoid native module compilation issues.

### 6.1 Dependencies
- [x] Add `@xterm/xterm` for terminal emulation
- [x] Add `@xterm/addon-fit` for auto-resize
- [x] Add `@xterm/addon-web-links` for clickable links
- [x] Use Python 3 `pty` module (no native compilation needed)

### 6.2 Python PTY Shell Session
- [x] Create `src/shell/python-pty-session.ts`
- [x] Embedded Python PTY helper script
- [x] Handle PTY resize events via command pipe
- [x] Proper signal handling (SIGTERM on kill)
- [x] Fallback to basic ShellSession if Python unavailable

### 6.3 xterm.js Terminal View
- [x] Create `src/terminal/xterm-view.ts`
- [x] Integrate xterm.js into Obsidian ItemView
- [x] Handle terminal resize on panel resize (ResizeObserver)
- [x] Theme integration (uses Obsidian CSS variables)

### 6.4 Full Terminal Features
- [x] ANSI color support (TERM=xterm-256color)
- [x] Cursor positioning
- [x] `clear` command works
- [x] Interactive programs (vim, less, top)
- [x] Copy/paste support (via xterm.js)
- [x] Selection support (via xterm.js)
- [x] Clickable URLs (web-links addon)

### 6.5 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Colors | `ls --color` shows colored output ✅ |
| Clear | `clear` clears the screen ✅ |
| Interactive | `vim` opens and is usable ✅ |
| Resize | Terminal reflows on panel resize ✅ |

---

## Phase 6b: Developer Console ✅ COMPLETE (Bonus Feature)

**Note:** This feature was not in the original plan but adds significant debugging value.

### 6b.1 Console View
- [x] Create `src/terminal/dev-console-view.ts`
- [x] JavaScript REPL using xterm.js
- [x] Register as Obsidian ItemView
- [x] Command: `Runbook: Open developer console`

### 6b.2 Obsidian API Access
- [x] Expose `app` - Obsidian App instance
- [x] Expose `workspace` - Workspace manager
- [x] Expose `vault` - Vault API
- [x] Expose `plugins` - Plugin manager
- [x] `clear()` helper function

### 6b.3 Help System
- [x] `help()` - Main help
- [x] `help.app()` - App object reference
- [x] `help.workspace()` - Workspace reference
- [x] `help.vault()` - Vault reference
- [x] `help.plugins()` - Plugins reference
- [x] `help.examples()` - Usage examples
- [x] `help.shortcuts()` - Keyboard shortcuts

### 6b.4 Advanced Features
- [x] Tab completion for objects and properties
- [x] Command history (up/down arrows)
- [x] Line editing (Ctrl+A, Ctrl+E, arrow keys)
- [x] Console interception (logs appear in console)
- [x] Formatted output with ANSI colors
- [x] Theme integration with Obsidian

---

## Phase 7: Session Lifecycle ⚠️ IN PROGRESS

### 7.1 Lifecycle Management
- [ ] Start default terminal on plugin load (requires settings - Phase 8)
- [x] Graceful shutdown on plugin unload
- [x] Handle shell crashes and auto-restart
- [x] Show status in status bar

### 7.2 Session State
- [ ] Track current working directory per terminal
- [ ] Track environment variables (informational)
- [x] Session restart preserves nothing (clean slate)

### 7.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Plugin load | Default terminal auto-starts (deferred) |
| Plugin unload | All terminals terminated cleanly ✅ |
| Status bar | Shows active terminal status ✅ |
| Shell crash | Auto-restarts with notice ✅ |

---

## Phase 8: Settings & Configuration

### 8.1 Plugin Settings Tab
- [ ] Default shell override
- [ ] Auto-advance cursor toggle
- [ ] Strip prompt prefixes toggle ($ and >)
- [ ] Terminal panel default state (open/closed)
- [ ] Default terminal count on startup

### 8.2 Frontmatter Support (Future)
- [ ] Parse note frontmatter for overrides
- [ ] Support `shell` property to override default

### 8.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Settings tab | All options visible and functional |
| Shell override | Uses configured shell |
| Auto-advance | Respects setting |

---

## Phase 9: UI Polish

### 9.1 Code Block UI
- [ ] Finalize execute button styling
- [ ] Consistent button positioning
- [ ] Hover states and transitions

### 9.2 Output Container UI
- [ ] Clean visual design
- [ ] Proper spacing and borders
- [ ] Smooth expand/collapse animations

### 9.3 Terminal UI
- [ ] Professional terminal appearance
- [ ] Tab bar styling
- [ ] Input field styling
- [ ] Scrollbar styling

### 9.4 Theme Compatibility
- [ ] Light theme support
- [ ] Dark theme support
- [ ] Custom theme compatibility
- [ ] High contrast accessibility

### 9.5 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Light theme | All UI elements visible and styled |
| Dark theme | All UI elements visible and styled |
| Animations | Smooth, non-jarring transitions |

---

## Phase 10: Documentation

### 10.1 Documentation
- [ ] User guide (README.md)
- [ ] Installation instructions
- [ ] Configuration reference
- [ ] Troubleshooting guide

### 10.2 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| README | Clear install steps |
| New user | Can install and use from docs alone |

---

## Phase 11: Packaging & Distribution

### 11.1 Plugin Packaging
- [ ] Create release workflow (GitHub Actions)
- [ ] Generate plugin zip for manual install
- [ ] Version management

### 11.2 Community Release
- [ ] Submit to Obsidian community plugins
- [ ] Create demo video/GIF

### 11.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| GitHub Action | Builds and creates release |
| Manual install | Plugin zip works |

---

## Implementation Order

```
Phase 0-5 ✅ → Phase 6 ✅ → Phase 6b ✅ → Phase 7-8 → Phase 9-10 → Phase 11
              (xterm.js)   (Dev Console)      ▲
                                          YOU ARE HERE
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Plugin API | Obsidian API |
| Editor | CodeMirror 6 |
| Terminal UI | xterm.js (@xterm/xterm) |
| PTY | Python 3 pty module |
| Execution | Node.js `child_process` (fallback) |
| Build | esbuild |
| Testing | Vitest |

---

## File Structure

```
obsidian-runbook/
├── docs/
│   ├── design.md
│   ├── project-plan.md
│   └── architecture-decision.md
├── scripts/
│   └── install.sh
├── src/
│   ├── main.ts
│   ├── shell/
│   │   ├── session.ts              # Basic shell (fallback)
│   │   └── python-pty-session.ts   # Python PTY (primary)
│   ├── editor/
│   │   └── code-block.ts
│   ├── terminal/
│   │   ├── index.ts
│   │   ├── terminal-manager.ts
│   │   ├── terminal-view.ts        # Basic terminal (legacy)
│   │   ├── xterm-view.ts           # xterm.js terminal
│   │   ├── xterm-styles.ts
│   │   ├── terminal-styles.ts
│   │   └── dev-console-view.ts     # Developer console
│   └── ui/
│       ├── code-block-processor.ts
│       └── output-container.ts
├── tests/
│   ├── shell/
│   │   └── session.test.ts
│   ├── editor/
│   │   └── code-block.test.ts
│   ├── terminal/
│   │   └── terminal-manager.test.ts
│   └── ui/
│       └── output-container.test.ts
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

---

**Status:** Phase 7 (Session Lifecycle) - Phases 0-6b complete
