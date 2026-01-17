import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { TerminalManager } from "./terminal-manager";

export const TERMINAL_VIEW_TYPE = "runbook-terminal";

/**
 * Terminal view component for Obsidian
 * Each instance is a separate terminal tab with its own shell session
 */
export class TerminalView extends ItemView {
	private manager: TerminalManager;
	private sessionId: string;
	private sessionName: string;
	private containerEl: HTMLElement;
	private outputEl: HTMLElement;
	private inputEl: HTMLInputElement;

	constructor(leaf: WorkspaceLeaf, manager: TerminalManager) {
		super(leaf);
		this.manager = manager;

		// Create a new session for this terminal view
		const { id, name } = manager.createSession();
		this.sessionId = id;
		this.sessionName = name;
	}

	getViewType(): string {
		return TERMINAL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return `Terminal: ${this.sessionName}`;
	}

	getIcon(): string {
		return "terminal";
	}

	async onOpen(): Promise<void> {
		this.containerEl = this.contentEl;
		this.containerEl.empty();
		this.containerEl.addClass("runbook-terminal-view");

		// Create terminal header
		const headerEl = this.containerEl.createDiv("runbook-terminal-header");
		this.renderHeader(headerEl);

		// Create terminal output
		this.outputEl = this.containerEl.createDiv("runbook-terminal-output-container");
		const outputInner = this.outputEl.createDiv("runbook-terminal-output");
		this.outputEl = outputInner;

		// Create input area
		const inputContainer = this.containerEl.createDiv("runbook-terminal-input-container");
		this.renderInput(inputContainer);

		// Set this as active when opened
		this.manager.setActiveSession(this.sessionId);
	}

	async onClose(): Promise<void> {
		// Remove the session when closing
		this.manager.removeSession(this.sessionId);
	}

	private renderHeader(headerEl: HTMLElement): void {
		headerEl.empty();

		// Navigation arrows (placeholder for future use)
		const navEl = headerEl.createDiv("runbook-terminal-nav");
		const leftArrow = navEl.createSpan("runbook-terminal-nav-btn");
		setIcon(leftArrow, "chevron-left");
		const rightArrow = navEl.createSpan("runbook-terminal-nav-btn");
		setIcon(rightArrow, "chevron-right");

		// Terminal title
		const titleEl = headerEl.createDiv("runbook-terminal-title");
		titleEl.setText(`Terminal: ${this.sessionName}`);

		// Menu button
		const menuBtn = headerEl.createDiv("runbook-terminal-menu");
		setIcon(menuBtn, "more-horizontal");
	}

	private renderInput(container: HTMLElement): void {
		const promptEl = container.createSpan("runbook-terminal-prompt");
		promptEl.setText("$");

		this.inputEl = container.createEl("input", {
			cls: "runbook-terminal-input",
			attr: {
				type: "text",
				placeholder: "Enter command...",
				spellcheck: "false",
			},
		});

		// Handle input events
		this.inputEl.addEventListener("keydown", (e) => this.handleInputKeydown(e));

		// Set as active when clicking in terminal
		this.inputEl.addEventListener("focus", () => {
			this.manager.setActiveSession(this.sessionId);
		});
	}

	private async handleInputKeydown(e: KeyboardEvent): Promise<void> {
		if (e.key === "Enter") {
			const command = this.inputEl.value.trim();
			if (command) {
				this.inputEl.value = "";
				await this.executeCommand(command);
			}
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const prev = this.manager.historyPrevious(this.sessionId);
			if (prev !== null) {
				this.inputEl.value = prev;
			}
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = this.manager.historyNext(this.sessionId);
			if (next !== null) {
				this.inputEl.value = next;
			}
		}
	}

	private async executeCommand(command: string): Promise<void> {
		// Log the command
		this.appendOutput(`$ ${command}\n`, "command");

		try {
			const output = await this.manager.executeInSession(this.sessionId, command);
			if (output.trim()) {
				this.appendOutput(output + "\n", "output");
			}
		} catch (err) {
			this.appendOutput(`Error: ${err}\n`, "error");
		}

		this.scrollToBottom();
	}

	/**
	 * Execute a command from a code block (external call)
	 */
	async executeFromCodeBlock(command: string, language: string): Promise<string> {
		// Log the command (shell-style)
		this.appendOutput(`$ ${command}\n`, "command");

		try {
			const output = await this.manager.executeInSession(this.sessionId, command);
			if (output.trim()) {
				this.appendOutput(`${output}\n`, "output");
			}
			this.scrollToBottom();
			return output;
		} catch (err) {
			this.appendOutput(`Error: ${err}\n`, "error");
			this.scrollToBottom();
			throw err;
		}
	}

	private appendOutput(text: string, type: "command" | "output" | "error" | "info"): void {
		const lineEl = this.outputEl.createDiv(`runbook-terminal-line runbook-terminal-line-${type}`);
		lineEl.setText(text);
	}

	private scrollToBottom(): void {
		this.outputEl.scrollTop = this.outputEl.scrollHeight;
	}

	/**
	 * Focus the input field
	 */
	focusInput(): void {
		this.inputEl?.focus();
	}

	/**
	 * Get the session ID for this terminal
	 */
	getSessionId(): string {
		return this.sessionId;
	}

	/**
	 * Check if this terminal is the active one
	 */
	isActive(): boolean {
		return this.manager.activeSessionId === this.sessionId;
	}
}
