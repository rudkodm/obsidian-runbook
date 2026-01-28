import { App, Editor, MarkdownView, Notice, Platform, Plugin, PluginManifest, WorkspaceLeaf } from "obsidian";
import {
	getCodeBlockContext,
	getTextToExecute,
	isLanguageSupported,
	advanceCursorToNextLine,
	stripPromptPrefix,
} from "./editor/code-block";
import { createCodeBlockProcessor } from "./ui/code-block-processor";
import { XtermView, XTERM_VIEW_TYPE, onTerminalStateChange, TerminalState } from "./terminal/xterm-view";
import { DevConsoleView, DEV_CONSOLE_VIEW_TYPE } from "./terminal/dev-console-view";
import { XTERM_STYLES, XTERM_LIB_CSS } from "./terminal/xterm-styles";

/**
 * Obsidian Runbook Plugin
 *
 * Executes code blocks directly from markdown notes using a real terminal (xterm.js + Python PTY).
 */
export default class RunbookPlugin extends Plugin {
	private styleEl: HTMLStyleElement | null = null;
	private statusBarEl: HTMLElement | null = null;
	private unsubscribeStateChange: (() => void) | null = null;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
	}

	async onload() {
		// Desktop-only check
		if (Platform.isMobile) {
			new Notice("Runbook plugin is desktop-only and cannot run on mobile.");
			return;
		}

		console.log("Runbook: Plugin loading...");

		// Inject styles
		this.injectStyles();

		// Setup status bar
		this.setupStatusBar();

		// Register terminal views
		this.registerViews();

		// Register commands
		this.registerCommands();

		// Register code block post-processor for reading view
		this.registerMarkdownPostProcessor(
			createCodeBlockProcessor({
				getTerminalView: () => this.getActiveXtermView(),
				createTerminal: () => this.createNewTerminal(),
			})
		);

		console.log("Runbook: Plugin loaded successfully");
	}

	async onunload() {
		console.log("Runbook: Plugin unloading...");

		// Cleanup subscriptions
		this.unsubscribeStateChange?.();
		this.unsubscribeStateChange = null;

		// Remove styles
		this.styleEl?.remove();
		this.styleEl = null;

		// Detach all terminal views (triggers onClose which kills PTY sessions)
		this.app.workspace.detachLeavesOfType(XTERM_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(DEV_CONSOLE_VIEW_TYPE);

		console.log("Runbook: Plugin unloaded");
	}

	/**
	 * Register terminal and console views
	 */
	private registerViews(): void {
		// xterm terminal view (each instance is a separate terminal with PTY)
		this.registerView(XTERM_VIEW_TYPE, (leaf) => new XtermView(leaf));

		// Developer console view
		this.registerView(DEV_CONSOLE_VIEW_TYPE, (leaf) => new DevConsoleView(leaf));
	}

	/**
	 * Register all plugin commands
	 */
	private registerCommands(): void {
		// Execute line or selection (Shift + Cmd/Ctrl + Enter)
		this.addCommand({
			id: "execute-line-or-selection",
			name: "Execute line or selection",
			editorCallback: (editor: Editor) => this.executeLineOrSelection(editor),
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "Enter" }],
		});

		// Terminal commands
		this.addCommand({
			id: "toggle-terminal",
			name: "Toggle terminal panel",
			callback: () => this.toggleTerminal(),
		});

		this.addCommand({
			id: "new-terminal-session",
			name: "New terminal session",
			callback: () => this.createNewTerminal(),
		});

		this.addCommand({
			id: "open-dev-console",
			name: "Open developer console",
			callback: () => this.openDevConsole(),
		});
	}

	/**
	 * Setup status bar item showing terminal count
	 */
	private setupStatusBar(): void {
		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass("runbook-status-bar-item");
		this.statusBarEl.setAttribute("aria-label", "Runbook Terminal");

		// Click to toggle terminal
		this.statusBarEl.addEventListener("click", () => this.toggleTerminal());

		// Subscribe to terminal state changes
		this.unsubscribeStateChange = onTerminalStateChange(() => {
			this.updateStatusBar();
		});

		// Also update on workspace layout changes (terminal open/close)
		this.registerEvent(
			this.app.workspace.on("layout-change", () => this.updateStatusBar())
		);

		// Initial update
		this.updateStatusBar();
	}

	/**
	 * Update status bar to show terminal count and status
	 */
	private updateStatusBar(): void {
		if (!this.statusBarEl) return;

		const terminals = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		const count = terminals.length;

		// Count running terminals
		const runningCount = terminals.filter((leaf) => {
			const view = leaf.view as XtermView;
			return view?.isRunning;
		}).length;

		// Update content and styling
		if (count === 0) {
			this.statusBarEl.innerHTML = `<span class="status-icon">></span>`;
			this.statusBarEl.removeClass("has-terminals");
			this.statusBarEl.addClass("no-terminals");
			this.statusBarEl.setAttribute("aria-label", "No terminals - click to open");
		} else {
			const statusIcon = runningCount === count ? ">" : "!";
			this.statusBarEl.innerHTML = `<span class="status-icon">${statusIcon}</span><span>${count}</span>`;
			this.statusBarEl.addClass("has-terminals");
			this.statusBarEl.removeClass("no-terminals");
			this.statusBarEl.setAttribute(
				"aria-label",
				`${count} terminal${count > 1 ? "s" : ""} (${runningCount} running) - click to toggle`
			);
		}
	}

	/**
	 * Execute the current line or selection in the code block
	 */
	private async executeLineOrSelection(editor: Editor): Promise<void> {
		const context = getCodeBlockContext(editor);

		if (!context.inCodeBlock || !context.codeBlock) {
			new Notice("Not inside a code block");
			return;
		}

		if (!isLanguageSupported(context.codeBlock.language)) {
			new Notice(`Unsupported language: ${context.codeBlock.language || "(none)"}`);
			return;
		}

		const textInfo = getTextToExecute(editor);
		if (!textInfo) {
			new Notice("No text to execute (empty line)");
			return;
		}

		const command = stripPromptPrefix(textInfo.text);

		try {
			let xtermView = this.getActiveXtermView();
			if (!xtermView) {
				await this.createNewTerminal();
				await new Promise((resolve) => setTimeout(resolve, 300));
				xtermView = this.getActiveXtermView();
			}

			if (xtermView) {
				xtermView.writeCommand(command);
			} else {
				new Notice("Failed to create terminal");
				return;
			}

			if (!textInfo.isSelection) {
				advanceCursorToNextLine(editor);
			}
		} catch (err) {
			new Notice(`Execution failed: ${err}`);
			console.error("Runbook: Execution failed", err);
		}
	}

	/**
	 * Toggle terminal panel visibility
	 */
	private async toggleTerminal(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);

		if (existing.length > 0) {
			existing.forEach((leaf) => leaf.detach());
		} else {
			await this.createNewTerminal();
		}
	}

	/**
	 * Create a new terminal session
	 */
	private async createNewTerminal(): Promise<void> {
		const leaf = this.app.workspace.getLeaf("split", "horizontal");
		if (leaf) {
			await leaf.setViewState({ type: XTERM_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);

			const view = leaf.view as XtermView;
			if (view?.focus) {
				setTimeout(() => view.focus(), 100);
			}
		}
	}

	/**
	 * Open or focus the developer console
	 */
	private async openDevConsole(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(DEV_CONSOLE_VIEW_TYPE);

		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			const view = existing[0].view as DevConsoleView;
			view?.focus?.();
			return;
		}

		const leaf = this.app.workspace.getLeaf("split", "vertical");
		if (leaf) {
			await leaf.setViewState({ type: DEV_CONSOLE_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);

			const view = leaf.view as DevConsoleView;
			if (view?.focus) {
				setTimeout(() => view.focus(), 100);
			}
		}
	}

	/**
	 * Inject all required styles
	 */
	private injectStyles(): void {
		this.styleEl = document.createElement("style");
		this.styleEl.id = "runbook-styles";
		this.styleEl.textContent = XTERM_LIB_CSS + XTERM_STYLES;
		document.head.appendChild(this.styleEl);
	}

	/**
	 * Get the active xterm view (first available terminal)
	 */
	getActiveXtermView(): XtermView | null {
		const leaves = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		if (leaves.length === 0) return null;
		return (leaves[0].view as XtermView) || null;
	}
}
