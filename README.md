# Obsidian Runbook

[![Obsidian](https://img.shields.io/badge/Obsidian-v1.0+-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md)
[![License](https://img.shields.io/github/license/rudkodm/obsidian-runbook)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/rudkodm/obsidian-runbook/releases)

Turn Obsidian into an **executable runbook** for DevOps, SREs, and developers. Run code blocks, execute commands line by line, and debug scripts directly from your notes — with a real, stateful terminal session.

## Features

- 🖥️ **Real terminal** — Full xterm.js terminal with ANSI colors, interactive programs (vim, top, less), and tab management
- 🐍 **Multi-language** — Shell (bash/zsh/sh), Python, JavaScript, and TypeScript
- 🔄 **Persistent state** — Native interpreter sessions preserve variables across code blocks
- 📓 **Session isolation** — Each note gets its own shell and interpreter sessions
- ▶️ **Run All** — Execute an entire runbook sequentially with one command
- 🏷️ **Runme compatible** — Portable code block annotations work in both Obsidian Runbook and [Runme](https://runme.dev) (VS Code)
- 🛠️ **Developer console** — Built-in JavaScript REPL with full Obsidian API access
- ⚙️ **Configurable** — Custom interpreter paths, font sizes, and editor behavior

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Supported Languages](#supported-languages)
- [Code Block Annotations](#code-block-annotations)
- [Frontmatter Configuration](#frontmatter-configuration)
- [Interactive Interpreters](#interactive-interpreters)
- [Session Isolation](#session-isolation)
- [Run All](#run-all)
- [Terminal](#terminal)
- [Developer Console](#developer-console)
- [Settings](#settings)
- [Command Reference](#command-reference)
- [Runme Compatibility](#runme-compatibility)
- [Security Considerations](#security-considerations)
- [Known Limitations](#known-limitations)
- [Tech Stack](#tech-stack)

## Installation

### Manual Install

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/rudkodm/obsidian-runbook/releases)
2. Create a folder: `<your-vault>/.obsidian/plugins/runbook/`
3. Copy the three files into that folder
4. Open Obsidian → **Settings** → **Community Plugins** → Enable **Runbook**

### Build from Source

```bash
git clone https://github.com/rudkodm/obsidian-runbook.git
cd obsidian-runbook
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin directory, or set `OBSIDIAN_PLUGINS_HOME` and run:

```bash
npm run install-plugin
```

## Quick Start

1. Open any note in Obsidian
2. Create a fenced code block with a supported language:

````markdown
```bash
echo "Hello from Runbook!"
ls -la
```
````

3. Place your cursor on a line and press **Shift + Cmd + Enter** (macOS) or **Shift + Ctrl + Enter** (Windows/Linux) to execute that line
4. Or click the **▶** button on the code block to execute the entire block
5. Output appears in the terminal panel at the bottom

## Supported Languages

| Language | Tags | Execution |
|----------|------|-----------|
| Shell | `bash`, `sh`, `zsh`, `shell` | Real PTY session (default) |
| Python | `python`, `py` | Persistent REPL or one-shot |
| JavaScript | `javascript`, `js` | Persistent Node.js REPL or one-shot |
| TypeScript | `typescript`, `ts` | Persistent ts-node REPL or one-shot |

### Shell

````markdown
```bash
echo "Current directory: $(pwd)"
for i in 1 2 3; do echo "Item $i"; done
```
````

Shell blocks run in a real PTY with full ANSI color support, interactive programs, and persistent state.

### Python

````markdown
```python
import pandas as pd
df = pd.DataFrame({"name": ["Alice", "Bob"], "score": [95, 87]})
print(df)
```
````

By default, Python blocks run in a persistent REPL — variables are preserved across blocks in the same note.

### JavaScript

````markdown
```javascript
const data = [1, 2, 3, 4, 5];
const sum = data.reduce((a, b) => a + b, 0);
console.log(`Sum: ${sum}`);
```
````

### TypeScript

````markdown
```typescript
interface User { name: string; age: number; }
const user: User = { name: "Dima", age: 30 };
console.log(user);
```
````

## Code Block Annotations

Runbook supports [Runme-compatible](https://runme.dev) JSON annotations after the language tag:

````markdown
```bash {"name": "setup", "cwd": "/tmp"}
echo "Running setup in /tmp"
```
````

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | — | Cell identifier |
| `cwd` | string | — | Working directory for this block |
| `excludeFromRunAll` | boolean | `false` | Skip this block during Run All |
| `interactive` | boolean | `true` | Use persistent REPL (`false` = one-shot execution) |
| `interpreter` | string | — | Override interpreter path for this block |

### Examples

Skip a block during Run All:

````markdown
```bash {"excludeFromRunAll": true}
# This is for manual debugging only
kubectl port-forward svc/my-service 8080:80
```
````

Use a specific Python version:

````markdown
```python {"interpreter": "python3.11"}
import sys
print(sys.version)
```
````

One-shot execution (no state preserved):

````markdown
```python {"interactive": false}
print("This runs via python3 -c, no REPL state")
```
````

## Frontmatter Configuration

Set document-level defaults using YAML frontmatter:

```yaml
---
shell: /bin/zsh
cwd: ~/projects/my-app
---
```

| Key | Description |
|-----|-------------|
| `shell` | Default shell for this document |
| `cwd` | Default working directory for all blocks |

Per-block `cwd` annotations override the frontmatter value.

## Interactive Interpreters

By default, non-shell code blocks run in **persistent REPL sessions**. This means variables, imports, and state are preserved across code blocks within the same note.

**Block 1:**
````markdown
```python
x = 42
data = [1, 2, 3]
```
````

**Block 2** (same note — `x` and `data` are still available):
````markdown
```python
print(f"x = {x}, sum = {sum(data)}")
```
````

Each language gets its own interpreter session per note:
- Shell blocks → PTY shell session
- Python blocks → Python REPL
- JS blocks → Node.js REPL
- TS blocks → ts-node REPL

To disable persistent state for a specific block, use `"interactive": false`.

## Session Isolation

Every note in your vault gets its **own set of sessions**. Commands in `deploy-prod.md` won't affect sessions in `debug-api.md`.

- Sessions are created lazily on first execution
- Terminal tabs show the note name for identification
- Closing a note cleans up its sessions

## Run All

Execute every code block in a note sequentially:

1. Open Command Palette (**Cmd/Ctrl + P**)
2. Run **Runbook: Run all cells**

Behavior:
- Blocks execute in document order
- Each block routes to the correct interpreter (shell, Python, JS, TS)
- Blocks with `excludeFromRunAll: true` are skipped
- Per-block `cwd` is respected
- Execution stops on error

## Terminal

The terminal panel uses **xterm.js** for a full-featured terminal experience:

- **ANSI 256-color support** — `ls --color`, syntax highlighting, etc.
- **Interactive programs** — `vim`, `less`, `top`, `htop` all work
- **Clickable URLs** — Links in terminal output are clickable
- **Tab management** — Multiple terminal tabs, rename, close
- **Resize** — Terminal reflows on panel resize
- **Copy/paste** — Standard OS shortcuts
- **Command history** — Up/down arrows (per session)
- **Theme integration** — Follows your Obsidian theme

Toggle the terminal: **Cmd/Ctrl + P** → **Runbook: Toggle terminal**

## Developer Console

A built-in JavaScript REPL with direct access to the Obsidian API:

**Cmd/Ctrl + P** → **Runbook: Open developer console**

Available globals:

| Variable | Description |
|----------|-------------|
| `app` | Obsidian App instance |
| `workspace` | Workspace manager |
| `vault` | Vault API |
| `plugins` | Plugin manager |
| `clear()` | Clear console |
| `help()` | Show help |

```javascript
// List all markdown files
vault.getMarkdownFiles().map(f => f.path)

// Get active file content
await vault.read(workspace.getActiveFile())

// List enabled plugins
Object.keys(plugins.plugins)
```

Supports tab completion, command history, and formatted ANSI output.

## Settings

**Settings** → **Community Plugins** → **Runbook**

| Setting | Default | Description |
|---------|---------|-------------|
| Shell path | `$SHELL` or `/bin/bash` | Default shell for terminal sessions |
| Python path | `python3` | Python interpreter path |
| Node.js path | `node` | Node.js interpreter path |
| TypeScript path | `npx ts-node` | TypeScript interpreter path |
| Font size | `13` | Terminal font size |
| Auto-advance cursor | `true` | Move cursor to next line after execution |

## Command Reference

| Command | Default Hotkey | Description |
|---------|---------------|-------------|
| Execute line or selection | `Shift + Cmd/Ctrl + Enter` | Run current line or selected text |
| Run all cells | — | Execute all code blocks in the active note |
| Toggle terminal | — | Show/hide the terminal panel |
| Start shell session | — | Start a new shell session |
| Get session status | — | Show current session info |
| Restart shell | — | Restart the active shell session |
| Open developer console | — | Open the JS developer console |

## Runme Compatibility

Obsidian Runbook adopts the [Runme](https://runme.dev) code block annotation syntax. Runbooks authored in Obsidian Runbook can be opened and executed in Runme (VS Code) and vice versa.

Supported shared attributes: `name`, `cwd`, `excludeFromRunAll`, `interactive`, `interpreter`.

## Security Considerations

This plugin executes code and commands in real terminal sessions on your system. This means:

- **File access is not limited to your vault.** Commands can read, write, or delete any files your user account has access to.
- **Commands run with your permissions.** The plugin does not sandbox execution — it runs as you.
- **Be careful with untrusted runbooks.** Only execute code blocks from sources you trust.

This is by design — the plugin is meant for DevOps, SRE, and development workflows where full system access is necessary. If you need sandboxed execution, consider running Obsidian in a container or VM.

## Known Limitations

- **Python compound statements** — `if/else`, `try/except`, `for/else` blocks may not work correctly in the interactive REPL when split across indentation transitions. The REPL inserts blank lines between indent changes, which can prematurely terminate compound statements before `else:`, `elif:`, `except:`, or `finally:`. Wrap complex control flow in functions as a workaround.

- **JS/TS `const` redeclaration** — Re-running a code block that declares `const` variables will fail because the REPL scope already has the binding. Use `let` or `var` for blocks you plan to re-run. This is a fundamental REPL limitation.

- **Desktop only** — This plugin uses `child_process` and PTY sessions. It does not work on Obsidian Mobile.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Plugin API | Obsidian API |
| Editor | CodeMirror 6 |
| Terminal | xterm.js |
| PTY | Python 3 `pty` module |
| Build | esbuild |
| Testing | Vitest |

## License

[Apache-2.0](LICENSE)
