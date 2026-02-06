import { ItemView, WorkspaceLeaf, App } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { getXtermTheme, getTerminalFontFamily } from "../ui/theme/theme-utils";

export const DEV_CONSOLE_VIEW_TYPE = "runbook-dev-console";

/**
 * Developer Console for debugging Obsidian
 * Provides an interactive JavaScript REPL with access to the Obsidian app
 */
export class DevConsoleView extends ItemView {
	private terminal: Terminal | null = null;
	private fitAddon: FitAddon | null = null;
	private terminalEl: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private inputBuffer: string = "";
	private cursorPos: number = 0; // Cursor position within inputBuffer
	private commandHistory: string[] = [];
	private historyIndex: number = -1;
	private originalConsole: {
		log: typeof console.log;
		warn: typeof console.warn;
		error: typeof console.error;
		info: typeof console.info;
	};

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		// Store original console methods
		this.originalConsole = {
			log: console.log.bind(console),
			warn: console.warn.bind(console),
			error: console.error.bind(console),
			info: console.info.bind(console),
		};
	}

	getViewType(): string {
		return DEV_CONSOLE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Developer console";
	}

	getIcon(): string {
		return "code";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("runbook-dev-console-view");

		// Create terminal container
		this.terminalEl = container.createDiv("runbook-dev-console-container");

		// Initialize xterm.js
		this.terminal = new Terminal({
			cursorBlink: true,
			fontSize: 13,
			fontFamily: getTerminalFontFamily(),
			theme: getXtermTheme(),
			allowProposedApi: true,
			convertEol: true,
		});

		// Add fit addon
		this.fitAddon = new FitAddon();
		this.terminal.loadAddon(this.fitAddon);

		// Open terminal
		this.terminal.open(this.terminalEl);
		this.fitAddon.fit();

		// Show welcome message
		this.showWelcome();

		// Handle input
		this.terminal.onData((data: string) => this.handleInput(data));

		// Handle resize
		this.resizeObserver = new ResizeObserver(() => {
			this.fitAddon?.fit();
		});
		this.resizeObserver.observe(this.terminalEl);

		// Intercept console methods
		this.interceptConsole();

		// Show prompt
		this.showPrompt();

		// Focus
		this.terminal.focus();
	}

	async onClose(): Promise<void> {
		// Restore console methods
		this.restoreConsole();

		// Cleanup
		this.resizeObserver?.disconnect();
		this.terminal?.dispose();

		this.resizeObserver = null;
		this.terminal = null;
		this.terminalEl = null;
	}

	private showWelcome(): void {
		const lines = [
			"\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m",
			"\x1b[36m║\x1b[0m  \x1b[1;33mObsidian Developer Console\x1b[0m                              \x1b[36m║\x1b[0m",
			"\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m",
			"",
			"Type \x1b[32mhelp()\x1b[0m for available commands and objects.",
			"Type \x1b[32mhelp.examples()\x1b[0m for usage examples.",
			"",
		];

		for (const line of lines) {
			this.terminal?.writeln(line);
		}
	}

	private showHelp(topic?: string): void {
		switch (topic) {
			case "app":
				this.showHelpApp();
				break;
			case "workspace":
				this.showHelpWorkspace();
				break;
			case "vault":
				this.showHelpVault();
				break;
			case "plugins":
				this.showHelpPlugins();
				break;
			case "examples":
				this.showHelpExamples();
				break;
			case "shortcuts":
				this.showHelpShortcuts();
				break;
			default:
				this.showHelpMain();
		}
	}

	private showHelpMain(): void {
		const lines = [
			"",
			"\x1b[1;36m━━━ Available Globals ━━━\x1b[0m",
			"",
			"  \x1b[32mapp\x1b[0m          Obsidian App instance (the main application)",
			"  \x1b[32mworkspace\x1b[0m    Workspace manager (views, leaves, layout)",
			"  \x1b[32mvault\x1b[0m        Vault API (files, folders, read/write)",
			"  \x1b[32mplugins\x1b[0m      Plugin manager (enabled plugins, settings)",
			"",
			"\x1b[1;36m━━━ Helper Functions ━━━\x1b[0m",
			"",
			"  \x1b[32mclear()\x1b[0m      Clear the console",
			"  \x1b[32mhelp()\x1b[0m       Show this help",
			"  \x1b[32mhelp.app()\x1b[0m   Show app object reference",
			"  \x1b[32mhelp.workspace()\x1b[0m  Show workspace reference",
			"  \x1b[32mhelp.vault()\x1b[0m     Show vault reference",
			"  \x1b[32mhelp.plugins()\x1b[0m   Show plugins reference",
			"  \x1b[32mhelp.examples()\x1b[0m  Show usage examples",
			"  \x1b[32mhelp.shortcuts()\x1b[0m Show keyboard shortcuts",
			"",
		];

		for (const line of lines) {
			this.terminal?.writeln(line);
		}
	}

	private showHelpApp(): void {
		const lines = [
			"",
			"\x1b[1;36m━━━ app - Obsidian App Instance ━━━\x1b[0m",
			"",
			"\x1b[33mProperties:\x1b[0m",
			"  app.vault           Vault instance",
			"  app.workspace       Workspace instance",
			"  app.metadataCache   Metadata cache for all files",
			"  app.fileManager     File operations manager",
			"  app.lastOpenFiles   Recently opened files",
			"",
			"\x1b[33mUseful methods:\x1b[0m",
			"  app.loadLocalStorage(key)      Load from local storage",
			"  app.saveLocalStorage(key, val) Save to local storage",
			"",
			"\x1b[33mExamples:\x1b[0m",
			"  \x1b[90m> app.vault.getName()\x1b[0m",
			"  \x1b[90m> app.metadataCache.getCache('path/to/file.md')\x1b[0m",
			"",
		];

		for (const line of lines) {
			this.terminal?.writeln(line);
		}
	}

	private showHelpWorkspace(): void {
		const lines = [
			"",
			"\x1b[1;36m━━━ workspace - Workspace Manager ━━━\x1b[0m",
			"",
			"\x1b[33mProperties:\x1b[0m",
			"  workspace.leftSplit       Left sidebar",
			"  workspace.rightSplit      Right sidebar",
			"  workspace.rootSplit       Main content area",
			"  workspace.activeLeaf      Currently active leaf",
			"",
			"\x1b[33mUseful methods:\x1b[0m",
			"  workspace.getActiveFile()         Get active file (TFile)",
			"  workspace.getActiveViewOfType(t)  Get active view of type",
			"  workspace.getLeavesOfType(type)   Get all leaves of type",
			"  workspace.openLinkText(link, src) Open a link",
			"  workspace.getLeaf(newLeaf)        Get or create leaf",
			"  workspace.revealLeaf(leaf)        Reveal a leaf",
			"  workspace.iterateAllLeaves(cb)    Iterate all leaves",
			"",
			"\x1b[33mExamples:\x1b[0m",
			"  \x1b[90m> workspace.getActiveFile()?.path\x1b[0m",
			"  \x1b[90m> workspace.getLeavesOfType('markdown')\x1b[0m",
			"  \x1b[90m> workspace.activeLeaf?.view?.getViewType()\x1b[0m",
			"",
		];

		for (const line of lines) {
			this.terminal?.writeln(line);
		}
	}

	private showHelpVault(): void {
		const lines = [
			"",
			"\x1b[1;36m━━━ vault - Vault API ━━━\x1b[0m",
			"",
			"\x1b[33mProperties:\x1b[0m",
			"  vault.adapter         File system adapter",
			"  vault.configDir       Config directory (.obsidian)",
			"",
			"\x1b[33mUseful methods:\x1b[0m",
			"  vault.getName()                  Get vault name",
			"  vault.getRoot()                  Get root folder",
			"  vault.getFiles()                 Get all files (TFile[])",
			"  vault.getMarkdownFiles()         Get all markdown files",
			"  vault.getAllLoadedFiles()        Get all loaded files",
			"  vault.getAbstractFileByPath(p)   Get file/folder by path",
			"  vault.read(file)                 Read file content",
			"  vault.cachedRead(file)           Read cached content",
			"  vault.modify(file, data)         Modify file content",
			"  vault.create(path, data)         Create new file",
			"  vault.createFolder(path)         Create new folder",
			"  vault.delete(file)               Delete file",
			"  vault.rename(file, newPath)      Rename/move file",
			"",
			"\x1b[33mExamples:\x1b[0m",
			"  \x1b[90m> vault.getFiles().length\x1b[0m",
			"  \x1b[90m> vault.getMarkdownFiles().map(f => f.basename)\x1b[0m",
			"  \x1b[90m> await vault.read(workspace.getActiveFile())\x1b[0m",
			"",
		];

		for (const line of lines) {
			this.terminal?.writeln(line);
		}
	}

	private showHelpPlugins(): void {
		const lines = [
			"",
			"\x1b[1;36m━━━ plugins - Plugin Manager ━━━\x1b[0m",
			"",
			"\x1b[33mProperties:\x1b[0m",
			"  plugins.manifests        All plugin manifests",
			"  plugins.plugins          Loaded plugin instances",
			"  plugins.enabledPlugins   Set of enabled plugin IDs",
			"",
			"\x1b[33mUseful methods:\x1b[0m",
			"  plugins.getPlugin(id)           Get plugin instance by ID",
			"  plugins.enablePlugin(id)        Enable a plugin",
			"  plugins.disablePlugin(id)       Disable a plugin",
			"  plugins.isEnabled(id)           Check if plugin enabled",
			"",
			"\x1b[33mExamples:\x1b[0m",
			"  \x1b[90m> Array.from(plugins.enabledPlugins)\x1b[0m",
			"  \x1b[90m> Object.keys(plugins.plugins)\x1b[0m",
			"  \x1b[90m> plugins.getPlugin('obsidian-runbook')\x1b[0m",
			"",
		];

		for (const line of lines) {
			this.terminal?.writeln(line);
		}
	}

	private showHelpExamples(): void {
		const lines = [
			"",
			"\x1b[1;36m━━━ Common Examples ━━━\x1b[0m",
			"",
			"\x1b[33mGet current file info:\x1b[0m",
			"  \x1b[90m> const file = workspace.getActiveFile()\x1b[0m",
			"  \x1b[90m> file?.path\x1b[0m",
			"  \x1b[90m> file?.stat\x1b[0m",
			"",
			"\x1b[33mRead file content:\x1b[0m",
			"  \x1b[90m> await vault.read(workspace.getActiveFile())\x1b[0m",
			"",
			"\x1b[33mList all markdown files:\x1b[0m",
			"  \x1b[90m> vault.getMarkdownFiles().map(f => f.path)\x1b[0m",
			"",
			"\x1b[33mSearch files by name:\x1b[0m",
			"  \x1b[90m> vault.getFiles().filter(f => f.name.includes('test'))\x1b[0m",
			"",
			"\x1b[33mGet file metadata/frontmatter:\x1b[0m",
			"  \x1b[90m> app.metadataCache.getFileCache(workspace.getActiveFile())\x1b[0m",
			"",
			"\x1b[33mGet all tags in vault:\x1b[0m",
			"  \x1b[90m> Object.keys(app.metadataCache.getTags())\x1b[0m",
			"",
			"\x1b[33mOpen a file:\x1b[0m",
			"  \x1b[90m> workspace.openLinkText('path/to/file.md', '')\x1b[0m",
			"",
			"\x1b[33mList enabled plugins:\x1b[0m",
			"  \x1b[90m> Array.from(plugins.enabledPlugins)\x1b[0m",
			"",
			"\x1b[33mGet plugin settings:\x1b[0m",
			"  \x1b[90m> plugins.getPlugin('plugin-id')?.settings\x1b[0m",
			"",
			"\x1b[33mReload a plugin:\x1b[0m",
			"  \x1b[90m> await plugins.disablePlugin('plugin-id')\x1b[0m",
			"  \x1b[90m> await plugins.enablePlugin('plugin-id')\x1b[0m",
			"",
		];

		for (const line of lines) {
			this.terminal?.writeln(line);
		}
	}

	private showHelpShortcuts(): void {
		const lines = [
			"",
			"\x1b[1;36m━━━ Keyboard Shortcuts ━━━\x1b[0m",
			"",
			"\x1b[33mNavigation:\x1b[0m",
			"  ↑            Previous command in history",
			"  ↓            Next command in history",
			"  ←            Move cursor left",
			"  →            Move cursor right",
			"  Ctrl+A       Jump to beginning of line",
			"  Ctrl+E       Jump to end of line",
			"",
			"\x1b[33mEditing:\x1b[0m",
			"  Backspace    Delete character before cursor",
			"  Delete       Delete character at cursor",
			"  Tab          Auto-complete",
			"",
			"\x1b[33mControl:\x1b[0m",
			"  Enter        Execute command",
			"  Ctrl+C       Cancel current input",
			"  Ctrl+L       Clear screen",
			"",
		];

		for (const line of lines) {
			this.terminal?.writeln(line);
		}
	}

	private showPrompt(): void {
		this.terminal?.write("\x1b[32m>\x1b[0m ");
	}

	private handleInput(data: string): void {
		switch (data) {
			case "\r": // Enter
				this.terminal?.write("\r\n");
				this.executeCommand();
				break;

			case "\x7f": // Backspace
			case "\b":
				if (this.cursorPos > 0) {
					// Delete character before cursor
					this.inputBuffer =
						this.inputBuffer.slice(0, this.cursorPos - 1) +
						this.inputBuffer.slice(this.cursorPos);
					this.cursorPos--;
					// Redraw line from cursor position
					this.redrawLine();
				}
				break;

			case "\x1b[3~": // Delete key
				if (this.cursorPos < this.inputBuffer.length) {
					// Delete character at cursor
					this.inputBuffer =
						this.inputBuffer.slice(0, this.cursorPos) +
						this.inputBuffer.slice(this.cursorPos + 1);
					this.redrawLine();
				}
				break;

			case "\x03": // Ctrl+C
				this.terminal?.write("^C\r\n");
				this.inputBuffer = "";
				this.cursorPos = 0;
				this.showPrompt();
				break;

			case "\x0c": // Ctrl+L
				this.terminal?.clear();
				this.showPrompt();
				this.terminal?.write(this.inputBuffer);
				// Move cursor to correct position
				if (this.cursorPos < this.inputBuffer.length) {
					this.terminal?.write(`\x1b[${this.inputBuffer.length - this.cursorPos}D`);
				}
				break;

			case "\x1b[A": // Up arrow - go back in history (older)
				this.navigateHistory(1);
				break;

			case "\x1b[B": // Down arrow - go forward in history (newer)
				this.navigateHistory(-1);
				break;

			case "\x1b[C": // Right arrow
				if (this.cursorPos < this.inputBuffer.length) {
					this.cursorPos++;
					this.terminal?.write("\x1b[C"); // Move cursor right
				}
				break;

			case "\x1b[D": // Left arrow
				if (this.cursorPos > 0) {
					this.cursorPos--;
					this.terminal?.write("\x1b[D"); // Move cursor left
				}
				break;

			case "\x1b[H": // Home (some terminals)
			case "\x01": // Ctrl+A (beginning of line)
				if (this.cursorPos > 0) {
					this.terminal?.write(`\x1b[${this.cursorPos}D`);
					this.cursorPos = 0;
				}
				break;

			case "\x1b[F": // End (some terminals)
			case "\x05": // Ctrl+E (end of line)
				if (this.cursorPos < this.inputBuffer.length) {
					this.terminal?.write(`\x1b[${this.inputBuffer.length - this.cursorPos}C`);
					this.cursorPos = this.inputBuffer.length;
				}
				break;

			case "\t": // Tab - auto-complete
				this.handleTabCompletion();
				break;

			default:
				if (data >= " ") {
					// Insert character at cursor position
					this.inputBuffer =
						this.inputBuffer.slice(0, this.cursorPos) +
						data +
						this.inputBuffer.slice(this.cursorPos);
					this.cursorPos += data.length;

					if (this.cursorPos === this.inputBuffer.length) {
						// Cursor at end, just write the character
						this.terminal?.write(data);
					} else {
						// Cursor in middle, redraw from cursor
						this.redrawLine();
					}
				}
		}
	}

	/**
	 * Redraw the current line (used after editing in the middle)
	 */
	private redrawLine(): void {
		// Move to start of input, clear to end, rewrite, reposition cursor
		this.terminal?.write("\r\x1b[K"); // Go to start, clear line
		this.showPrompt();
		this.terminal?.write(this.inputBuffer);
		// Move cursor back to correct position
		if (this.cursorPos < this.inputBuffer.length) {
			this.terminal?.write(`\x1b[${this.inputBuffer.length - this.cursorPos}D`);
		}
	}

	private navigateHistory(direction: number): void {
		if (this.commandHistory.length === 0) return;

		const newIndex = this.historyIndex + direction;

		if (newIndex < -1) return;
		if (newIndex >= this.commandHistory.length) return;

		// Clear current line
		this.terminal?.write("\r\x1b[K");
		this.showPrompt();

		if (newIndex === -1) {
			// Back to empty input
			this.inputBuffer = "";
			this.cursorPos = 0;
			this.historyIndex = -1;
		} else {
			this.historyIndex = newIndex;
			this.inputBuffer = this.commandHistory[this.commandHistory.length - 1 - newIndex];
			this.cursorPos = this.inputBuffer.length;
			this.terminal?.write(this.inputBuffer);
		}
	}

	/**
	 * Handle tab completion
	 */
	private handleTabCompletion(): void {
		// Get the text before cursor for completion
		const textBeforeCursor = this.inputBuffer.slice(0, this.cursorPos);

		// Find what we're trying to complete
		const match = textBeforeCursor.match(/([a-zA-Z_$][\w$]*(?:\.[\w$]*)*)\.?$/);
		if (!match) return;

		const expr = match[1];
		const parts = expr.split(".");
		const isPartial = !textBeforeCursor.endsWith(".");

		// Get completions
		const completions = this.getCompletions(parts, isPartial);
		if (completions.length === 0) return;

		if (completions.length === 1) {
			// Single completion - insert it
			const completion = completions[0];
			const partialLen = isPartial ? parts[parts.length - 1].length : 0;
			const toInsert = completion.slice(partialLen);

			if (toInsert) {
				this.inputBuffer =
					this.inputBuffer.slice(0, this.cursorPos) +
					toInsert +
					this.inputBuffer.slice(this.cursorPos);
				this.cursorPos += toInsert.length;
				this.redrawLine();
			}
		} else {
			// Multiple completions - show them
			this.terminal?.write("\r\n");

			// Find common prefix
			const commonPrefix = this.findCommonPrefix(completions);
			const partialLen = isPartial ? parts[parts.length - 1].length : 0;

			// Display completions (max 20)
			const displayCompletions = completions.slice(0, 20);
			const cols = 4;
			const colWidth = Math.max(...displayCompletions.map((c) => c.length)) + 2;

			for (let i = 0; i < displayCompletions.length; i += cols) {
				const row = displayCompletions.slice(i, i + cols);
				this.terminal?.writeln(row.map((c) => c.padEnd(colWidth)).join(""));
			}

			if (completions.length > 20) {
				this.terminal?.writeln(`\x1b[90m... and ${completions.length - 20} more\x1b[0m`);
			}

			// Insert common prefix if longer than what we have
			if (commonPrefix.length > partialLen) {
				const toInsert = commonPrefix.slice(partialLen);
				this.inputBuffer =
					this.inputBuffer.slice(0, this.cursorPos) +
					toInsert +
					this.inputBuffer.slice(this.cursorPos);
				this.cursorPos += toInsert.length;
			}

			// Redraw prompt with current input
			this.showPrompt();
			this.terminal?.write(this.inputBuffer);
			if (this.cursorPos < this.inputBuffer.length) {
				this.terminal?.write(`\x1b[${this.inputBuffer.length - this.cursorPos}D`);
			}
		}
	}

	/**
	 * Get completion candidates
	 */
	private getCompletions(parts: string[], isPartial: boolean): string[] {
		const globals: Record<string, unknown> = {
			app: this.app,
			workspace: this.app.workspace,
			vault: this.app.vault,
			plugins: (this.app as any).plugins,
			clear: () => {},
			help: Object.assign(() => {}, {
				app: () => {},
				workspace: () => {},
				vault: () => {},
				plugins: () => {},
				examples: () => {},
				shortcuts: () => {},
			}),
			console: console,
			Array: Array,
			Object: Object,
			String: String,
			Math: Math,
			JSON: JSON,
			Date: Date,
			Promise: Promise,
		};

		try {
			let obj: any = globals;

			// Navigate to the object we're completing on
			const navigateParts = isPartial ? parts.slice(0, -1) : parts;
			for (const part of navigateParts) {
				if (part === "") continue;
				if (obj && typeof obj === "object" && part in obj) {
					obj = obj[part];
				} else if (part in globals) {
					obj = globals[part];
				} else {
					return [];
				}
			}

			if (obj == null) return [];

			// Get all properties
			const props = new Set<string>();

			// Own properties
			if (typeof obj === "object") {
				Object.keys(obj).forEach((k) => props.add(k));
			}

			// Prototype chain properties
			let proto = Object.getPrototypeOf(obj);
			while (proto && proto !== Object.prototype) {
				Object.getOwnPropertyNames(proto).forEach((k) => {
					if (!k.startsWith("_")) props.add(k);
				});
				proto = Object.getPrototypeOf(proto);
			}

			// Filter by prefix if partial
			let results = Array.from(props);
			if (isPartial && parts.length > 0) {
				const prefix = parts[parts.length - 1].toLowerCase();
				results = results.filter((p) => p.toLowerCase().startsWith(prefix));
			}

			return results.sort();
		} catch {
			return [];
		}
	}

	/**
	 * Find common prefix among strings
	 */
	private findCommonPrefix(strings: string[]): string {
		if (strings.length === 0) return "";
		if (strings.length === 1) return strings[0];

		let prefix = strings[0];
		for (let i = 1; i < strings.length; i++) {
			while (!strings[i].startsWith(prefix)) {
				prefix = prefix.slice(0, -1);
				if (prefix === "") return "";
			}
		}
		return prefix;
	}

	private executeCommand(): void {
		const command = this.inputBuffer.trim();
		this.inputBuffer = "";
		this.cursorPos = 0;
		this.historyIndex = -1;

		if (!command) {
			this.showPrompt();
			return;
		}

		// Add to history
		if (this.commandHistory[this.commandHistory.length - 1] !== command) {
			this.commandHistory.push(command);
			// Limit history
			if (this.commandHistory.length > 100) {
				this.commandHistory.shift();
			}
		}

		// Handle special commands
		if (command === "clear()" || command === "clear") {
			this.terminal?.clear();
			this.showPrompt();
			return;
		}

		if (command === "help()" || command === "help") {
			this.showHelp();
			this.showPrompt();
			return;
		}

		// Handle help.xxx() commands
		const helpMatch = command.match(/^help\.(\w+)\(\)$/);
		if (helpMatch) {
			this.showHelp(helpMatch[1]);
			this.showPrompt();
			return;
		}

		// Execute JavaScript
		try {
			const result = this.evalInContext(command);
			this.displayResult(result);
		} catch (err) {
			this.displayError(err);
		}

		this.showPrompt();
	}

	private evalInContext(code: string): unknown {
		// Create context with useful globals
		const app = this.app;
		const workspace = app.workspace;
		const vault = app.vault;
		const plugins = (app as any).plugins;

		// Helper functions
		const clear = () => {
			this.terminal?.clear();
		};

		// Create help function with sub-functions
		const help = Object.assign(
			() => {
				this.showHelp();
			},
			{
				app: () => {
					this.showHelp("app");
				},
				workspace: () => {
					this.showHelp("workspace");
				},
				vault: () => {
					this.showHelp("vault");
				},
				plugins: () => {
					this.showHelp("plugins");
				},
				examples: () => {
					this.showHelp("examples");
				},
				shortcuts: () => {
					this.showHelp("shortcuts");
				},
			}
		);

		// Use Function constructor to create a function with the context
		// This is intentionally using eval-like behavior for the dev console
		const contextVars = { app, workspace, vault, plugins, clear, help };
		const keys = Object.keys(contextVars);
		const values = Object.values(contextVars);

		try {
			// Try as expression first
			const fn = new Function(...keys, `return (${code})`);
			return fn(...values);
		} catch {
			// Try as statement
			const fn = new Function(...keys, code);
			return fn(...values);
		}
	}

	private displayResult(result: unknown): void {
		if (result === undefined) {
			this.terminal?.writeln("\x1b[90mundefined\x1b[0m");
			return;
		}

		const formatted = this.formatValue(result);
		this.terminal?.writeln(formatted);

		// Also log to DevTools
		this.originalConsole.log("[DevConsole]", result);
	}

	private displayError(err: unknown): void {
		const message = err instanceof Error ? err.message : String(err);
		this.terminal?.writeln(`\x1b[31mError: ${message}\x1b[0m`);

		// Also log to DevTools
		this.originalConsole.error("[DevConsole]", err);
	}

	private formatValue(value: unknown, depth: number = 0): string {
		if (depth > 2) return "\x1b[90m[...]\x1b[0m";

		if (value === null) return "\x1b[90mnull\x1b[0m";
		if (value === undefined) return "\x1b[90mundefined\x1b[0m";

		const type = typeof value;

		switch (type) {
			case "string":
				return `\x1b[32m"${value}"\x1b[0m`;
			case "number":
				return `\x1b[33m${value}\x1b[0m`;
			case "boolean":
				return `\x1b[33m${value}\x1b[0m`;
			case "function":
				return `\x1b[36m[Function: ${(value as Function).name || "anonymous"}]\x1b[0m`;
			case "object":
				if (Array.isArray(value)) {
					if (value.length === 0) return "[]";
					if (value.length > 5) {
						return `[\x1b[90m${value.length} items\x1b[0m]`;
					}
					const items = value.map((v) => this.formatValue(v, depth + 1)).join(", ");
					return `[${items}]`;
				}

				// Handle special objects
				if (value instanceof Error) {
					return `\x1b[31m${value.name}: ${value.message}\x1b[0m`;
				}
				if (value instanceof Date) {
					return `\x1b[35m${value.toISOString()}\x1b[0m`;
				}
				if (value instanceof RegExp) {
					return `\x1b[35m${value.toString()}\x1b[0m`;
				}

				// Generic object
				const constructor = (value as object).constructor?.name;
				if (constructor && constructor !== "Object") {
					return `\x1b[36m[${constructor}]\x1b[0m`;
				}

				const keys = Object.keys(value as object);
				if (keys.length === 0) return "{}";
				if (keys.length > 5) {
					return `{\x1b[90m${keys.length} properties\x1b[0m}`;
				}

				const props = keys
					.slice(0, 3)
					.map((k) => `${k}: ${this.formatValue((value as Record<string, unknown>)[k], depth + 1)}`)
					.join(", ");
				return `{${props}${keys.length > 3 ? ", ..." : ""}}`;

			default:
				return String(value);
		}
	}

	private interceptConsole(): void {
		const writeToTerminal = (prefix: string, color: string, ...args: unknown[]) => {
			const message = args.map((a) => this.formatValue(a)).join(" ");
			this.terminal?.writeln(`${color}${prefix}\x1b[0m ${message}`);
		};

		console.log = (...args: unknown[]) => {
			this.originalConsole.log(...args);
			writeToTerminal("[LOG]", "\x1b[90m", ...args);
		};

		console.warn = (...args: unknown[]) => {
			this.originalConsole.warn(...args);
			writeToTerminal("[WARN]", "\x1b[33m", ...args);
		};

		console.error = (...args: unknown[]) => {
			this.originalConsole.error(...args);
			writeToTerminal("[ERROR]", "\x1b[31m", ...args);
		};

		console.info = (...args: unknown[]) => {
			this.originalConsole.info(...args);
			writeToTerminal("[INFO]", "\x1b[36m", ...args);
		};
	}

	private restoreConsole(): void {
		console.log = this.originalConsole.log;
		console.warn = this.originalConsole.warn;
		console.error = this.originalConsole.error;
		console.info = this.originalConsole.info;
	}

	/**
	 * Focus the console
	 */
	focus(): void {
		this.terminal?.focus();
	}
}
