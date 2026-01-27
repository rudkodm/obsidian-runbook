import { ItemView, WorkspaceLeaf } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { PtySession } from "../shell/pty-session";

export const XTERM_VIEW_TYPE = "runbook-xterm";

/**
 * Terminal view using xterm.js with full PTY support
 */
export class XtermView extends ItemView {
	private terminal: Terminal | null = null;
	private fitAddon: FitAddon | null = null;
	private ptySession: PtySession | null = null;
	private terminalEl: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private sessionName: string;
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

		// Create PTY session
		this.ptySession = new PtySession({
			cols: this.terminal.cols,
			rows: this.terminal.rows,
		});

		// Connect PTY output to terminal
		this.ptySession.on("data", (data: string) => {
			this.terminal?.write(data);
		});

		// Connect terminal input to PTY
		this.terminal.onData((data: string) => {
			this.ptySession?.write(data);
		});

		// Handle PTY exit
		this.ptySession.on("exit", (code: number) => {
			this.terminal?.write(`\r\n[Process exited with code ${code}]\r\n`);
		});

		// Start PTY
		try {
			this.ptySession.spawn();
			console.log("Runbook: PTY spawned successfully, pid:", this.ptySession.pid);
		} catch (err) {
			console.error("Runbook: Failed to spawn PTY:", err);
			this.terminal?.write(`\r\n[Failed to start terminal: ${err}]\r\n`);
			this.terminal?.write("[This may be due to node-pty not being compatible with this Obsidian version]\r\n");
		}

		// Handle resize
		this.resizeObserver = new ResizeObserver(() => {
			this.fit();
		});
		this.resizeObserver.observe(this.terminalEl);

		// Focus terminal
		this.terminal.focus();
	}

	async onClose(): Promise<void> {
		// Clean up
		this.resizeObserver?.disconnect();
		this.ptySession?.kill();
		this.terminal?.dispose();

		this.resizeObserver = null;
		this.ptySession = null;
		this.terminal = null;
		this.terminalEl = null;
	}

	/**
	 * Fit terminal to container
	 */
	fit(): void {
		if (this.fitAddon && this.terminal && this.ptySession) {
			this.fitAddon.fit();
			this.ptySession.resize(this.terminal.cols, this.terminal.rows);
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
		if (!this.ptySession) {
			console.error("Runbook: No PTY session");
			throw new Error("No PTY session available");
		}
		if (!this.ptySession.isAlive) {
			console.error("Runbook: PTY session not alive, attempting to spawn...");
			try {
				this.ptySession.spawn();
			} catch (err) {
				console.error("Runbook: Failed to spawn PTY:", err);
				throw new Error(`Failed to start terminal: ${err}`);
			}
		}
		this.ptySession.write(command + "\n");
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
