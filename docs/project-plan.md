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

## Phase 2: Core Shell Execution

### 2.1 Test Setup
- [ ] Add Vitest as dev dependency
- [ ] Configure test script in package.json
- [ ] Create `tests/` directory

### 2.2 ShellSession Class
- [ ] Create `src/shell/session.ts`
- [ ] Implement `spawn()` to start shell
- [ ] Implement `execute(command)` to send commands
- [ ] Implement output capture with event emitter
- [ ] Handle shell exit and restart
- [ ] Add session state tracking (alive/dead)

### 2.3 Shell Configuration
- [ ] Detect default shell (bash/zsh/sh)
- [ ] Handle Windows (cmd.exe/PowerShell) if needed

### 2.4 Unit Tests
- [ ] `tests/shell/session.test.ts`
  - [ ] Test shell spawns successfully
  - [ ] Test execute returns output
  - [ ] Test state persistence across commands
  - [ ] Test shell restart works
  - [ ] Test handles shell exit gracefully

### 2.5 Manual Verification Commands
Add commands to command palette for manual testing:
- [ ] `Runbook: Start shell session`
- [ ] `Runbook: Execute test command`
- [ ] `Runbook: Check shell state`
- [ ] `Runbook: Get session status`
- [ ] `Runbook: Restart shell`

### 2.6 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| `npm test` | All unit tests pass |
| Start shell | Status shows "alive", no errors |
| Execute command | Output captured and shown in Notice |
| State persistence | `export X=1` then `echo $X` returns `1` |
| Shell restart | Old shell killed, new one spawned |
| Shell exit handling | Detects exit, status shows "dead" |

---

## Phase 3: Editor Integration

### 3.1 CodeMirror 6 Integration
- [ ] Detect cursor position within code blocks
- [ ] Detect code block boundaries (start/end lines)
- [ ] Extract language from fenced code block
- [ ] Get current line text
- [ ] Get selected text

### 3.2 Language Allowlist
- [ ] Define supported languages (bash, sh, zsh, python)
- [ ] Validate language before execution
- [ ] Show error toast for unsupported languages

### 3.3 Execute Line/Selection Command
- [ ] Register `runbook:execute-line-or-selection` command
- [ ] Bind default hotkey (Cmd/Ctrl + Enter)
- [ ] Extract text to execute (selection or current line)
- [ ] Send to shell session
- [ ] Show toast on success/error

### 3.4 Cursor Auto-Advance
- [ ] Add setting for auto-advance
- [ ] Move cursor to next line after execution
- [ ] Skip empty lines option

### 3.5 Unit Tests
- [ ] `tests/editor/code-block-detector.test.ts`
  - [ ] Test detects code block boundaries
  - [ ] Test extracts language correctly
  - [ ] Test handles nested code blocks
  - [ ] Test handles cursor outside code block

### 3.6 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| `npm test` | All unit tests pass |
| Hotkey in code block | Executes current line |
| Hotkey with selection | Executes selected text |
| Hotkey outside code block | Shows error toast |
| Unsupported language | Shows error toast |

---

## Phase 4: Execute Block & Inline Output

### 4.1 Code Block Decoration
- [ ] Create CodeMirror ViewPlugin for code blocks
- [ ] Render Execute (▶) button on supported code blocks
- [ ] Style button appropriately

### 4.2 Execute Entire Block
- [ ] Extract full code block content on button click
- [ ] Send to shell session for execution
- [ ] Track execution state (pending, running, complete)

### 4.3 Inline Output Rendering
- [ ] Capture command output
- [ ] Render output container below code block
- [ ] Display timestamp and exit code
- [ ] Add copy-to-clipboard button
- [ ] Add clear output button
- [ ] Handle large output (collapsible, show last N lines)

### 4.4 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Execute button | Visible on bash/sh code blocks |
| Click execute | Runs code, shows output below |
| Output display | Shows timestamp, exit code |
| Copy button | Copies output to clipboard |
| Large output | Collapses with "show more" |

---

## Phase 5: Session Lifecycle

### 5.1 Lifecycle Management
- [ ] Start shell session on plugin load
- [ ] Graceful shutdown on plugin unload
- [ ] Handle shell crashes and auto-restart
- [ ] Show status in status bar

### 5.2 Session State
- [ ] Track current working directory
- [ ] Track environment variables (informational)
- [ ] Session restart preserves nothing (clean slate)

### 5.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Plugin load | Shell auto-starts |
| Plugin unload | Shell terminated cleanly |
| Status bar | Shows shell status |
| Shell crash | Auto-restarts with notice |

---

## Phase 6: Settings & Configuration

### 6.1 Plugin Settings Tab
- [ ] Default shell override
- [ ] Auto-advance cursor toggle
- [ ] Strip prompt prefixes toggle ($ and >)
- [ ] Dangerous command patterns (warn before execute)

### 6.2 Frontmatter Support (Future)
- [ ] Parse note frontmatter for overrides
- [ ] Support `shell` property to override default

### 6.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| Settings tab | All options visible and functional |
| Shell override | Uses configured shell |
| Auto-advance | Respects setting |

---

## Phase 7: Safety & UX Polish

### 7.1 Dangerous Command Warnings
- [ ] Define regex patterns for dangerous commands
- [ ] Show confirmation modal before execution
- [ ] Add setting to disable warnings

### 7.2 Error Handling & Feedback
- [ ] Show toast notifications for errors
- [ ] Display session status clearly
- [ ] Handle timeout scenarios
- [ ] Provide clear error messages

### 7.3 UI Polish
- [ ] Consistent styling with Obsidian themes
- [ ] Loading states during execution
- [ ] Keyboard accessibility

### 7.4 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| `rm -rf` | Shows warning modal |
| Disabled warning | Executes without modal |
| Theme compatibility | Looks good in light/dark |

---

## Phase 8: Documentation

### 8.1 Documentation
- [ ] User guide (README.md)
- [ ] Installation instructions
- [ ] Configuration reference
- [ ] Troubleshooting guide

### 8.2 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| README | Clear install steps |
| New user | Can install and use from docs alone |

---

## Phase 9: Packaging & Distribution

### 9.1 Plugin Packaging
- [ ] Create release workflow (GitHub Actions)
- [ ] Generate plugin zip for manual install
- [ ] Version management

### 9.2 Community Release
- [ ] Submit to Obsidian community plugins
- [ ] Create demo video/GIF

### 9.3 Verification Criteria

| Test | Pass Condition |
|------|----------------|
| GitHub Action | Builds and creates release |
| Manual install | Plugin zip works |

---

## Implementation Order

```
Phase 0 ✅ → Phase 1 ✅ → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9
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

**Status:** Phase 2 – Ready to implement ShellSession class
