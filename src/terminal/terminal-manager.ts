import { EventEmitter } from "events";
import { ShellSession } from "../shell/session";

/**
 * Manages the active terminal session for code block execution routing
 * Each terminal is now an Obsidian tab, this just tracks which one is active
 */
export class TerminalManager extends EventEmitter {
	private sessions: Map<string, ShellSession> = new Map();
	private _activeSessionId: string | null = null;
	private sessionCounter: number = 0;
	private sessionHistory: Map<string, string[]> = new Map();
	private sessionHistoryIndex: Map<string, number> = new Map();

	/**
	 * Get the active session ID
	 */
	get activeSessionId(): string | null {
		return this._activeSessionId;
	}

	/**
	 * Get the active session
	 */
	get activeSession(): ShellSession | null {
		if (!this._activeSessionId) return null;
		return this.sessions.get(this._activeSessionId) || null;
	}

	/**
	 * Create a new session and return its ID
	 */
	createSession(): { id: string; name: string; session: ShellSession } {
		this.sessionCounter++;
		const id = `terminal-${this.sessionCounter}`;
		const name = `Terminal ${this.sessionCounter}`;

		const session = new ShellSession();
		session.spawn();

		this.sessions.set(id, session);
		this.sessionHistory.set(id, []);
		this.sessionHistoryIndex.set(id, -1);

		// Auto-activate if this is the first session
		if (this.sessions.size === 1) {
			this._activeSessionId = id;
		}

		this.emit("sessionCreated", { id, name, session });
		return { id, name, session };
	}

	/**
	 * Get a session by ID
	 */
	getSession(id: string): ShellSession | undefined {
		return this.sessions.get(id);
	}

	/**
	 * Remove a session
	 */
	removeSession(id: string): void {
		const session = this.sessions.get(id);
		if (session) {
			session.kill();
			this.sessions.delete(id);
			this.sessionHistory.delete(id);
			this.sessionHistoryIndex.delete(id);

			// If we removed the active session, activate another one
			if (this._activeSessionId === id) {
				const remaining = Array.from(this.sessions.keys());
				this._activeSessionId = remaining.length > 0 ? remaining[0] : null;
			}

			this.emit("sessionRemoved", id);
		}
	}

	/**
	 * Set the active session
	 */
	setActiveSession(id: string): void {
		if (this.sessions.has(id)) {
			this._activeSessionId = id;
			this.emit("activeSessionChanged", id);
		}
	}

	/**
	 * Execute in active session
	 */
	async executeInActive(command: string): Promise<string> {
		const session = this.activeSession;
		if (!session) {
			throw new Error("No active terminal");
		}

		// Add to history
		const history = this.sessionHistory.get(this._activeSessionId!) || [];
		if (command.trim() && history[history.length - 1] !== command) {
			history.push(command);
		}
		this.sessionHistoryIndex.set(this._activeSessionId!, history.length);

		return session.execute(command);
	}

	/**
	 * Execute in a specific session
	 */
	async executeInSession(sessionId: string, command: string): Promise<string> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		// Add to history
		const history = this.sessionHistory.get(sessionId) || [];
		if (command.trim() && history[history.length - 1] !== command) {
			history.push(command);
		}
		this.sessionHistoryIndex.set(sessionId, history.length);

		return session.execute(command);
	}

	/**
	 * Get previous command from history
	 */
	historyPrevious(sessionId: string): string | null {
		const history = this.sessionHistory.get(sessionId);
		if (!history || history.length === 0) return null;

		let index = this.sessionHistoryIndex.get(sessionId) ?? history.length;
		if (index > 0) {
			index--;
			this.sessionHistoryIndex.set(sessionId, index);
		}
		return history[index] || null;
	}

	/**
	 * Get next command from history
	 */
	historyNext(sessionId: string): string | null {
		const history = this.sessionHistory.get(sessionId);
		if (!history) return null;

		let index = this.sessionHistoryIndex.get(sessionId) ?? history.length;
		if (index < history.length - 1) {
			index++;
			this.sessionHistoryIndex.set(sessionId, index);
			return history[index];
		} else {
			this.sessionHistoryIndex.set(sessionId, history.length);
			return "";
		}
	}

	/**
	 * Get session count
	 */
	get sessionCount(): number {
		return this.sessions.size;
	}

	/**
	 * Destroy all sessions
	 */
	destroy(): void {
		for (const session of this.sessions.values()) {
			session.kill();
		}
		this.sessions.clear();
		this.sessionHistory.clear();
		this.sessionHistoryIndex.clear();
		this._activeSessionId = null;
	}
}

// Re-export for backward compatibility
export interface TerminalTab {
	id: string;
	name: string;
	session: ShellSession;
	history: string[];
	historyIndex: number;
}
