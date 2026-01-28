import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { PythonPtySession } from "../shell/python-pty-session";
import { ShellSession } from "../shell/session";

export const XTERM_VIEW_TYPE = "runbook-xterm";

/** ANSI escape codes for terminal output formatting */
const ANSI = {
	RESET: "\x1b[0m",
	RED: "\x1b[31m",
	GREEN: "\x1b[32m",
	YELLOW: "\x1b[33m",
	GRAY: "\x1b[90m",
	CLEAR_LINE: "\x1b[K",
} as const;

/** Terminal session state */
export type TerminalState = "starting" | "running" | "exited" | "error";

/** Event callbacks for terminal state changes */
export interface TerminalStateCallback {
	(terminalId: number, state: TerminalState): void;
}

// Global state change listeners
const stateListeners: Set<TerminalStateCallback> = new Set();

/**
 * Subscribe to terminal state changes
 */
export function onTerminalStateChange(callback: TerminalStateCallback): () => void {
	stateListeners.add(callback);
	return () => stateListeners.delete(callback);
}

/**
 * Terminal view using xterm.js with PTY support (or fallback to basic shell)
 *
 * PTY modes:
 * 1. PythonPtySession - Uses Python's pty module (macOS/Linux with Python 3)
 * 2. ShellSession fallback - Basic shell without PTY (Windows or if Python unavailable)
 */
export class XtermView extends ItemView {
	private terminal: Terminal | null = null;
	private fitAddon: FitAddon | null = null;
	private ptySession: PythonPtySession | null = null;
	private fallbackSession: ShellSession | null = null;
	private terminalEl: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private usingFallback: boolean = false;
	private _state: TerminalState = "starting";
	private autoRestart: boolean = true;

	// Resize tracking
	private lastCols: number = 0;
	private lastRows: number = 0;
	private resizeTimeout: ReturnType<typeof setTimeout> | null = null;

	// Terminal identification
	private static nextId = 1;
	readonly terminalId: number;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.terminalId = XtermView.nextId++;
	}

	get state(): TerminalState {
		return this._state;
	}

	getViewType(): string {
		return XTERM_VIEW_TYPE;
	}

	getDisplayText(): string {
		return `Terminal ${this.terminalId}`;
	}

	getIcon(): string {
		return "terminal";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("runbook-xterm-view");

		// Create terminal container
		this.terminalEl = container.createDiv("runbook-xterm-container");

		// Initialize xterm.js
		this.terminal = new Terminal({
			cursorBlink: true,
			fontSize: 13,
			fontFamily: "var(--font-monospace), Menlo, Monaco, 'Courier New', monospace",
			theme: this.getTheme(),
			allowProposedApi: true,
		});

		// Add fit addon for auto-resize
		this.fitAddon = new FitAddon();
		this.terminal.loadAddon(this.fitAddon);

		// Add web links addon for clickable URLs
		this.terminal.loadAddon(new WebLinksAddon());

		// Open terminal in container
		this.terminal.open(this.terminalEl);

		// Initial fit
		this.fitAddon.fit();

		// Start the shell session
		await this.startSession();

		// Handle resize with debouncing
		this.resizeObserver = new ResizeObserver(() => {
			this.debouncedFit();
		});
		this.resizeObserver.observe(this.terminalEl);

		// Focus terminal
		this.terminal.focus();
	}

	/**
	 * Start the shell session (PTY or fallback)
	 */
	private async startSession(): Promise<void> {
		this.setState("starting");

		// Check if Python PTY is available (Unix with Python 3) or use fallback
		if (PythonPtySession.isAvailable()) {
			await this.initPythonPtySession();
		} else {
			console.log("Runbook: Python PTY not available, using fallback shell");
			await this.initFallbackSession();
		}
	}

	/**
	 * Initialize PTY session using Python's pty module
	 */
	private async initPythonPtySession(): Promise<void> {
		this.usingFallback = false;

		// Create Python-based PTY session
		this.ptySession = new PythonPtySession({
			cols: this.terminal!.cols,
			rows: this.terminal!.rows,
		});

		// Connect PTY output to terminal
		this.ptySession.on("data", (data: string) => {
			this.terminal?.write(data);
		});

		// Connect terminal input to PTY
		this.terminal!.onData((data: string) => {
			if (this.ptySession?.isAlive) {
				this.ptySession.write(data);
			}
		});

		// Handle PTY exit - offer restart
		this.ptySession.on("exit", (code: number) => {
			this.handleSessionExit(code);
		});

		// Handle PTY errors
		this.ptySession.on("error", (err: Error) => {
			this.handleSessionError(err);
		});

		// Start PTY
		try {
			this.ptySession.spawn();
			this.setState("running");
			console.log("Runbook: Python PTY spawned successfully, pid:", this.ptySession.pid);
		} catch (err) {
			console.error("Runbook: Failed to spawn Python PTY, falling back:", err);
			this.ptySession = null;
			await this.initFallbackSession();
		}
	}

	/**
	 * Initialize fallback session (basic shell without PTY)
	 */
	private async initFallbackSession(): Promise<void> {
		this.usingFallback = true;

		// Create fallback shell session
		this.fallbackSession = new ShellSession();

		// Handle terminal input - collect line and execute on Enter
		let inputBuffer = "";
		this.terminal!.onData((data: string) => {
			if (data === "\r") {
				// Enter pressed - execute command
				this.terminal?.write("\r\n");
				if (inputBuffer.trim()) {
					this.executeInFallback(inputBuffer);
				} else {
					this.showPrompt();
				}
				inputBuffer = "";
			} else if (data === "\x7f" || data === "\b") {
				// Backspace
				if (inputBuffer.length > 0) {
					inputBuffer = inputBuffer.slice(0, -1);
					this.terminal?.write("\b \b");
				}
			} else if (data === "\x03") {
				// Ctrl+C
				this.terminal?.write("^C\r\n");
				inputBuffer = "";
				this.showPrompt();
			} else if (data >= " " || data === "\t") {
				// Regular character
				inputBuffer += data;
				this.terminal?.write(data);
			}
		});

		// Start shell
		try {
			this.fallbackSession.spawn();
			this.setState("running");
			console.log("Runbook: Fallback shell spawned, pid:", this.fallbackSession.pid);
			this.showPrompt();
		} catch (err) {
			console.error("Runbook: Failed to spawn fallback shell:", err);
			this.terminal?.write(`${ANSI.RED}[Failed to start shell: ${err}]${ANSI.RESET}\r\n`);
			this.setState("error");
		}
	}

	/**
	 * Handle session exit - show message and optionally restart
	 */
	private handleSessionExit(code: number): void {
		this.setState("exited");
		this.terminal?.write(`\r\n${ANSI.YELLOW}[Process exited with code ${code}]${ANSI.RESET}\r\n`);

		if (this.autoRestart) {
			this.terminal?.write(`${ANSI.GRAY}Restarting shell...${ANSI.RESET}\r\n`);
			// Small delay before restart
			setTimeout(() => {
				if (this._state === "exited") {
					this.restartSession();
				}
			}, 500);
		} else {
			this.terminal?.write(`${ANSI.GRAY}Press Enter to restart shell${ANSI.RESET}\r\n`);
			this.setupRestartOnEnter();
		}
	}

	/**
	 * Handle session error
	 */
	private handleSessionError(err: Error): void {
		this.setState("error");
		this.terminal?.write(`\r\n${ANSI.RED}[Shell error: ${err.message}]${ANSI.RESET}\r\n`);
		new Notice(`Terminal error: ${err.message}`);

		this.terminal?.write(`${ANSI.GRAY}Press Enter to restart shell${ANSI.RESET}\r\n`);
		this.setupRestartOnEnter();
	}

	/**
	 * Setup one-time Enter key handler to restart session
	 */
	private setupRestartOnEnter(): void {
		const disposable = this.terminal?.onData((data: string) => {
			if (data === "\r") {
				disposable?.dispose();
				this.restartSession();
			}
		});
	}

	/**
	 * Restart the shell session
	 */
	async restartSession(): Promise<void> {
		// Clean up existing sessions
		this.ptySession?.kill();
		this.fallbackSession?.kill();
		this.ptySession = null;
		this.fallbackSession = null;

		this.terminal?.write("\r\n");
		await this.startSession();
	}

	/**
	 * Show command prompt in fallback mode
	 */
	private showPrompt(): void {
		this.terminal?.write(`${ANSI.GREEN}$${ANSI.RESET} `);
	}

	/**
	 * Execute command in fallback mode
	 */
	private async executeInFallback(command: string): Promise<void> {
		if (!this.fallbackSession?.isAlive) {
			this.terminal?.write("[Shell not running]\r\n");
			this.showPrompt();
			return;
		}

		try {
			const output = await this.fallbackSession.execute(command);
			if (output) {
				this.terminal?.write(output.replace(/\n/g, "\r\n") + "\r\n");
			}
		} catch (err) {
			this.terminal?.write(`${ANSI.RED}${err}${ANSI.RESET}\r\n`);
		}
		this.showPrompt();
	}

	async onClose(): Promise<void> {
		// Disable auto-restart during close
		this.autoRestart = false;

		// Clean up timers
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
			this.resizeTimeout = null;
		}

		// Clean up
		this.resizeObserver?.disconnect();
		this.ptySession?.kill();
		this.fallbackSession?.kill();
		this.terminal?.dispose();

		this.resizeObserver = null;
		this.ptySession = null;
		this.fallbackSession = null;
		this.terminal = null;
		this.terminalEl = null;

		// Notify listeners of terminal closure
		this.setState("exited");
	}

	/**
	 * Debounced fit - waits for resize to settle before updating PTY
	 */
	private debouncedFit(): void {
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
		}
		// Immediately fit xterm (visual update)
		this.fitAddon?.fit();

		// Debounce the PTY resize to avoid flooding
		this.resizeTimeout = setTimeout(() => {
			this.resizeTimeout = null;
			this.syncPtySize();
		}, 100);
	}

	/**
	 * Fit terminal to container (immediate)
	 */
	fit(): void {
		if (this.fitAddon && this.terminal) {
			this.fitAddon.fit();
			this.syncPtySize();
		}
	}

	/**
	 * Sync PTY size with terminal dimensions (only if changed)
	 */
	private syncPtySize(): void {
		if (!this.terminal) return;

		const cols = this.terminal.cols;
		const rows = this.terminal.rows;

		// Only resize if dimensions actually changed
		if (cols !== this.lastCols || rows !== this.lastRows) {
			this.lastCols = cols;
			this.lastRows = rows;

			if (this.ptySession?.isAlive && !this.usingFallback) {
				this.ptySession.resize(cols, rows);
			}
		}
	}

	/**
	 * Focus the terminal
	 */
	focus(): void {
		this.terminal?.focus();
	}

	/**
	 * Check if terminal session is running
	 */
	get isRunning(): boolean {
		return this._state === "running";
	}

	/**
	 * Write text to the terminal (for code block execution)
	 */
	writeCommand(command: string): void {
		if (this.usingFallback) {
			// Fallback mode - execute and show output
			if (!this.fallbackSession?.isAlive) {
				throw new Error("Shell session not running");
			}
			// Clear current line, show prompt with command, then execute
			this.terminal?.write(`\r${ANSI.CLEAR_LINE}${ANSI.GREEN}$${ANSI.RESET} ${command}\r\n`);
			this.executeInFallback(command);
		} else {
			// PTY mode - write directly
			if (!this.ptySession) {
				throw new Error("No PTY session available");
			}
			if (!this.ptySession.isAlive) {
				throw new Error("PTY session not running");
			}
			this.ptySession.write(command + "\n");
		}
	}

	/**
	 * Update terminal state and notify listeners
	 */
	private setState(state: TerminalState): void {
		if (this._state !== state) {
			this._state = state;
			// Notify all listeners
			for (const listener of stateListeners) {
				try {
					listener(this.terminalId, state);
				} catch (err) {
					console.error("Runbook: State listener error:", err);
				}
			}
		}
	}

	/**
	 * Get theme colors from Obsidian CSS variables
	 */
	private getTheme(): Record<string, string> {
		const styles = getComputedStyle(document.body);

		return {
			background: styles.getPropertyValue("--background-primary").trim() || "#1e1e1e",
			foreground: styles.getPropertyValue("--text-normal").trim() || "#d4d4d4",
			cursor: styles.getPropertyValue("--text-accent").trim() || "#569cd6",
			cursorAccent: styles.getPropertyValue("--background-primary").trim() || "#1e1e1e",
			selectionBackground: styles.getPropertyValue("--text-selection").trim() || "#264f78",
			// ANSI colors
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
	 * Update theme when Obsidian theme changes
	 */
	updateTheme(): void {
		if (this.terminal) {
			this.terminal.options.theme = this.getTheme();
		}
	}
}
