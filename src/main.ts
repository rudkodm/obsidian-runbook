import { Editor, MarkdownView, Notice, Platform, Plugin } from "obsidian";
import {
	getCodeBlockContext,
	getTextToExecute,
	isLanguageSupported,
	isShellLanguage,
	buildInterpreterCommand,
	advanceCursorToNextLine,
	stripPromptPrefix,
	collectCodeBlocks,
	parseFrontmatter,
	getInterpreterType,
	normalizeLanguage,
	CodeBlockAttributes,
	CodeBlockInfo,
} from "./editor/code-block";
import { createCodeBlockProcessor } from "./ui/code-block-processor";
import { XtermView, XTERM_VIEW_TYPE, onTerminalStateChange } from "./terminal/xterm-view";
import { DevConsoleView, DEV_CONSOLE_VIEW_TYPE } from "./terminal/dev-console-view";
import { XTERM_STYLES, XTERM_LIB_CSS } from "./terminal/xterm-styles";
import { SessionManager } from "./runbook/session-manager";
import { RunbookSettings, DEFAULT_SETTINGS, RunbookSettingsTab } from "./settings";

/**
 * Obsidian Runbook Plugin
 *
 * Executes code blocks directly from markdown notes using a real terminal (xterm.js + Python PTY).
 */
export default class RunbookPlugin extends Plugin {
	settings: RunbookSettings = DEFAULT_SETTINGS;
	private styleEl: HTMLStyleElement | null = null;
	private statusBarEl: HTMLElement | null = null;
	private unsubscribeStateChange: (() => void) | null = null;
	private sessionManager: SessionManager | null = null;

	async onload() {
		// Desktop-only check
		if (Platform.isMobile) {
			new Notice("Runbook plugin is desktop-only and cannot run on mobile.");
			return;
		}

		console.debug("Runbook: Plugin loading...");

		// Load settings
		await this.loadSettings();

		// Initialize session manager
		this.sessionManager = new SessionManager(this.app, this.settings);

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
				executeBlock: (code, language, attributes) =>
					this.executeCodeBlock(code, language, attributes),
			})
		);

		// Add settings tab
		this.addSettingTab(new RunbookSettingsTab(this.app, this));

		console.debug("Runbook: Plugin loaded successfully");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onunload() {
		console.debug("Runbook: Plugin unloading...");

		// Cleanup session manager
		this.sessionManager?.cleanupAll();
		this.sessionManager = null;

		// Cleanup subscriptions
		this.unsubscribeStateChange?.();
		this.unsubscribeStateChange = null;

		// Remove styles
		this.styleEl?.remove();
		this.styleEl = null;

		// Detach all terminal views (triggers onClose which kills PTY sessions)
		this.app.workspace.detachLeavesOfType(XTERM_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(DEV_CONSOLE_VIEW_TYPE);

		console.debug("Runbook: Plugin unloaded");
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
		// Execute line or selection
		// Note: Users can assign their own hotkey via Settings > Hotkeys
		this.addCommand({
			id: "execute-line-or-selection",
			name: "Execute line or selection",
			editorCallback: (editor: Editor) => this.executeLineOrSelection(editor),
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

		// Run All Cells (execute entire runbook)
		this.addCommand({
			id: "run-all",
			name: "Run all",
			callback: () => this.runAllCells(),
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
		this.statusBarEl.addEventListener("click", () => {
			void this.toggleTerminal();
		});

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
		this.statusBarEl.replaceChildren();
		if (count === 0) {
			this.statusBarEl.createSpan({ cls: "status-icon", text: ">" });
			this.statusBarEl.removeClass("has-terminals");
			this.statusBarEl.addClass("no-terminals");
			this.statusBarEl.setAttribute("aria-label", "No terminals - click to open");
		} else {
			const statusIcon = runningCount === count ? ">" : "!";
			this.statusBarEl.createSpan({ cls: "status-icon", text: statusIcon });
			this.statusBarEl.createSpan({ text: String(count) });
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

		const language = context.codeBlock.language;
		const attributes = context.codeBlock.attributes;
		const isInteractive = attributes.interactive !== false;
		const cwd = attributes.cwd;

		try {
			if (!isShellLanguage(language) && isInteractive && getInterpreterType(language)) {
				// Interactive REPL: send raw code to persistent interpreter session
				const xtermView = await this.getOrCreateInterpreterForActiveNote(
					language, cwd, attributes.interpreter,
				);
				if (!xtermView) {
					new Notice("Failed to create interpreter session");
					return;
				}
				xtermView.writeReplCode(textInfo.text);
			} else {
				// Shell or non-interactive: use shell terminal
				let command: string;
				if (isShellLanguage(language)) {
					command = stripPromptPrefix(textInfo.text);
				} else {
					command = buildInterpreterCommand(textInfo.text, language);
				}

				const xtermView = await this.getOrCreateTerminalForActiveNote(cwd);
				if (!xtermView) {
					new Notice("Failed to create terminal");
					return;
				}
				if (cwd) {
					xtermView.writeCommand(`cd ${cwd}`);
					await new Promise(resolve => setTimeout(resolve, 100));
				}
				xtermView.writeCommand(command);
			}

			if (!textInfo.isSelection && this.settings.autoAdvanceCursor) {
				advanceCursorToNextLine(editor);
			}
		} catch (err) {
			new Notice(`Execution failed: ${err}`);
			console.error("Runbook: Execution failed", err);
		}
	}

	/**
	 * Get or create a terminal for the currently active note.
	 * Uses session isolation - each note gets its own terminal.
	 * @param cwd - Optional working directory for new sessions (used at spawn time)
	 */
	private async getOrCreateTerminalForActiveNote(cwd?: string): Promise<XtermView | null> {
		const activeFile = this.app.workspace.getActiveFile();

		if (activeFile && this.sessionManager) {
			return this.sessionManager.getOrCreateSession(activeFile.path, cwd);
		}

		// Fallback: use any available terminal or create a new one
		let xtermView = this.getActiveXtermView();
		if (!xtermView) {
			await this.createNewTerminal();
			await new Promise(resolve => setTimeout(resolve, 300));
			xtermView = this.getActiveXtermView();
		}
		return xtermView;
	}

	/**
	 * Get or create an interpreter REPL session for the active note + language.
	 */
	private async getOrCreateInterpreterForActiveNote(
		language: string,
		cwd?: string,
		interpreterPath?: string,
	): Promise<XtermView | null> {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && this.sessionManager) {
			return this.sessionManager.getOrCreateInterpreterSession(
				activeFile.path, language, cwd, interpreterPath,
			);
		}
		return null;
	}

	/**
	 * Execute a code block with full language-aware routing, cwd, and session isolation.
	 * Used by both the play button (code-block-processor) and Run All.
	 */
	private async executeCodeBlock(code: string, language: string, attributes: CodeBlockAttributes): Promise<void> {
		const isInteractive = attributes.interactive !== false;
		const isNonShell = !isShellLanguage(language);

		if (isNonShell && isInteractive && getInterpreterType(language)) {
			// Interactive REPL: send raw code to persistent interpreter session
			const xtermView = await this.getOrCreateInterpreterForActiveNote(
				language, attributes.cwd, attributes.interpreter,
			);
			if (!xtermView) {
				new Notice("Failed to create interpreter session");
				return;
			}
			xtermView.writeReplCode(code);
		} else {
			// Shell or non-interactive one-shot
			const xtermView = await this.getOrCreateTerminalForActiveNote(attributes.cwd);
			if (!xtermView) {
				new Notice("Failed to create terminal");
				return;
			}

			if (attributes.cwd) {
				xtermView.writeCommand(`cd ${attributes.cwd}`);
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			if (isShellLanguage(language)) {
				const lines = code.split("\n").filter(line => line.trim().length > 0);
				for (const line of lines) {
					const command = stripPromptPrefix(line.trim());
					if (!command) continue;
					xtermView.writeCommand(command);
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			} else {
				const command = buildInterpreterCommand(code, language);
				xtermView.writeCommand(command);
			}
		}
	}

	/**
	 * Run all code blocks in the current note sequentially
	 */
	private async runAllCells(): Promise<void> {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice("No active markdown note");
			return;
		}

		const file = activeView.file;
		if (!file) {
			new Notice("No file associated with current view");
			return;
		}

		const content = activeView.editor.getValue();
		const frontmatter = parseFrontmatter(content);
		const allBlocks = collectCodeBlocks(content);

		// Filter to supported languages and respect excludeFromRunAll
		const blocks = allBlocks.filter(block => {
			if (!isLanguageSupported(block.language)) return false;
			if (block.attributes.excludeFromRunAll) return false;
			return true;
		});

		if (blocks.length === 0) {
			new Notice("No executable code blocks found in this note");
			return;
		}

		// Always create fresh isolated sessions for Run All
		const noteName = file.basename || file.name;
		const runAllCwd = frontmatter.cwd;

		if (!this.sessionManager) {
			new Notice("Session manager not available");
			return;
		}

		// Create fresh shell session for shell blocks / non-interactive blocks
		const shellView = await this.sessionManager.createFreshSession(
			`Run All: ${noteName}`,
			runAllCwd,
		);
		if (!shellView) {
			new Notice("Failed to create terminal");
			return;
		}

		// Reveal the shell terminal
		const leaves = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		for (const leaf of leaves) {
			if (leaf.view === shellView) {
				this.app.workspace.revealLeaf(leaf);
				break;
			}
		}

		// Track fresh interpreter sessions per language (created lazily)
		const interpViews: Map<string, XtermView> = new Map();

		new Notice(`Running ${blocks.length} code block(s)...`);

		// Execute blocks sequentially
		for (let i = 0; i < blocks.length; i++) {
			const block = blocks[i];
			const cellName = block.attributes.name || `cell ${i + 1}`;
			const isInteractive = block.attributes.interactive !== false;
			const isNonShell = !isShellLanguage(block.language);
			const interpType = getInterpreterType(block.language);
			const cwd = block.attributes.cwd || runAllCwd;

			if (isNonShell && isInteractive && interpType) {
				// Interactive interpreter: route to per-language REPL
				const langKey = normalizeLanguage(block.language);
				let interpView = interpViews.get(langKey);
				if (!interpView) {
					interpView = await this.sessionManager.createFreshInterpreterSession(
						`Run All: ${noteName} (${langKey})`,
						block.language,
						cwd,
						block.attributes.interpreter as string | undefined,
					);
					if (!interpView) {
						new Notice(`Failed to create ${langKey} interpreter session`);
						continue;
					}
					interpViews.set(langKey, interpView);
					// Wait for REPL to be ready
					await new Promise(resolve => setTimeout(resolve, 500));
				}

				// Show progress in shell terminal
				shellView.writeCommand(`echo "--- Running ${cellName} (${i + 1}/${blocks.length}) [${langKey}] ---"`);
				await new Promise(resolve => setTimeout(resolve, 100));

				interpView.writeReplCode(block.content);
				await new Promise(resolve => setTimeout(resolve, 500));
			} else {
				// Shell or non-interactive one-shot: use shell terminal
				shellView.writeCommand(`echo "--- Running ${cellName} (${i + 1}/${blocks.length}) ---"`);
				await new Promise(resolve => setTimeout(resolve, 150));

				if (cwd) {
					shellView.writeCommand(`cd ${cwd}`);
					await new Promise(resolve => setTimeout(resolve, 100));
				}

				if (isShellLanguage(block.language)) {
					const lines = block.content.split("\n").filter(line => line.trim().length > 0);
					for (const line of lines) {
						const command = stripPromptPrefix(line.trim());
						if (!command) continue;
						shellView.writeCommand(command);
						await new Promise(resolve => setTimeout(resolve, 200));
					}
				} else {
					const command = buildInterpreterCommand(block.content, block.language);
					shellView.writeCommand(command);
					await new Promise(resolve => setTimeout(resolve, 500));
				}
			}
		}

		new Notice(`Finished running ${blocks.length} code block(s)`);
	}

	/**
	 * Toggle terminal panel visibility.
	 * If terminal is focused, switch back to the note.
	 * If terminal exists but not focused, reveal it.
	 * If no terminal exists, create one.
	 */
	private async toggleTerminal(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);

		if (existing.length > 0) {
			// Check if a terminal is currently the active view
			const activeView = this.app.workspace.getActiveViewOfType(XtermView);

			if (activeView) {
				// Terminal is focused — switch back to most recent markdown note
				const mdLeaves = this.app.workspace.getLeavesOfType("markdown");
				if (mdLeaves.length > 0) {
					this.app.workspace.setActiveLeaf(mdLeaves[0], { focus: true });
				}
			} else {
				// Terminal exists but not focused — reveal it
				this.app.workspace.revealLeaf(existing[0]);
				const view = existing[0].view as XtermView;
				view?.focus?.();
			}
		} else {
			await this.createNewTerminal();
		}
	}

	/**
	 * Create a new terminal session
	 */
	private async createNewTerminal(): Promise<void> {
		const leaf = this.sessionManager
			? this.sessionManager.getTerminalLeaf()
			: this.app.workspace.getLeaf("split", "horizontal");
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
