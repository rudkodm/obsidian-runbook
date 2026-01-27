import { App, Editor, MarkdownView, Notice, Platform, Plugin, PluginManifest, WorkspaceLeaf } from "obsidian";
import {
	getCodeBlockContext,
	getTextToExecute,
	isLanguageSupported,
	advanceCursorToNextLine,
	stripPromptPrefix,
} from "./editor/code-block";
import { createCodeBlockProcessor } from "./ui/code-block-processor";
import { XtermView, XTERM_VIEW_TYPE } from "./terminal/xterm-view";
import { XTERM_STYLES } from "./terminal/xterm-styles";

/**
 * Obsidian Runbook Plugin
 *
 * Executes code blocks directly from markdown notes using a real terminal (xterm.js + node-pty).
 */
export default class RunbookPlugin extends Plugin {
	private styleEl: HTMLStyleElement | null = null;
	private xtermStyleEl: HTMLStyleElement | null = null;

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

		// Inject styles (including xterm CSS)
		this.injectStyles();

		// Register xterm terminal view (each instance is a separate terminal with PTY)
		this.registerView(XTERM_VIEW_TYPE, (leaf) => {
			return new XtermView(leaf);
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

		// Register code block post-processor for reading view
		this.registerMarkdownPostProcessor(
			createCodeBlockProcessor({
				getTerminalView: () => this.getActiveXtermView(),
				createTerminal: () => this.createNewTerminal(),
			})
		);
		console.log("Runbook: Code block processor registered");

		new Notice("Runbook: Ready");
		console.log("Runbook: Plugin loaded successfully");
	}

	async onunload() {
		console.log("Runbook: Plugin unloading...");
		if (this.styleEl) {
			this.styleEl.remove();
			this.styleEl = null;
		}
		if (this.xtermStyleEl) {
			this.xtermStyleEl.remove();
			this.xtermStyleEl = null;
		}
		// Detach terminal leaves (this will trigger onClose which kills PTY)
		this.app.workspace.detachLeavesOfType(XTERM_VIEW_TYPE);
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
			// Get or create terminal view
			let xtermView = this.getActiveXtermView();
			if (!xtermView) {
				// Auto-create a terminal if none exists
				await this.createNewTerminal();
				// Wait for view to be ready
				await new Promise(resolve => setTimeout(resolve, 300));
				xtermView = this.getActiveXtermView();
			}

			if (xtermView) {
				// Write command to terminal
				xtermView.writeCommand(command);
			} else {
				new Notice("Failed to create terminal");
				return;
			}

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
		const existing = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);

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
		const leaves = workspace.getLeavesOfType(XTERM_VIEW_TYPE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			// Create new leaf in the bottom/right split
			leaf = workspace.getLeaf("split", "horizontal");
			if (leaf) {
				await leaf.setViewState({
					type: XTERM_VIEW_TYPE,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
			// Focus the terminal
			const view = leaf.view as XtermView;
			if (view && view.focus) {
				view.focus();
			}
		}
	}

	/**
	 * Create a new terminal (opens at bottom as a horizontal split)
	 */
	private async createNewTerminal(): Promise<void> {
		const { workspace } = this.app;

		// Create a new leaf at the bottom (horizontal split)
		const leaf = workspace.getLeaf("split", "horizontal");
		if (leaf) {
			await leaf.setViewState({
				type: XTERM_VIEW_TYPE,
				active: true,
			});
			workspace.revealLeaf(leaf);

			// Focus the terminal
			const view = leaf.view as XtermView;
			if (view && view.focus) {
				setTimeout(() => view.focus(), 100);
			}
		}
	}

	/**
	 * Inject terminal styles into the document
	 */
	private injectStyles(): void {
		// Inject xterm.js styles
		this.styleEl = document.createElement("style");
		this.styleEl.id = "runbook-xterm-styles";
		this.styleEl.textContent = XTERM_STYLES;
		document.head.appendChild(this.styleEl);

		// Load xterm.js CSS from node_modules
		this.loadXtermCss();
	}

	/**
	 * Load xterm.js CSS dynamically
	 */
	private loadXtermCss(): void {
		// The xterm CSS is bundled, so we need to inject it
		// This is a minimal version of xterm.css
		const xtermCss = `
			.xterm {
				cursor: text;
				position: relative;
				user-select: none;
				-ms-user-select: none;
				-webkit-user-select: none;
			}
			.xterm.focus, .xterm:focus {
				outline: none;
			}
			.xterm .xterm-helpers {
				position: absolute;
				top: 0;
				z-index: 5;
			}
			.xterm .xterm-helper-textarea {
				padding: 0;
				border: 0;
				margin: 0;
				position: absolute;
				opacity: 0;
				left: -9999em;
				top: 0;
				width: 0;
				height: 0;
				z-index: -5;
				white-space: nowrap;
				overflow: hidden;
				resize: none;
			}
			.xterm .composition-view {
				background: #000;
				color: #FFF;
				display: none;
				position: absolute;
				white-space: nowrap;
				z-index: 1;
			}
			.xterm .composition-view.active {
				display: block;
			}
			.xterm .xterm-viewport {
				background-color: #000;
				overflow-y: scroll;
				cursor: default;
				position: absolute;
				right: 0;
				left: 0;
				top: 0;
				bottom: 0;
			}
			.xterm .xterm-screen {
				position: relative;
			}
			.xterm .xterm-screen canvas {
				position: absolute;
				left: 0;
				top: 0;
			}
			.xterm .xterm-scroll-area {
				visibility: hidden;
			}
			.xterm-char-measure-element {
				display: inline-block;
				visibility: hidden;
				position: absolute;
				top: 0;
				left: -9999em;
				line-height: normal;
			}
			.xterm.enable-mouse-events {
				cursor: default;
			}
			.xterm.xterm-cursor-pointer, .xterm .xterm-cursor-pointer {
				cursor: pointer;
			}
			.xterm.column-select.focus {
				cursor: crosshair;
			}
			.xterm .xterm-accessibility, .xterm .xterm-message {
				position: absolute;
				left: 0;
				top: 0;
				bottom: 0;
				right: 0;
				z-index: 10;
				color: transparent;
				pointer-events: none;
			}
			.xterm .live-region {
				position: absolute;
				left: -9999px;
				width: 1px;
				height: 1px;
				overflow: hidden;
			}
			.xterm-dim {
				opacity: 1 !important;
			}
			.xterm-underline-1 { text-decoration: underline; }
			.xterm-underline-2 { text-decoration: double underline; }
			.xterm-underline-3 { text-decoration: wavy underline; }
			.xterm-underline-4 { text-decoration: dotted underline; }
			.xterm-underline-5 { text-decoration: dashed underline; }
			.xterm-overline { text-decoration: overline; }
			.xterm-overline.xterm-underline-1 { text-decoration: overline underline; }
			.xterm-overline.xterm-underline-2 { text-decoration: overline double underline; }
			.xterm-overline.xterm-underline-3 { text-decoration: overline wavy underline; }
			.xterm-overline.xterm-underline-4 { text-decoration: overline dotted underline; }
			.xterm-overline.xterm-underline-5 { text-decoration: overline dashed underline; }
			.xterm-strikethrough { text-decoration: line-through; }
			.xterm-screen .xterm-decoration-container .xterm-decoration { z-index: 6; position: absolute; }
			.xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer { z-index: 7; }
			.xterm-decoration-overview-ruler { z-index: 8; position: absolute; top: 0; right: 0; pointer-events: none; }
			.xterm-decoration-top { z-index: 2; position: relative; }
		`;

		this.xtermStyleEl = document.createElement("style");
		this.xtermStyleEl.id = "runbook-xterm-lib-styles";
		this.xtermStyleEl.textContent = xtermCss;
		document.head.appendChild(this.xtermStyleEl);
	}

	/**
	 * Get the active xterm view
	 */
	getActiveXtermView(): XtermView | null {
		const leaves = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		if (leaves.length === 0) return null;

		// Return the first (most recently focused) terminal
		const firstView = leaves[0].view as XtermView;
		return firstView || null;
	}
}
