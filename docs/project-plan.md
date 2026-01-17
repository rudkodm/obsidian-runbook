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

## Phase 5: Terminal View

### 5.1 Terminal Panel
- [ ] Create bottom panel view
- [ ] Register view with Obsidian
- [ ] Add command to toggle terminal panel
- [ ] Panel resize handle

### 5.2 Tab Management
- [ ] Tab bar UI for multiple terminals
- [ ] Create new terminal tab (each = own shell session)
- [ ] Close terminal tab
- [ ] Switch between tabs
- [ ] Active tab indicator
- [ ] Tab naming/renaming

### 5.3 Terminal Display
- [ ] Terminal output area with scrollback
- [ ] ANSI color code support
- [ ] Auto-scroll to bottom on new output
- [ ] Manual scroll with auto-scroll pause

### 5.4 Terminal Input
- [ ] Command input field
- [ ] Execute on Enter
- [ ] Command history (up/down arrows)
- [ ] Per-session history

### 5.5 Integration with Code Blocks
- [ ] Commands from code blocks execute in active terminal
- [ ] Output appears in active terminal
- [ ] Visual feedback when command sent to terminal

### 5.6 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Toggle panel | Panel opens/closes |
| New tab | Creates new shell session |
| Tab switch | Changes active terminal |
| Direct input | Commands execute in terminal |
| Code block execution | Output appears in active terminal |

---

## Phase 6: Session Lifecycle

### 6.1 Lifecycle Management
- [ ] Start default terminal on plugin load
- [ ] Graceful shutdown on plugin unload
- [ ] Handle shell crashes and auto-restart
- [ ] Show status in status bar

### 6.2 Session State
- [ ] Track current working directory per terminal
- [ ] Track environment variables (informational)
- [ ] Session restart preserves nothing (clean slate)

### 6.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Plugin load | Default terminal auto-starts |
| Plugin unload | All terminals terminated cleanly |
| Status bar | Shows active terminal status |
| Shell crash | Auto-restarts with notice |

---

## Phase 7: Settings & Configuration

### 7.1 Plugin Settings Tab
- [ ] Default shell override
- [ ] Auto-advance cursor toggle
- [ ] Strip prompt prefixes toggle ($ and >)
- [ ] Terminal panel default state (open/closed)
- [ ] Default terminal count on startup

### 7.2 Frontmatter Support (Future)
- [ ] Parse note frontmatter for overrides
- [ ] Support `shell` property to override default

### 7.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Settings tab | All options visible and functional |
| Shell override | Uses configured shell |
| Auto-advance | Respects setting |

---

## Phase 8: UI Polish

### 8.1 Code Block UI
- [ ] Finalize execute button styling
- [ ] Consistent button positioning
- [ ] Hover states and transitions

### 8.2 Output Container UI
- [ ] Clean visual design
- [ ] Proper spacing and borders
- [ ] Smooth expand/collapse animations

### 8.3 Terminal UI
- [ ] Professional terminal appearance
- [ ] Tab bar styling
- [ ] Input field styling
- [ ] Scrollbar styling

### 8.4 Theme Compatibility
- [ ] Light theme support
- [ ] Dark theme support
- [ ] Custom theme compatibility
- [ ] High contrast accessibility

### 8.5 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Light theme | All UI elements visible and styled |
| Dark theme | All UI elements visible and styled |
| Animations | Smooth, non-jarring transitions |

---

## Phase 9: Documentation

### 9.1 Documentation
- [ ] User guide (README.md)
- [ ] Installation instructions
- [ ] Configuration reference
- [ ] Troubleshooting guide

### 9.2 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| README | Clear install steps |
| New user | Can install and use from docs alone |

---

## Phase 10: Packaging & Distribution

### 10.1 Plugin Packaging
- [ ] Create release workflow (GitHub Actions)
- [ ] Generate plugin zip for manual install
- [ ] Version management

### 10.2 Community Release
- [ ] Submit to Obsidian community plugins
- [ ] Create demo video/GIF

### 10.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| GitHub Action | Builds and creates release |
| Manual install | Plugin zip works |

---

## Implementation Order

```
Phase 0 ✅ → Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ → Phase 4 ⚠️ → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10
                                                    ▲
                                                YOU ARE HERE
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Plugin API | Obsidian API |
| Editor | CodeMirror 6 |
| Execution | Node.js `child_process` |
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
│   ├── settings.ts
│   ├── shell/
│   │   └── session.ts
│   ├── editor/
│   │   ├── code-block-detector.ts
│   │   └── execute-decoration.ts
│   └── types.ts
├── tests/
│   ├── shell/
│   │   └── session.test.ts
│   └── editor/
│       └── code-block-detector.test.ts
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

---

**Status:** Phase 4 UI finalization, then Phase 5 (Terminal View)
