import { EventEmitter } from "events";
import { ShellSession } from "../shell/session";

export interface TerminalTab {
	id: string;
	name: string;
	session: ShellSession;
	history: string[];
	historyIndex: number;
}

export interface TerminalManagerEvents {
	tabCreated: (tab: TerminalTab) => void;
	tabClosed: (tabId: string) => void;
	tabActivated: (tab: TerminalTab) => void;
	tabRenamed: (tab: TerminalTab) => void;
	output: (tabId: string, data: string) => void;
}

/**
 * Manages multiple terminal tabs, each with its own shell session
 */
export class TerminalManager extends EventEmitter {
	private tabs: Map<string, TerminalTab> = new Map();
	private _activeTabId: string | null = null;
	private tabCounter: number = 0;

	/**
	 * Get the currently active tab
	 */
	get activeTab(): TerminalTab | null {
		if (!this._activeTabId) return null;
		return this.tabs.get(this._activeTabId) || null;
	}

	/**
	 * Get the active tab ID
	 */
	get activeTabId(): string | null {
		return this._activeTabId;
	}

	/**
	 * Get all tabs
	 */
	getAllTabs(): TerminalTab[] {
		return Array.from(this.tabs.values());
	}

	/**
	 * Get tab count
	 */
	get tabCount(): number {
		return this.tabs.size;
	}

	/**
	 * Create a new terminal tab
	 */
	createTab(name?: string): TerminalTab {
		this.tabCounter++;
		const id = `terminal-${this.tabCounter}`;
		const tabName = name || `Terminal ${this.tabCounter}`;

		const session = new ShellSession();
		session.spawn();

		// Forward output events
		session.on("output", (data: string) => {
			this.emit("output", id, data);
		});

		const tab: TerminalTab = {
			id,
			name: tabName,
			session,
			history: [],
			historyIndex: -1,
		};

		this.tabs.set(id, tab);
		this.emit("tabCreated", tab);

		// Auto-activate if this is the first tab
		if (this.tabs.size === 1) {
			this.activateTab(id);
		}

		return tab;
	}

	/**
	 * Close a terminal tab
	 */
	closeTab(tabId: string): void {
		const tab = this.tabs.get(tabId);
		if (!tab) return;

		// Kill the session
		tab.session.kill();
		this.tabs.delete(tabId);
		this.emit("tabClosed", tabId);

		// If we closed the active tab, activate another one
		if (this._activeTabId === tabId) {
			const remainingTabs = this.getAllTabs();
			if (remainingTabs.length > 0) {
				this.activateTab(remainingTabs[0].id);
			} else {
				this._activeTabId = null;
			}
		}
	}

	/**
	 * Activate a terminal tab
	 */
	activateTab(tabId: string): void {
		const tab = this.tabs.get(tabId);
		if (!tab) return;

		this._activeTabId = tabId;
		this.emit("tabActivated", tab);
	}

	/**
	 * Rename a terminal tab
	 */
	renameTab(tabId: string, newName: string): void {
		const tab = this.tabs.get(tabId);
		if (!tab) return;

		tab.name = newName;
		this.emit("tabRenamed", tab);
	}

	/**
	 * Execute a command in the active terminal
	 */
	async executeInActive(command: string): Promise<string> {
		const tab = this.activeTab;
		if (!tab) {
			throw new Error("No active terminal");
		}

		// Add to history
		if (command.trim() && tab.history[tab.history.length - 1] !== command) {
			tab.history.push(command);
		}
		tab.historyIndex = tab.history.length;

		return tab.session.execute(command);
	}

	/**
	 * Get previous command from history for active tab
	 */
	historyPrevious(): string | null {
		const tab = this.activeTab;
		if (!tab || tab.history.length === 0) return null;

		if (tab.historyIndex > 0) {
			tab.historyIndex--;
		}
		return tab.history[tab.historyIndex] || null;
	}

	/**
	 * Get next command from history for active tab
	 */
	historyNext(): string | null {
		const tab = this.activeTab;
		if (!tab) return null;

		if (tab.historyIndex < tab.history.length - 1) {
			tab.historyIndex++;
			return tab.history[tab.historyIndex];
		} else {
			tab.historyIndex = tab.history.length;
			return "";
		}
	}

	/**
	 * Get a tab by ID
	 */
	getTab(tabId: string): TerminalTab | undefined {
		return this.tabs.get(tabId);
	}

	/**
	 * Destroy all terminals
	 */
	destroy(): void {
		for (const tab of this.tabs.values()) {
			tab.session.kill();
		}
		this.tabs.clear();
		this._activeTabId = null;
	}
}
