import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { TerminalManager, TerminalTab } from "./terminal-manager";

export const TERMINAL_VIEW_TYPE = "runbook-terminal";

/**
 * Terminal view component for Obsidian
 * Displays a bottom panel with multiple terminal tabs
 */
export class TerminalView extends ItemView {
	private manager: TerminalManager;
	private containerEl: HTMLElement;
	private tabBarEl: HTMLElement;
	private terminalContainerEl: HTMLElement;
	private inputEl: HTMLInputElement;
	private outputEls: Map<string, HTMLElement> = new Map();

	constructor(leaf: WorkspaceLeaf, manager: TerminalManager) {
		super(leaf);
		this.manager = manager;
	}

	getViewType(): string {
		return TERMINAL_VIEW_TYPE;
	}

	getDisplayText(): string {
		const activeTab = this.manager.activeTab;
		return activeTab ? `Terminal: ${activeTab.name}` : "Terminal";
	}

	getIcon(): string {
		return "terminal";
	}

	async onOpen(): Promise<void> {
		this.containerEl = this.contentEl;
		this.containerEl.empty();
		this.containerEl.addClass("runbook-terminal-view");

		// Create tab bar
		this.tabBarEl = this.containerEl.createDiv("runbook-terminal-tab-bar");
		this.renderTabBar();

		// Create terminal header
		const headerEl = this.containerEl.createDiv("runbook-terminal-header");
		this.renderHeader(headerEl);

		// Create terminal output container
		this.terminalContainerEl = this.containerEl.createDiv("runbook-terminal-output-container");

		// Create input area
		const inputContainer = this.containerEl.createDiv("runbook-terminal-input-container");
		this.renderInput(inputContainer);

		// Set up event listeners
		this.setupEventListeners();

		// Create default tab if none exists
		if (this.manager.tabCount === 0) {
			this.manager.createTab();
		}

		// Render active terminal
		this.renderActiveTerminal();
	}

	async onClose(): Promise<void> {
		// Clean up
		this.outputEls.clear();
	}

	private renderTabBar(): void {
		this.tabBarEl.empty();

		const tabs = this.manager.getAllTabs();
		for (const tab of tabs) {
			const tabEl = this.tabBarEl.createDiv({
				cls: `runbook-terminal-tab ${tab.id === this.manager.activeTabId ? "is-active" : ""}`,
			});

			// Terminal icon
			const iconEl = tabEl.createSpan("runbook-terminal-tab-icon");
			setIcon(iconEl, "terminal");

			// Tab name
			tabEl.createSpan({ cls: "runbook-terminal-tab-name", text: tab.name });

			// Close button
			const closeBtn = tabEl.createSpan("runbook-terminal-tab-close");
			setIcon(closeBtn, "x");
			closeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.manager.closeTab(tab.id);
			});

			// Click to activate
			tabEl.addEventListener("click", () => {
				this.manager.activateTab(tab.id);
			});
		}

		// Add new tab button
		const addBtn = this.tabBarEl.createDiv("runbook-terminal-tab-add");
		setIcon(addBtn, "plus");
		addBtn.setAttribute("aria-label", "New terminal session");
		addBtn.addEventListener("click", () => {
			this.manager.createTab();
		});

		// Collapse/expand button
		const collapseBtn = this.tabBarEl.createDiv("runbook-terminal-collapse");
		setIcon(collapseBtn, "chevron-down");
		collapseBtn.setAttribute("aria-label", "Collapse terminal");
	}

	private renderHeader(headerEl: HTMLElement): void {
		headerEl.empty();

		// Navigation arrows (placeholder)
		const navEl = headerEl.createDiv("runbook-terminal-nav");
		const leftArrow = navEl.createSpan("runbook-terminal-nav-btn");
		setIcon(leftArrow, "chevron-left");
		const rightArrow = navEl.createSpan("runbook-terminal-nav-btn");
		setIcon(rightArrow, "chevron-right");

		// Terminal title
		const titleEl = headerEl.createDiv("runbook-terminal-title");
		const activeTab = this.manager.activeTab;
		titleEl.setText(activeTab ? `Terminal: ${activeTab.name}` : "Terminal");

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
			const prev = this.manager.historyPrevious();
			if (prev !== null) {
				this.inputEl.value = prev;
			}
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = this.manager.historyNext();
			if (next !== null) {
				this.inputEl.value = next;
			}
		}
	}

	private async executeCommand(command: string): Promise<void> {
		const activeTab = this.manager.activeTab;
		if (!activeTab) return;

		// Log the command being executed
		this.appendOutput(activeTab.id, `$ ${command}\n`, "command");

		try {
			const output = await this.manager.executeInActive(command);
			if (output) {
				this.appendOutput(activeTab.id, output + "\n", "output");
			}
		} catch (err) {
			this.appendOutput(activeTab.id, `Error: ${err}\n`, "error");
		}

		this.scrollToBottom();
	}

	/**
	 * Execute a command from a code block (external call)
	 */
	async executeFromCodeBlock(command: string, language: string): Promise<string> {
		const activeTab = this.manager.activeTab;
		if (!activeTab) {
			// Create a tab if none exists
			this.manager.createTab();
		}

		// Log execution info
		this.appendOutput(
			this.manager.activeTabId!,
			`Runbook: Executing { command: '${command}', language: '${language}' }\n`,
			"info"
		);

		try {
			const output = await this.manager.executeInActive(command);
			this.appendOutput(
				this.manager.activeTabId!,
				`Runbook: Execution complete { output: '${output}' }\n`,
				"info"
			);
			this.scrollToBottom();
			return output;
		} catch (err) {
			const errorMsg = `Runbook: Execution failed { error: '${err}' }\n`;
			this.appendOutput(this.manager.activeTabId!, errorMsg, "error");
			this.scrollToBottom();
			throw err;
		}
	}

	private appendOutput(tabId: string, text: string, type: "command" | "output" | "error" | "info"): void {
		let outputEl = this.outputEls.get(tabId);
		if (!outputEl) {
			outputEl = this.terminalContainerEl.createDiv({
				cls: "runbook-terminal-output",
				attr: { "data-tab-id": tabId },
			});
			this.outputEls.set(tabId, outputEl);
		}

		const lineEl = outputEl.createDiv(`runbook-terminal-line runbook-terminal-line-${type}`);
		lineEl.setText(text);
	}

	private renderActiveTerminal(): void {
		// Hide all outputs
		for (const [tabId, outputEl] of this.outputEls) {
			outputEl.style.display = tabId === this.manager.activeTabId ? "block" : "none";
		}

		// Create output element for active tab if it doesn't exist
		const activeTabId = this.manager.activeTabId;
		if (activeTabId && !this.outputEls.has(activeTabId)) {
			const outputEl = this.terminalContainerEl.createDiv({
				cls: "runbook-terminal-output",
				attr: { "data-tab-id": activeTabId },
			});
			this.outputEls.set(activeTabId, outputEl);
		}

		// Update header
		const headerEl = this.containerEl.querySelector(".runbook-terminal-header");
		if (headerEl) {
			this.renderHeader(headerEl as HTMLElement);
		}

		// Update display text
		this.leaf.updateHeader();
	}

	private scrollToBottom(): void {
		const activeTabId = this.manager.activeTabId;
		if (!activeTabId) return;

		const outputEl = this.outputEls.get(activeTabId);
		if (outputEl) {
			outputEl.scrollTop = outputEl.scrollHeight;
		}
	}

	private setupEventListeners(): void {
		this.manager.on("tabCreated", () => {
			this.renderTabBar();
			this.renderActiveTerminal();
		});

		this.manager.on("tabClosed", (tabId: string) => {
			// Remove output element
			const outputEl = this.outputEls.get(tabId);
			if (outputEl) {
				outputEl.remove();
				this.outputEls.delete(tabId);
			}
			this.renderTabBar();
			this.renderActiveTerminal();
		});

		this.manager.on("tabActivated", () => {
			this.renderTabBar();
			this.renderActiveTerminal();
		});

		this.manager.on("tabRenamed", () => {
			this.renderTabBar();
			this.renderHeader(this.containerEl.querySelector(".runbook-terminal-header") as HTMLElement);
		});
	}

	/**
	 * Focus the input field
	 */
	focusInput(): void {
		this.inputEl?.focus();
	}
}
