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

## Phase 7: Session Lifecycle ✅ COMPLETE

### 7.1 Lifecycle Management
- [ ] Start default terminal on plugin load (moved to Phase 8 settings)
- [x] Graceful shutdown on plugin unload
- [x] Handle shell crashes and auto-restart
- [x] Show status in status bar

### 7.2 Session State
- [ ] Track current working directory per terminal (deferred - nice to have)
- [ ] Track environment variables (deferred - nice to have)
- [x] Session restart preserves nothing (clean slate)

### 7.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Plugin load | Default terminal auto-starts (deferred) |
| Plugin unload | All terminals terminated cleanly ✅ |
| Status bar | Shows active terminal status ✅ |
| Shell crash | Auto-restarts with notice ✅ |

---

## Phase 8: Runbook Features ✅ COMPLETE

**Core features to make this a true "Runbook" tool.**
**Compatibility:** Adopts [Runme](https://runme.dev) code block annotation syntax
so notebooks are portable between Obsidian Runbook and Runme (VS Code).

### 8.1 Runme-Compatible Code Block Annotations
- [x] Support JSON attributes after language tag: ` ```sh {"name":"setup"} `
- [x] Parse `name` attribute (cell identifier)
- [x] Parse `excludeFromRunAll` attribute
- [x] Parse `cwd` attribute (per-cell working directory)
- [x] Ignore unknown attributes gracefully (forward-compatible)
- [x] Support frontmatter for document-level config (`shell`, `cwd`)

### 8.2 Multi-Language Support
- [x] Route code blocks to interpreter based on language tag
- [x] Python execution (`python`, `py`) via `python3 -c`
- [x] JavaScript execution (`javascript`, `js`) via `node -e`
- [x] TypeScript execution (`typescript`, `ts`) via `npx tsx -e`
- [x] Shell execution (`sh`, `bash`, `zsh`, `shell`) via PTY (existing)
- [x] Update `isLanguageSupported()` with new languages
- [x] Error handling for missing interpreters (interpreter errors shown in terminal)

### 8.3 Session Isolation per Note (Runbook Concept)
- [x] Each note gets its own shell session (not shared)
- [x] Track note file path → session mapping
- [x] Auto-create session on first execute from a note
- [x] Lazy cleanup of dead sessions
- [x] Terminal tab shows note name for identification
- [x] Non-shell languages (Python/JS/TS) run in note's session shell

### 8.4 Run All Cells (Execute Runbook)
- [x] Register `runbook:run-all` command
- [x] Collect all supported code blocks from active note
- [x] Execute sequentially in note's session
- [x] Respect `excludeFromRunAll` attribute
- [x] Respect `cwd` per-cell attribute
- [x] Stop on error (default behavior)
- [x] Output progress to terminal (e.g., "Running cell 2/5: setup...")

### 8.5 Unit Tests
- [x] `tests/editor/code-block.test.ts` (88 tests passing)
  - [x] JSON attribute parsing tests
  - [x] Frontmatter parsing tests
  - [x] Multi-language support tests
  - [x] Interpreter command building tests
  - [x] Code block collection tests
  - [x] `interactive`/`interpreter` attribute parsing tests

### 8.6 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Annotations | Runme-annotated blocks parse correctly ✅ |
| Python | `python` code blocks execute via interpreter ✅ |
| JavaScript | `js` code blocks execute via node ✅ |
| TypeScript | `ts` code blocks execute via tsx ✅ |
| Isolation | Two notes run in separate sessions ✅ |
| Run All | Command executes all blocks in order ✅ |
| excludeFromRunAll | Skipped blocks are not executed ✅ |

---

### 8.7 Native Interactive Interpreter Sessions ✅ COMPLETE

**Goal:** Preserve state across code blocks for non-shell languages by spawning
persistent REPL sessions (one per language per note) instead of one-shot
`python3 -c` / `node -e` commands.

#### 8.7.1 Per-Language Interpreter Architecture
- [x] Common interfaces: `ITerminalSession`, `IInterpreterSession` (`src/shell/types.ts`)
- [x] Abstract base class with PTY infrastructure (`src/shell/interpreter-base.ts`)
- [x] `PythonInterpreterSession` — raw line-by-line with smart blank line insertion
- [x] `NodeInterpreterSession` — raw line-by-line (REPL auto-detects incomplete statements)
- [x] `TypeScriptInterpreterSession` — raw line-by-line with safe TS compiler env vars
- [x] `createInterpreterSession()` factory function (`src/shell/interpreters/index.ts`)
- [x] Spawn through login shell (`$SHELL -l -c "exec <cmd>"`) for PATH resolution
- [x] Support configurable interpreter path (override via attribute or settings)

#### 8.7.2 Language-Aware Session Management
- [x] SessionManager key: `notePath:language` for interpreter sessions
- [x] Per-note session set: shell session + optional Python / Node / TS sessions
- [x] `getOrCreateInterpreterSession(notePath, language, cwd)` routes correctly
- [x] Lazy creation: interpreter session only spawned on first use of that language
- [x] Cleanup: kill all interpreter sessions when note session is cleaned up
- [x] Tab headers show interpreter type: `Python: noteName`, `Node.js: noteName`, etc.
- [x] All terminal tabs share one pane (not stacked horizontal splits)

#### 8.7.3 Execution Routing
- [x] Shell blocks → shell PTY (unchanged)
- [x] Python blocks → Python REPL session (raw code)
- [x] JS blocks → Node REPL session (raw code)
- [x] TS blocks → ts-node REPL session (raw code)
- [x] Run All routes each block to correct session per language
- [x] `interactive: false` blocks still use one-shot `buildInterpreterCommand` path

#### 8.7.4 Code Block Annotations
- [x] `interactive` attribute (boolean, default `true`): use persistent REPL
- [x] `interactive: false` → one-shot execution (existing `python3 -c` behavior)
- [x] `interpreter` attribute: override interpreter path per block
- [x] Example: ` ```python {"interactive": false, "interpreter": "python3.11"} `

#### 8.7.5 REPL Input Handling
- [x] Python: raw lines with smart blank line insertion after indented blocks
- [x] Node.js: raw lines — REPL handles multiline via brace/paren matching
- [x] TypeScript: raw lines with `TS_NODE_SKIP_PROJECT`, `TS_NODE_TRANSPILE_ONLY`,
      and `TS_NODE_COMPILER_OPTIONS` env vars for safe standalone operation
- [x] Interpreter exit detection: no auto-restart (prevents crash loops), manual restart via Enter

#### 8.7.6 Unit Tests
- [x] `tests/shell/interpreters.test.ts` (31 tests)
  - [x] Python wrapCode: raw lines, blank line insertion, compound statements
  - [x] Node wrapCode: raw lines, blank line skipping, multiline braces
  - [x] TypeScript wrapCode: raw lines, blank line skipping, multiline braces
  - [x] Factory function creates correct session types
- [x] `tests/editor/code-block.test.ts` — `interactive`/`interpreter` attribute parsing

#### 8.7.7 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Python state | Block 1 sets `x=42`, Block 2 reads `x` ✅ |
| Node state | Block 1 defines `let y=1`, Block 2 reads `y` ✅ |
| TS state | Block 1 defines typed var, Block 2 reads it ✅ |
| interactive:false | One-shot, no state preserved ✅ |
| interpreter attr | Custom interpreter path used ✅ |
| Mixed languages | Shell + Python blocks route to correct sessions ✅ |
| Run All | Blocks route to correct REPL per language ✅ |
| Session cleanup | All REPLs killed on note close ✅ |

#### 8.7.8 Known Limitations
- **Python `if/else`, `try/except`**: The blank line insertion between indented→non-indented
  transitions will prematurely terminate a compound statement before `else:`, `elif:`,
  `except:`, `finally:`. These continuation keywords need special handling (future fix).
- **JS/TS `const` redeclaration**: Re-running a code block with `const` fails because
  the REPL scope already has the binding. Use `let` or `var` for re-runnable blocks.
  This is a fundamental REPL limitation (not fixable without scope isolation).

---

## Phase 9: Settings & Configuration

### 9.1 Plugin Settings Tab
- [ ] Create settings tab UI (`src/settings.ts`)
- [ ] Define `RunbookSettings` interface with defaults
- [ ] Load/save settings via `plugin.loadData()` / `plugin.saveData()`

### 9.2 Interpreter & Shell Paths
- [ ] Default shell path override (current: `$SHELL` or `/bin/bash`)
- [ ] Python interpreter path (default: `python3`)
- [ ] Node.js interpreter path (default: `node`)
- [ ] TypeScript interpreter path (default: `npx ts-node`)
- [ ] Wire settings into `createInterpreterSession()` and `PythonPtySession`

### 9.3 Terminal Appearance
- [ ] Terminal font size (default: `13`)

### 9.4 Editor Behavior
- [ ] Auto-advance cursor toggle (default: `true`)

### 9.5 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Settings tab | All options visible and functional |
| Shell override | Uses configured shell path |
| Interpreter paths | Python/Node/TS use configured paths |
| Font size | Terminal respects configured font size |
| Auto-advance | Cursor advance respects toggle |

---

## Phase 10: Documentation

### 10.1 README
- [ ] Project description and feature overview
- [ ] Installation instructions (manual install)
- [ ] Quick start guide (basic usage)
- [ ] Supported languages
- [ ] Runme compatibility note
- [ ] Command reference

### 10.2 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| README | New user can install and use from docs alone |

---

## Phase 11: Packaging & Release

### 11.1 GitHub Actions
- [ ] Create release workflow
- [ ] Auto-generate plugin zip on tag
- [ ] Version management

### 11.2 Community Release
- [ ] Submit to Obsidian community plugins
- [ ] Create demo GIF for README

### 11.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Release workflow | Creates valid plugin zip |
| Manual install | Plugin zip works in Obsidian |

---

## Implementation Order

```
Phase 0-8.7 ✅ → Phase 9 → Phase 10 → Phase 11
(Core + Runbook   (Settings) (Docs)    (Release)
 + Native REPLs)    ▲
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
│   │   ├── python-pty-session.ts   # Python PTY (primary)
│   │   ├── types.ts                # ITerminalSession, IInterpreterSession interfaces
│   │   ├── interpreter-base.ts     # Abstract base class with PTY infrastructure
│   │   └── interpreters/
│   │       ├── index.ts            # Factory + re-exports
│   │       ├── python-interpreter.ts   # Python REPL (raw lines + blank line insertion)
│   │       ├── node-interpreter.ts     # Node.js REPL (raw lines)
│   │       └── typescript-interpreter.ts # ts-node REPL (raw lines + env vars)
│   ├── editor/
│   │   └── code-block.ts           # Code block detection, annotations, interpreter routing
│   ├── runbook/
│   │   └── session-manager.ts      # Per-note session isolation, shared terminal pane
│   ├── terminal/
│   │   ├── xterm-view.ts           # xterm.js terminal + interpreter session support
│   │   ├── xterm-styles.ts         # Terminal CSS styles
│   │   └── dev-console-view.ts     # Developer console
│   └── ui/
│       ├── code-block-processor.ts
│       └── output-container.ts
├── tests/
│   ├── shell/
│   │   ├── session.test.ts
│   │   └── interpreters.test.ts    # Interpreter wrapCode + factory tests (31 tests)
│   ├── editor/
│   │   └── code-block.test.ts
│   └── ui/
│       └── output-container.test.ts
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

---

**Status:** Phases 0-8 complete (including 8.7 Native REPLs). Next: Phase 9 (Settings & Configuration)
