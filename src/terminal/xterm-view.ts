import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { PythonPtySession } from "../shell/python-pty-session";
import { ShellSession } from "../shell/session";
import { InterpreterType } from "../shell/types";
import { BaseInterpreterSession } from "../shell/interpreter-base";
import { createInterpreterSession } from "../shell/interpreters";
import { ANSI, ANSI_COLORS } from "../ui/theme/ansi-colors";
import { getXtermTheme, getTerminalFontFamily } from "../ui/theme/theme-utils";

export const XTERM_VIEW_TYPE = "runbook-xterm";

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
	private interpreterSession: BaseInterpreterSession | null = null;
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
	private noteName: string | null = null;
	private initialCwd: string | null = null;

	// Interpreter session config (set via pendingInterpreter before onOpen)
	private interpreterConfig: { type: InterpreterType; interpreterPath?: string } | null = null;
	private shellPath: string | null = null;
	private fontSize: number = 13;

	/**
	 * Pending config consumed by the next onOpen call.
	 * Set before setViewState so that onOpen picks it up at spawn time.
	 * Single-threaded JS guarantees nothing else consumes it in between.
	 */
	static pendingCwd: string | null = null;
	static pendingShellPath: string | null = null;
	static pendingFontSize: number = 13;
	static pendingInterpreter: { type: InterpreterType; interpreterPath?: string } | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.terminalId = XtermView.nextId++;
	}

	/**
	 * Set the note name for this terminal (used for per-note sessions)
	 */
	setNoteName(name: string): void {
		this.noteName = name;
		// Trigger Obsidian to refresh the tab/header text
		 
		(this.leaf as any).updateHeader?.();
	}

	get state(): TerminalState {
		return this._state;
	}

	getViewType(): string {
		return XTERM_VIEW_TYPE;
	}

	getDisplayText(): string {
		const typeLabel = this.interpreterSession
			? this.interpreterSession.displayName
			: "Terminal";
		if (this.noteName) {
			return `${typeLabel}: ${this.noteName}`;
		}
		return `${typeLabel} ${this.terminalId}`;
	}

	getIcon(): string {
		return "terminal";
	}

	onOpen(): void {
		// Consume pending config (set before setViewState)
		this.initialCwd = XtermView.pendingCwd;
		XtermView.pendingCwd = null;
		this.shellPath = XtermView.pendingShellPath;
		XtermView.pendingShellPath = null;
		this.fontSize = XtermView.pendingFontSize;
		XtermView.pendingFontSize = 13;
		this.interpreterConfig = XtermView.pendingInterpreter;
		XtermView.pendingInterpreter = null;

		const container = this.contentEl;
		container.empty();
		container.addClass("runbook-xterm-view");

		// Create terminal container
		this.terminalEl = container.createDiv("runbook-xterm-container");

		// Initialize xterm.js
		this.terminal = new Terminal({
			cursorBlink: true,
			fontSize: this.fontSize,
			fontFamily: getTerminalFontFamily(),
			theme: getXtermTheme(),
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
		void this.startSession();

		// Handle resize with debouncing
		this.resizeObserver = new ResizeObserver(() => {
			this.debouncedFit();
		});
		this.resizeObserver.observe(this.terminalEl);

		// Focus terminal
		this.terminal.focus();
	}

	/**
	 * Whether this view hosts an interpreter REPL (vs a shell)
	 */
	get isInterpreterSession(): boolean {
		return this.interpreterSession !== null;
	}

	/**
	 * Start the session (interpreter REPL, shell PTY, or fallback)
	 */
	private async startSession(): Promise<void> {
		this.setState("starting");

		if (this.interpreterConfig) {
			// Interpreter REPL mode
			await this.initInterpreterSession();
		} else if (PythonPtySession.isAvailable()) {
			// Shell PTY mode
			await this.initPythonPtySession();
		} else {
			console.debug("Runbook: Python PTY not available, using fallback shell");
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
			cwd: this.initialCwd || undefined,
			shell: this.shellPath || undefined,
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
			console.debug("Runbook: Python PTY spawned successfully, pid:", this.ptySession.pid);
		} catch (err) {
			console.error("Runbook: Failed to spawn Python PTY, falling back:", err);
			this.ptySession = null;
			await this.initFallbackSession();
		}
	}

	/**
	 * Initialize an interactive interpreter REPL session (python3, node, ts-node)
	 */
	private async initInterpreterSession(): Promise<void> {
		this.usingFallback = false;

		this.interpreterSession = createInterpreterSession(this.interpreterConfig!.type, {
			cols: this.terminal!.cols,
			rows: this.terminal!.rows,
			cwd: this.initialCwd || undefined,
			interpreterPath: this.interpreterConfig!.interpreterPath,
		});

		// Connect interpreter output to terminal
		this.interpreterSession.on("data", (data: string) => {
			this.terminal?.write(data);
		});

		// Connect terminal input to interpreter
		this.terminal!.onData((data: string) => {
			if (this.interpreterSession?.isAlive) {
				this.interpreterSession.write(data);
			}
		});

		// Handle interpreter exit
		this.interpreterSession.on("exit", (code: number) => {
			this.handleSessionExit(code);
		});

		// Handle interpreter errors
		this.interpreterSession.on("error", (err: Error) => {
			this.handleSessionError(err);
		});

		try {
			this.interpreterSession.spawn();
			this.setState("running");
			// Update header now that interpreterSession is set (affects getDisplayText)
			 
			(this.leaf as any).updateHeader?.();
			console.debug(
				`Runbook: Interpreter (${this.interpreterConfig!.type}) spawned, pid:`,
				this.interpreterSession.pid,
			);
		} catch (err) {
			console.error("Runbook: Failed to spawn interpreter session:", err);
			this.interpreterSession = null;
			// For interpreter failures, don't fall back to shell — show error
			this.terminal?.write(
				`\r\n\x1b[31m[Failed to start ${this.interpreterConfig!.type} interpreter: ${err}]\x1b[0m\r\n`,
			);
			this.setState("error");
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
					void this.executeInFallback(inputBuffer);
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
			console.debug("Runbook: Fallback shell spawned, pid:", this.fallbackSession.pid);
			this.showPrompt();
		} catch (err) {
			console.error("Runbook: Failed to spawn fallback shell:", err);
			this.terminal?.write(`${ANSI.RED}[Failed to start shell: ${err}]${ANSI.RESET}\r\n`);
			this.setState("error");
		}
	}

	/**
	 * Handle session exit - show message and optionally restart.
	 * Interpreter sessions never auto-restart to avoid infinite loops
	 * when the interpreter crashes immediately (e.g. bad tsconfig).
	 */
	private handleSessionExit(code: number): void {
		this.setState("exited");
		this.terminal?.write(`\r\n${ANSI.YELLOW}[Process exited with code ${code}]${ANSI.RESET}\r\n`);

		if (this.interpreterSession) {
			// Interpreter sessions: never auto-restart, offer manual restart
			this.terminal?.write(`${ANSI.GRAY}Press Enter to restart${ANSI.RESET}\r\n`);
			this.setupRestartOnEnter();
		} else if (this.autoRestart) {
			this.terminal?.write(`${ANSI.GRAY}Restarting shell...${ANSI.RESET}\r\n`);
			// Small delay before restart
			setTimeout(() => {
				if (this._state === "exited") {
					void this.restartSession();
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
				void this.restartSession();
			}
		});
	}

	/**
	 * Restart the shell session
	 */
	async restartSession(): Promise<void> {
		// Clean up existing sessions
		this.ptySession?.kill();
		this.interpreterSession?.kill();
		this.fallbackSession?.kill();
		this.ptySession = null;
		this.interpreterSession = null;
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

	onClose(): void {
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
		this.interpreterSession?.kill();
		this.fallbackSession?.kill();
		this.terminal?.dispose();

		this.resizeObserver = null;
		this.ptySession = null;
		this.interpreterSession = null;
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

			if (this.interpreterSession?.isAlive) {
				this.interpreterSession.resize(cols, rows);
			} else if (this.ptySession?.isAlive && !this.usingFallback) {
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
	 * Write a command to the terminal (shell commands, interpreter one-shot commands)
	 */
	writeCommand(command: string): void {
		if (this.usingFallback) {
			// Fallback mode - execute and show output
			if (!this.fallbackSession?.isAlive) {
				throw new Error("Shell session not running");
			}
			this.terminal?.write(`\r${ANSI.CLEAR_LINE}${ANSI.GREEN}$${ANSI.RESET} ${command}\r\n`);
			void this.executeInFallback(command);
		} else if (this.interpreterSession?.isAlive) {
			// Interpreter mode - write directly to REPL
			this.interpreterSession.write(command + "\n");
		} else if (this.ptySession?.isAlive) {
			// Shell PTY mode - write directly
			this.ptySession.write(command + "\n");
		} else {
			throw new Error("No session available");
		}
	}

	/**
	 * Write code to an interpreter REPL with language-appropriate wrapping.
	 * Delegates to the interpreter session's wrapCode() for language-specific formatting.
	 */
	writeReplCode(code: string): void {
		if (!this.interpreterSession?.isAlive) {
			throw new Error("No interpreter session available");
		}
		const wrapped = this.interpreterSession.wrapCode(code);
		this.interpreterSession.write(wrapped);
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
	 * Update theme when Obsidian theme changes
	 */
	updateTheme(): void {
		if (this.terminal) {
			this.terminal.options.theme = getXtermTheme();
		}
	}
}
