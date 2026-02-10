/**
 * Extended Obsidian types for internal APIs
 * These are not part of the official Obsidian API but are needed for certain features
 */

import { App, WorkspaceLeaf } from "obsidian";

/**
 * Extended App interface with internal plugin manager
 */
export interface AppWithPlugins extends App {
	plugins: {
		plugins: Record<string, unknown>;
		manifests: Record<string, unknown>;
		enabledPlugins: Set<string>;
	};
}

/**
 * Extended WorkspaceLeaf with internal methods
 */
export interface WorkspaceLeafExt extends WorkspaceLeaf {
	updateHeader?: () => void;
	parent?: {
		children: WorkspaceLeaf[];
	};
}
