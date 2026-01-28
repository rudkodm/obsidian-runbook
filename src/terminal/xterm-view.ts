import { ItemView, WorkspaceLeaf } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { PythonPtySession } from "../shell/python-pty-session";
import { ShellSession } from "../shell/session";

export const XTERM_VIEW_TYPE = "runbook-xterm";

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
	private sessionName: string;
	private usingFallback: boolean = false;
	private static sessionCounter = 0;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		XtermView.sessionCounter++;
		this.sessionName = `Terminal ${XtermView.sessionCounter}`;
	}

	getViewType(): string {
		return XTERM_VIEW_TYPE;
	}

	getDisplayText(): string {
		return `Terminal: ${XtermView.sessionCounter}`;
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

		// Check if Python PTY is available (Unix with Python 3) or use fallback
		if (PythonPtySession.isAvailable()) {
			await this.initPythonPtySession();
		} else {
			console.log("Runbook: Python PTY not available, using fallback shell");
			await this.initFallbackSession();
		}

		// Handle resize
		this.resizeObserver = new ResizeObserver(() => {
			this.fit();
		});
		this.resizeObserver.observe(this.terminalEl);

		// Focus terminal
		this.terminal.focus();
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
			this.ptySession?.write(data);
		});

		// Handle PTY exit
		this.ptySession.on("exit", (code: number) => {
			this.terminal?.write(`\r\n[Process exited with code ${code}]\r\n`);
		});

		// Start PTY
		try {
			this.ptySession.spawn();
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
			console.log("Runbook: Fallback shell spawned, pid:", this.fallbackSession.pid);
			this.showPrompt();
		} catch (err) {
			console.error("Runbook: Failed to spawn fallback shell:", err);
			this.terminal?.write(`\x1b[31m[Failed to start shell: ${err}]\x1b[0m\r\n`);
		}
	}

	/**
	 * Show command prompt in fallback mode
	 */
	private showPrompt(): void {
		// Green prompt for better visibility (iTerm2-like)
		this.terminal?.write("\x1b[32m$\x1b[0m ");
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
			this.terminal?.write(`\x1b[31m${err}\x1b[0m\r\n`);
		}
		this.showPrompt();
	}

	async onClose(): Promise<void> {
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
	}

	/**
	 * Fit terminal to container
	 */
	fit(): void {
		if (this.fitAddon && this.terminal) {
			this.fitAddon.fit();
			// Only resize PTY if using PTY mode
			if (this.ptySession && !this.usingFallback) {
				this.ptySession.resize(this.terminal.cols, this.terminal.rows);
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
	 * Write text to the terminal (for code block execution)
	 */
	writeCommand(command: string): void {
		if (this.usingFallback) {
			// Fallback mode - execute and show output
			if (!this.fallbackSession?.isAlive) {
				throw new Error("Shell session not running");
			}
			// Clear current line, show prompt with command, then execute
			this.terminal?.write(`\r\x1b[K\x1b[32m$\x1b[0m ${command}\r\n`);
			// Execute asynchronously
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
			// ANSI colors - using reasonable defaults that work with dark themes
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
