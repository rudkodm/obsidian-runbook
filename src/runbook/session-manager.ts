import { App, TFile, WorkspaceLeaf } from "obsidian";
import { XtermView, XTERM_VIEW_TYPE } from "../terminal/xterm-view";

/**
 * Manages per-note terminal sessions.
 * Each note gets its own shell session for isolation.
 */
export class SessionManager {
	private app: App;
	/** Map of note file path -> workspace leaf ID holding its terminal */
	private noteToLeafId: Map<string, string> = new Map();

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Get or create a terminal session for a given note.
	 * Returns the XtermView associated with the note.
	 */
	async getOrCreateSession(notePath: string): Promise<XtermView | null> {
		// Check if we already have a session for this note
		const existingView = this.getSessionForNote(notePath);
		if (existingView) {
			return existingView;
		}

		// Create a new terminal for this note
		const leaf = this.app.workspace.getLeaf("split", "horizontal");
		if (!leaf) return null;

		await leaf.setViewState({ type: XTERM_VIEW_TYPE, active: true });

		const view = leaf.view as XtermView;
		if (!view) return null;

		// Store the mapping using the leaf's unique ID
		const leafId = (leaf as any).id || String(Date.now());
		this.noteToLeafId.set(notePath, leafId);

		// Set display text to note name
		const noteName = notePath.replace(/\.md$/, "").split("/").pop() || notePath;
		view.setNoteName(noteName);

		// Wait for terminal to be ready
		await new Promise(resolve => setTimeout(resolve, 300));

		return view;
	}

	/**
	 * Get existing terminal session for a note (if any)
	 */
	getSessionForNote(notePath: string): XtermView | null {
		const leafId = this.noteToLeafId.get(notePath);
		if (!leafId) return null;

		// Find the leaf by checking all terminal leaves
		const leaves = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		for (const leaf of leaves) {
			const id = (leaf as any).id || "";
			if (id === leafId) {
				const view = leaf.view as XtermView;
				if (view?.isRunning) {
					return view;
				}
			}
		}

		// Leaf no longer exists or session is dead - clean up mapping
		this.noteToLeafId.delete(notePath);
		return null;
	}

	/**
	 * Clean up session when a note is closed
	 */
	cleanupSession(notePath: string): void {
		const leafId = this.noteToLeafId.get(notePath);
		if (!leafId) return;

		// Find and detach the terminal leaf
		const leaves = this.app.workspace.getLeavesOfType(XTERM_VIEW_TYPE);
		for (const leaf of leaves) {
			const id = (leaf as any).id || "";
			if (id === leafId) {
				leaf.detach();
				break;
			}
		}

		this.noteToLeafId.delete(notePath);
	}

	/**
	 * Clean up all sessions
	 */
	cleanupAll(): void {
		this.noteToLeafId.clear();
	}

	/**
	 * Get the note path associated with a terminal, if any
	 */
	getNoteForSession(leafId: string): string | null {
		for (const [notePath, id] of this.noteToLeafId) {
			if (id === leafId) {
				return notePath;
			}
		}
		return null;
	}

	/**
	 * Check if a note has an active session
	 */
	hasSession(notePath: string): boolean {
		return this.getSessionForNote(notePath) !== null;
	}
}
