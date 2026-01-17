import { App, Editor, MarkdownView, Notice, Platform, Plugin, PluginManifest, WorkspaceLeaf } from "obsidian";
import { ShellSession } from "./shell/session";
import {
	getCodeBlockContext,
	getTextToExecute,
	isLanguageSupported,
	advanceCursorToNextLine,
	stripPromptPrefix,
} from "./editor/code-block";
import { createCodeBlockProcessor } from "./ui/code-block-processor";
import { TerminalManager, TerminalView, TERMINAL_VIEW_TYPE, TERMINAL_STYLES } from "./terminal";

/**
 * Obsidian Runbook Plugin
 *
 * Executes code blocks directly from markdown notes using a persistent shell session.
 */
export default class RunbookPlugin extends Plugin {
	private session: ShellSession | null = null;
	private terminalManager: TerminalManager | null = null;
	private styleEl: HTMLStyleElement | null = null;

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

		// Inject terminal styles
		this.injectStyles();

		// Initialize terminal manager
		this.terminalManager = new TerminalManager();

		// Register terminal view (each instance is a separate terminal)
		this.registerView(TERMINAL_VIEW_TYPE, (leaf) => {
			return new TerminalView(leaf, this.terminalManager!);
		});

		// Initialize shell session (for backward compatibility)
		this.session = new ShellSession();

		// Set up session event listeners
		this.session.on("stateChange", (state) => {
			console.log(`Runbook: Shell state changed to: ${state}`);
		});

		this.session.on("error", (error) => {
			console.error("Runbook: Shell error:", error);
			new Notice(`Shell error: ${error.message}`);
		});

		// Main command: Execute line or selection (Shift + Cmd/Ctrl + Enter)
		this.addCommand({
			id: "execute-line-or-selection",
			name: "Execute line or selection",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.executeLineOrSelection(editor);
			},
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "Enter",
				},
			],
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

		// Auto-start shell session
		this.session.spawn();
		console.log("Runbook: Shell auto-started", { pid: this.session.pid });

		// Register code block post-processor for reading view
		this.registerMarkdownPostProcessor(
			createCodeBlockProcessor({
				getSession: () => this.session,
				getTerminalView: () => this.getActiveTerminalView(),
			})
		);
		console.log("Runbook: Code block processor registered");

		new Notice(`Runbook: Ready (PID: ${this.session.pid})`);
		console.log("Runbook: Plugin loaded successfully");
	}

	async onunload() {
		console.log("Runbook: Plugin unloading...");
		if (this.session) {
			this.session.kill();
			this.session = null;
		}
		if (this.terminalManager) {
			this.terminalManager.destroy();
			this.terminalManager = null;
		}
		if (this.styleEl) {
			this.styleEl.remove();
			this.styleEl = null;
		}
		// Detach terminal leaves
		this.app.workspace.detachLeavesOfType(TERMINAL_VIEW_TYPE);
	}

	/**
	 * Execute the current line or selection in the code block
	 */
	private async executeLineOrSelection(editor: Editor): Promise<void> {
		// Get code block context
		const context = getCodeBlockContext(editor);

		if (!context.inCodeBlock || !context.codeBlock) {
			new Notice("Not inside a code block");
			return;
		}

		// Check if language is supported
		if (!isLanguageSupported(context.codeBlock.language)) {
			new Notice(`Unsupported language: ${context.codeBlock.language || "(none)"}`);
			return;
		}

		// Get text to execute
		const textInfo = getTextToExecute(editor);
		if (!textInfo) {
			new Notice("No text to execute (empty line)");
			return;
		}

		// Strip prompt prefix if present ($ or >)
		const command = stripPromptPrefix(textInfo.text);

		console.log("Runbook: Executing", {
			command,
			isSelection: textInfo.isSelection,
			language: context.codeBlock.language,
		});

		try {
			let output: string;

			// Get or create terminal view
			let terminalView = this.getActiveTerminalView();
			if (!terminalView) {
				// Auto-create a terminal if none exists
				await this.createNewTerminal();
				// Wait for view to be ready
				await new Promise(resolve => setTimeout(resolve, 200));
				terminalView = this.getActiveTerminalView();
			}

			if (terminalView) {
				output = await terminalView.executeFromCodeBlock(
					command,
					context.codeBlock.language || "bash"
				);
			} else {
				new Notice("Failed to create terminal");
				return;
			}

			console.log("Runbook: Execution complete", { output });

			// Auto-advance cursor if not a selection
			if (!textInfo.isSelection) {
				advanceCursorToNextLine(editor);
			}
		} catch (err) {
			new Notice(`Execution failed: ${err}`);
			console.error("Runbook: Execution failed", err);
		}
	}

	/**
	 * Toggle the terminal panel
	 */
	private async toggleTerminal(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);

		if (existing.length > 0) {
			// Close the terminal
			existing.forEach((leaf) => leaf.detach());
		} else {
			// Open the terminal in the bottom panel
			await this.activateTerminalView();
		}
	}

	/**
	 * Activate the terminal view
	 */
	private async activateTerminalView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			// Create new leaf in the bottom/right split
			leaf = workspace.getLeaf("split", "horizontal");
			if (leaf) {
				await leaf.setViewState({
					type: TERMINAL_VIEW_TYPE,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
			// Focus the input
			const view = leaf.view as TerminalView;
			if (view && view.focusInput) {
				view.focusInput();
			}
		}
	}

	/**
	 * Create a new terminal tab (as a new Obsidian tab)
	 */
	private async createNewTerminal(): Promise<void> {
		const { workspace } = this.app;

		// Create a new leaf (tab) for the terminal
		const leaf = workspace.getLeaf("tab");
		if (leaf) {
			await leaf.setViewState({
				type: TERMINAL_VIEW_TYPE,
				active: true,
			});
			workspace.revealLeaf(leaf);

			// Focus the terminal
			const view = leaf.view as TerminalView;
			if (view && view.focusInput) {
				setTimeout(() => view.focusInput(), 100);
			}
		}
	}

	/**
	 * Inject terminal styles into the document
	 */
	private injectStyles(): void {
		this.styleEl = document.createElement("style");
		this.styleEl.id = "runbook-terminal-styles";
		this.styleEl.textContent = TERMINAL_STYLES;
		document.head.appendChild(this.styleEl);
	}

	/**
	 * Get the active terminal view (the one with the active session)
	 */
	getActiveTerminalView(): TerminalView | null {
		const leaves = this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);
		if (leaves.length === 0) return null;

		// Find the terminal with the active session
		const activeSessionId = this.terminalManager?.activeSessionId;
		for (const leaf of leaves) {
			const view = leaf.view as TerminalView;
			if (view && view.getSessionId && view.getSessionId() === activeSessionId) {
				return view;
			}
		}

		// Fallback to first terminal view
		const firstView = leaves[0].view as TerminalView;
		return firstView || null;
	}

	/**
	 * Get the terminal manager (for external access)
	 */
	getTerminalManager(): TerminalManager | null {
		return this.terminalManager;
	}
}
