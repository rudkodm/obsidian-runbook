import { App, WorkspaceLeaf } from "obsidian";
import { XtermView, XTERM_VIEW_TYPE } from "../terminal/xterm-view";
import { InterpreterType } from "../shell/types";
import { normalizeLanguage } from "../editor/code-block";
import { RunbookSettings } from "../settings";

/**
 * Manages per-note terminal sessions.
 * Each note gets its own shell session for isolation.
 * Non-shell languages (Python, JS, TS) get their own interpreter REPL sessions.
 * Stores direct XtermView references for reliable session reuse.
 */
export class SessionManager {
	private app: App;
	private settings: RunbookSettings;
	/** Map of note file path -> shell XtermView */
	private noteToView: Map<string, XtermView> = new Map();
	/** Map of "notePath:language" -> interpreter XtermView */
	private interpreterViews: Map<string, XtermView> = new Map();

	constructor(app: App, settings: RunbookSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Get or create a shell session for a given note.
	 */
	async getOrCreateSession(notePath: string, cwd?: string): Promise<XtermView | null> {
		const existingView = this.getSessionForNote(notePath);
		if (existingView) {
			return existingView;
		}
		return this.createSession(notePath, cwd);
	}

	/**
	 * Get or create an interpreter REPL session for a given note + language.
	 * Each (note, language) pair gets its own persistent REPL.
	 */
	async getOrCreateInterpreterSession(
		notePath: string,
		language: string,
		cwd?: string,
		interpreterPath?: string,
	): Promise<XtermView | null> {
		const key = this.interpreterKey(notePath, language);
		const existing = this.getInterpreterView(key);
		if (existing) {
			return existing;
		}
		return this.createInterpreterSession(notePath, language, cwd, interpreterPath);
	}

	/**
	 * Always create a fresh shell session (used by Run All for isolation).
	 */
	async createFreshSession(label: string, cwd?: string): Promise<XtermView | null> {
		const leaf = this.getTerminalLeaf();
		if (!leaf) return null;

		XtermView.pendingCwd = cwd || null;
		XtermView.pendingShellPath = this.settings.shellPath || null;
		XtermView.pendingFontSize = this.settings.terminalFontSize;
		XtermView.pendingInterpreter = null;
		await leaf.setViewState({ type: XTERM_VIEW_TYPE, active: true });

		const view = leaf.view;
		if (!view || view.getViewType() !== XTERM_VIEW_TYPE) return null;

		const xtermView = view as unknown as XtermView;
		xtermView.setNoteName(label);

		await new Promise(resolve => setTimeout(resolve, 300));
		return xtermView;
	}

	/**
	 * Create a fresh interpreter REPL session (used by Run All for isolation).
	 */
	async createFreshInterpreterSession(
		label: string,
		language: string,
		cwd?: string,
		interpreterPath?: string,
	): Promise<XtermView | null> {
		const interpType = this.toInterpreterType(language);
		if (!interpType) return null;

		const leaf = this.getTerminalLeaf();
		if (!leaf) return null;

		// Resolve interpreter path from settings if not provided
		const resolvedPath = this.resolveInterpreterPath(interpType, interpreterPath);

		XtermView.pendingCwd = cwd || null;
		XtermView.pendingShellPath = this.settings.shellPath || null;
		XtermView.pendingFontSize = this.settings.terminalFontSize;
		XtermView.pendingInterpreter = { type: interpType, interpreterPath: resolvedPath };
		await leaf.setViewState({ type: XTERM_VIEW_TYPE, active: true });

		const view = leaf.view;
		if (!view || view.getViewType() !== XTERM_VIEW_TYPE) return null;

		const xtermView = view as unknown as XtermView;
		xtermView.setNoteName(label);

		await new Promise(resolve => setTimeout(resolve, 300));
		return xtermView;
	}

	/**
	 * Get existing shell session for a note (if any).
	 */
	getSessionForNote(notePath: string): XtermView | null {
		const view = this.noteToView.get(notePath);
		if (!view) return null;

		const leaves = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		const stillAlive = leaves.some(leaf => leaf.view === view);

		if (stillAlive && view.state !== "exited") {
			return view;
		}

		this.noteToView.delete(notePath);
		return null;
	}

	/**
	 * Clean up all sessions for a note (shell + interpreters)
	 */
	cleanupSession(notePath: string): void {
		this.noteToView.delete(notePath);
		for (const key of this.interpreterViews.keys()) {
			if (key.startsWith(notePath + ":")) {
				this.interpreterViews.delete(key);
			}
		}
	}

	/**
	 * Clean up all sessions
	 */
	cleanupAll(): void {
		this.noteToView.clear();
		this.interpreterViews.clear();
	}

	/**
	 * Check if a note has an active shell session
	 */
	hasSession(notePath: string): boolean {
		return this.getSessionForNote(notePath) !== null;
	}

	/**
	 * Get a workspace leaf for a new terminal.
	 * If terminals already exist, creates a tab in the same pane.
	 * Otherwise creates a new horizontal split at the bottom.
	 */
	getTerminalLeaf(): WorkspaceLeaf {
		const existing = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		if (existing.length > 0) {
			 
			const parent = (existing[0] as any).parent;
			if (parent) {
				return this.app.workspace.createLeafInParent(parent, -1);
			}
		}
		return this.app.workspace.getLeaf("split", "horizontal");
	}

	// --- Private helpers ---

	private interpreterKey(notePath: string, language: string): string {
		return `${notePath}:${normalizeLanguage(language)}`;
	}

	private toInterpreterType(language: string): InterpreterType | null {
		const normalized = normalizeLanguage(language);
		if (normalized === "python" || normalized === "javascript" || normalized === "typescript") {
			return normalized;
		}
		return null;
	}

	/**
	 * Resolve interpreter path from settings, falling back to defaults.
	 * Block-level interpreter attribute takes precedence over settings.
	 */
	private resolveInterpreterPath(interpType: InterpreterType, blockLevelPath?: string): string | undefined {
		// Block-level path takes precedence
		if (blockLevelPath) {
			return blockLevelPath;
		}

		// Use settings-configured paths
		switch (interpType) {
			case "python":
				return this.settings.pythonPath;
			case "javascript":
				return this.settings.nodePath;
			case "typescript":
				return this.settings.typescriptPath;
			default:
				return undefined;
		}
	}

	/**
	 * Get an existing interpreter view, validating it's still alive.
	 */
	private getInterpreterView(key: string): XtermView | null {
		const view = this.interpreterViews.get(key);
		if (!view) return null;

		const leaves = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		const stillAlive = leaves.some(leaf => leaf.view === view);

		if (stillAlive && view.state !== "exited") {
			return view;
		}

		this.interpreterViews.delete(key);
		return null;
	}

	/**
	 * Create a shell terminal bound to a note path
	 */
	private async createSession(notePath: string, cwd?: string): Promise<XtermView | null> {
		const leaf = this.getTerminalLeaf();
		if (!leaf) return null;

		XtermView.pendingCwd = cwd || null;
		XtermView.pendingShellPath = this.settings.shellPath || null;
		XtermView.pendingFontSize = this.settings.terminalFontSize;
		XtermView.pendingInterpreter = null;
		await leaf.setViewState({ type: XTERM_VIEW_TYPE, active: true });

		const view = leaf.view;
		if (!view || view.getViewType() !== XTERM_VIEW_TYPE) return null;

		const xtermView = view as unknown as XtermView;
		this.noteToView.set(notePath, xtermView);

		const noteName = notePath.replace(/\.md$/, "").split("/").pop() || notePath;
		xtermView.setNoteName(noteName);

		await new Promise(resolve => setTimeout(resolve, 300));
		return xtermView;
	}

	/**
	 * Create an interpreter REPL terminal bound to a note path + language
	 */
	private async createInterpreterSession(
		notePath: string,
		language: string,
		cwd?: string,
		interpreterPath?: string,
	): Promise<XtermView | null> {
		const interpType = this.toInterpreterType(language);
		if (!interpType) return null;

		const leaf = this.getTerminalLeaf();
		if (!leaf) return null;

		// Resolve interpreter path from settings if not provided
		const resolvedPath = this.resolveInterpreterPath(interpType, interpreterPath);

		XtermView.pendingCwd = cwd || null;
		XtermView.pendingShellPath = this.settings.shellPath || null;
		XtermView.pendingFontSize = this.settings.terminalFontSize;
		XtermView.pendingInterpreter = { type: interpType, interpreterPath: resolvedPath };
		await leaf.setViewState({ type: XTERM_VIEW_TYPE, active: true });

		const view = leaf.view;
		if (!view || view.getViewType() !== XTERM_VIEW_TYPE) return null;

		const xtermView = view as unknown as XtermView;

		const key = this.interpreterKey(notePath, language);
		this.interpreterViews.set(key, xtermView);

		const noteName = notePath.replace(/\.md$/, "").split("/").pop() || notePath;
		xtermView.setNoteName(noteName);

		await new Promise(resolve => setTimeout(resolve, 300));
		return xtermView;
	}
}
