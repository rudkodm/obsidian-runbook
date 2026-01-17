import { ItemView, WorkspaceLeaf } from "obsidian";
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
	private outputEl: HTMLElement;
	private inputLine: HTMLElement;
	private inputEl: HTMLInputElement;
	private promptEl: HTMLElement;

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
		const container = this.contentEl;
		container.empty();
		container.addClass("runbook-terminal-view");

		// Create terminal output area (includes input at the bottom)
		this.outputEl = container.createDiv("runbook-terminal-output");

		// Create input line at the bottom of output
		this.inputLine = this.outputEl.createDiv("runbook-terminal-input-line");
		this.promptEl = this.inputLine.createSpan("runbook-terminal-prompt");
		this.promptEl.setText("$ ");

		this.inputEl = this.inputLine.createEl("input", {
			cls: "runbook-terminal-input",
			attr: {
				type: "text",
				spellcheck: "false",
			},
		});

		// Handle input events
		this.inputEl.addEventListener("keydown", (e) => this.handleInputKeydown(e));

		// Set as active when clicking anywhere in terminal
		container.addEventListener("click", () => {
			this.manager.setActiveSession(this.sessionId);
			this.inputEl.focus();
		});

		// Set this as active when opened
		this.manager.setActiveSession(this.sessionId);

		// Focus input
		this.inputEl.focus();
	}

	async onClose(): Promise<void> {
		// Remove the session when closing
		this.manager.removeSession(this.sessionId);
	}

	private async handleInputKeydown(e: KeyboardEvent): Promise<void> {
		if (e.key === "Enter") {
			const command = this.inputEl.value;
			if (command.trim()) {
				// Move input line content to output
				this.commitInputLine(command);
				this.inputEl.value = "";
				await this.executeCommand(command);
			}
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const prev = this.manager.historyPrevious(this.sessionId);
			if (prev !== null) {
				this.inputEl.value = prev;
				// Move cursor to end
				this.inputEl.setSelectionRange(prev.length, prev.length);
			}
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = this.manager.historyNext(this.sessionId);
			if (next !== null) {
				this.inputEl.value = next;
			}
		}
	}

	private commitInputLine(command: string): void {
		// Create a static line showing the executed command
		const lineEl = document.createElement("div");
		lineEl.className = "runbook-terminal-line runbook-terminal-line-command";
		lineEl.textContent = `$ ${command}`;

		// Insert before input line
		this.outputEl.insertBefore(lineEl, this.inputLine);
	}

	private async executeCommand(command: string): Promise<void> {
		try {
			const output = await this.manager.executeInSession(this.sessionId, command);
			if (output.trim()) {
				this.appendOutput(output, "output");
			}
		} catch (err) {
			this.appendOutput(`Error: ${err}`, "error");
		}

		this.scrollToBottom();
	}

	/**
	 * Execute a command from a code block (external call)
	 */
	async executeFromCodeBlock(command: string, language: string): Promise<string> {
		// Show the command in terminal
		this.commitInputLine(command);

		try {
			const output = await this.manager.executeInSession(this.sessionId, command);
			if (output.trim()) {
				this.appendOutput(output, "output");
			}
			this.scrollToBottom();
			return output;
		} catch (err) {
			this.appendOutput(`Error: ${err}`, "error");
			this.scrollToBottom();
			throw err;
		}
	}

	private appendOutput(text: string, type: "output" | "error"): void {
		const lineEl = document.createElement("div");
		lineEl.className = `runbook-terminal-line runbook-terminal-line-${type}`;
		lineEl.textContent = text;

		// Insert before input line
		this.outputEl.insertBefore(lineEl, this.inputLine);
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
