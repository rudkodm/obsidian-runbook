import { App } from "obsidian";
import { XtermView, XTERM_VIEW_TYPE } from "../terminal/xterm-view";

/**
 * Manages per-note terminal sessions.
 * Each note gets its own shell session for isolation.
 * Stores direct XtermView references for reliable session reuse.
 */
export class SessionManager {
	private app: App;
	/** Map of note file path -> XtermView instance */
	private noteToView: Map<string, XtermView> = new Map();

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Get or create a terminal session for a given note.
	 * Returns the XtermView associated with the note.
	 */
	async getOrCreateSession(notePath: string): Promise<XtermView | null> {
		// Check if we already have a live session for this note
		const existingView = this.getSessionForNote(notePath);
		if (existingView) {
			return existingView;
		}

		// Create a new terminal for this note
		const leaf = this.app.workspace.getLeaf("split", "horizontal");
		if (!leaf) return null;

		await leaf.setViewState({ type: XTERM_VIEW_TYPE, active: true });

		const view = leaf.view;
		if (!view || view.getViewType() !== XTERM_VIEW_TYPE) return null;

		const xtermView = view as unknown as XtermView;

		// Store the mapping
		this.noteToView.set(notePath, xtermView);

		// Set display text to note name
		const noteName = notePath.replace(/\.md$/, "").split("/").pop() || notePath;
		xtermView.setNoteName(noteName);

		// Wait for terminal to be ready
		await new Promise(resolve => setTimeout(resolve, 300));

		return xtermView;
	}

	/**
	 * Get existing terminal session for a note (if any).
	 * Validates the view is still alive in the workspace.
	 */
	getSessionForNote(notePath: string): XtermView | null {
		const view = this.noteToView.get(notePath);
		if (!view) return null;

		// Check if the view's leaf is still in the workspace
		const leaves = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		const stillAlive = leaves.some(leaf => leaf.view === view);

		if (stillAlive && view.state !== "exited") {
			return view;
		}

		// View was closed or session died — clean up
		this.noteToView.delete(notePath);
		return null;
	}

	/**
	 * Clean up session when a note is closed
	 */
	cleanupSession(notePath: string): void {
		this.noteToView.delete(notePath);
	}

	/**
	 * Clean up all sessions
	 */
	cleanupAll(): void {
		this.noteToView.clear();
	}

	/**
	 * Check if a note has an active session
	 */
	hasSession(notePath: string): boolean {
		return this.getSessionForNote(notePath) !== null;
	}
}
