import { ItemView, WorkspaceLeaf, App } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

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
		return "Developer Console";
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
			fontFamily: "var(--font-monospace), Menlo, Monaco, 'Courier New', monospace",
			theme: this.getTheme(),
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
			"",
			"\x1b[1;36m━━━ Keyboard Shortcuts ━━━\x1b[0m",
			"",
			"  \x1b[33m↑/↓\x1b[0m          Navigate command history",
			"  \x1b[33mCtrl+C\x1b[0m       Cancel current input",
			"  \x1b[33mCtrl+L\x1b[0m       Clear screen",
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
				if (this.inputBuffer.length > 0) {
					this.inputBuffer = this.inputBuffer.slice(0, -1);
					this.terminal?.write("\b \b");
				}
				break;

			case "\x03": // Ctrl+C
				this.terminal?.write("^C\r\n");
				this.inputBuffer = "";
				this.showPrompt();
				break;

			case "\x0c": // Ctrl+L
				this.terminal?.clear();
				this.showPrompt();
				break;

			case "\x1b[A": // Up arrow
				this.navigateHistory(-1);
				break;

			case "\x1b[B": // Down arrow
				this.navigateHistory(1);
				break;

			default:
				if (data >= " " || data === "\t") {
					this.inputBuffer += data;
					this.terminal?.write(data);
				}
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
			this.historyIndex = -1;
		} else {
			this.historyIndex = newIndex;
			this.inputBuffer = this.commandHistory[this.commandHistory.length - 1 - newIndex];
			this.terminal?.write(this.inputBuffer);
		}
	}

	private executeCommand(): void {
		const command = this.inputBuffer.trim();
		this.inputBuffer = "";
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

	private getTheme(): Record<string, string> {
		const styles = getComputedStyle(document.body);

		return {
			background: styles.getPropertyValue("--background-primary").trim() || "#1e1e1e",
			foreground: styles.getPropertyValue("--text-normal").trim() || "#d4d4d4",
			cursor: styles.getPropertyValue("--text-accent").trim() || "#569cd6",
			cursorAccent: styles.getPropertyValue("--background-primary").trim() || "#1e1e1e",
			selectionBackground: styles.getPropertyValue("--text-selection").trim() || "#264f78",
			black: "#000000",
			red: "#cd3131",
			green: "#0dbc79",
			yellow: "#e5e510",
			blue: "#2472c8",
			magenta: "#bc3fbc",
			cyan: "#11a8cd",
			white: "#e5e5e5",
			brightBlack: "#666666",
			brightRed: "#f14c4c",
			brightGreen: "#23d18b",
			brightYellow: "#f5f543",
			brightBlue: "#3b8eea",
			brightMagenta: "#d670d6",
			brightCyan: "#29b8db",
			brightWhite: "#ffffff",
		};
	}

	/**
	 * Focus the console
	 */
	focus(): void {
		this.terminal?.focus();
	}
}
