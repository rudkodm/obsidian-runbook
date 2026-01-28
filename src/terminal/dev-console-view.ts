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
			"\x1b[90mAvailable globals:\x1b[0m",
			"  \x1b[32mapp\x1b[0m        - Obsidian App instance",
			"  \x1b[32mworkspace\x1b[0m  - app.workspace",
			"  \x1b[32mvault\x1b[0m      - app.vault",
			"  \x1b[32mplugins\x1b[0m    - app.plugins",
			"  \x1b[32mclear()\x1b[0m    - Clear console",
			"  \x1b[32mhelp()\x1b[0m     - Show this help",
			"",
			"\x1b[90mTips:\x1b[0m",
			"  • Use ↑/↓ to navigate command history",
			"  • Multi-line input: end line with \\",
			"  • Results are logged to DevTools console too",
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
			this.showWelcome();
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
		const help = () => {
			this.showWelcome();
		};

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
