# Architecture Decision: Plugin-Only (Option A)

**Date:** 2026-01-14
**Status:** Confirmed

---

## Phase 0 Validation Results

All tests passed in Obsidian Desktop:

| Test | Result |
|------|--------|
| `child_process.spawn` | ✅ Works - can execute commands |
| Persistent shell spawn | ✅ Works - bash stays running |
| Shell state persistence | ✅ Works - variables persist across commands |

---

## Decision

**We will use Option A: Plugin-Only Architecture**

The Obsidian plugin can directly use Node.js `child_process` APIs to spawn and manage shell sessions. No external agent binary is required.

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Obsidian Desktop              │
│  ┌───────────────────────────────────┐  │
│  │         Runbook Plugin            │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │     ShellSession Manager    │  │  │
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │   child_process.spawn │  │  │  │
│  │  │  │   (bash / sh / zsh)   │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Benefits of This Approach

1. **Single codebase** - TypeScript only
2. **No binary distribution** - no platform-specific builds
3. **Simpler installation** - standard Obsidian plugin install
4. **Easier maintenance** - one project, one language
5. **No IPC overhead** - direct function calls, no WebSocket

---

## Technical Notes

- Shell spawned with `child_process.spawn()`
- stdio: `['pipe', 'pipe', 'pipe']` for stdin/stdout/stderr
- Shell runs in interactive mode (`-i` flag)
- State persists naturally (it's a real shell process)
- Output captured via stdout/stderr event listeners

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Shell crash | Detect exit, auto-restart with notice |
| Large output | Buffer with size limit, truncate if needed |
| Hanging commands | Timeout option (future) |
| Platform differences | Test on macOS, Linux, Windows |

---

## Next Steps

Proceed with Phase 1 scaffolding using Option A file structure:

```
obsidian-runbook/
├── src/
│   ├── main.ts
│   ├── settings.ts
│   ├── shell/
│   │   └── session.ts
│   └── editor/
│       ├── code-block-detector.ts
│       └── execute-decoration.ts
├── manifest.json
├── package.json
└── ...
```
