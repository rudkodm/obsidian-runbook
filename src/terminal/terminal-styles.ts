/**
 * Terminal view styles
 * Injected at runtime to style the terminal panel
 */
export const TERMINAL_STYLES = `
/* Terminal View Container */
.runbook-terminal-view {
	display: flex;
	flex-direction: column;
	height: 100%;
	background-color: var(--background-primary);
	font-family: var(--font-monospace);
	font-size: var(--font-smaller);
}

/* Tab Bar */
.runbook-terminal-tab-bar {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	background-color: var(--background-secondary);
	border-bottom: 1px solid var(--background-modifier-border);
	min-height: 32px;
}

.runbook-terminal-tab {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px;
	border-radius: 4px;
	cursor: pointer;
	color: var(--text-muted);
	background-color: transparent;
	transition: background-color 0.15s ease;
}

.runbook-terminal-tab:hover {
	background-color: var(--background-modifier-hover);
	color: var(--text-normal);
}

.runbook-terminal-tab.is-active {
	background-color: var(--background-primary);
	color: var(--text-normal);
}

.runbook-terminal-tab-icon {
	display: flex;
	align-items: center;
}

.runbook-terminal-tab-icon svg {
	width: 14px;
	height: 14px;
}

.runbook-terminal-tab-name {
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.runbook-terminal-tab-close {
	display: flex;
	align-items: center;
	padding: 2px;
	border-radius: 3px;
	opacity: 0;
	transition: opacity 0.15s ease;
}

.runbook-terminal-tab:hover .runbook-terminal-tab-close {
	opacity: 1;
}

.runbook-terminal-tab-close:hover {
	background-color: var(--background-modifier-hover);
}

.runbook-terminal-tab-close svg {
	width: 12px;
	height: 12px;
}

.runbook-terminal-tab-add {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: 4px;
	cursor: pointer;
	color: var(--text-muted);
	transition: background-color 0.15s ease, color 0.15s ease;
}

.runbook-terminal-tab-add:hover {
	background-color: var(--background-modifier-hover);
	color: var(--text-normal);
}

.runbook-terminal-tab-add svg {
	width: 16px;
	height: 16px;
}

.runbook-terminal-collapse {
	margin-left: auto;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: 4px;
	cursor: pointer;
	color: var(--text-muted);
	transition: background-color 0.15s ease;
}

.runbook-terminal-collapse:hover {
	background-color: var(--background-modifier-hover);
}

.runbook-terminal-collapse svg {
	width: 16px;
	height: 16px;
}

/* Terminal Header */
.runbook-terminal-header {
	display: flex;
	align-items: center;
	padding: 4px 8px;
	background-color: var(--background-secondary);
	border-bottom: 1px solid var(--background-modifier-border);
	min-height: 28px;
}

.runbook-terminal-nav {
	display: flex;
	gap: 4px;
}

.runbook-terminal-nav-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 3px;
	cursor: pointer;
	color: var(--text-muted);
}

.runbook-terminal-nav-btn:hover {
	background-color: var(--background-modifier-hover);
}

.runbook-terminal-nav-btn svg {
	width: 14px;
	height: 14px;
}

.runbook-terminal-title {
	flex: 1;
	text-align: center;
	color: var(--text-muted);
	font-size: var(--font-smaller);
}

.runbook-terminal-menu {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 3px;
	cursor: pointer;
	color: var(--text-muted);
}

.runbook-terminal-menu:hover {
	background-color: var(--background-modifier-hover);
}

.runbook-terminal-menu svg {
	width: 14px;
	height: 14px;
}

/* Terminal Output Container */
.runbook-terminal-output-container {
	flex: 1;
	overflow: hidden;
	position: relative;
}

.runbook-terminal-output {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	overflow-y: auto;
	padding: 8px 12px;
	background-color: var(--background-primary);
}

/* Terminal Lines */
.runbook-terminal-line {
	white-space: pre-wrap;
	word-break: break-all;
	line-height: 1.5;
}

.runbook-terminal-line-command {
	color: var(--text-accent);
}

.runbook-terminal-line-output {
	color: var(--text-normal);
}

.runbook-terminal-line-error {
	color: var(--text-error);
}

.runbook-terminal-line-info {
	color: var(--text-muted);
}

/* Colored output for Runbook logs */
.runbook-terminal-line-info .highlight-command {
	color: var(--text-accent);
}

.runbook-terminal-line-info .highlight-output {
	color: var(--color-green);
}

/* Terminal Input Container */
.runbook-terminal-input-container {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	background-color: var(--background-secondary);
	border-top: 1px solid var(--background-modifier-border);
}

.runbook-terminal-prompt {
	color: var(--text-accent);
	font-weight: 500;
}

.runbook-terminal-input {
	flex: 1;
	background: transparent;
	border: none;
	outline: none;
	color: var(--text-normal);
	font-family: var(--font-monospace);
	font-size: var(--font-smaller);
}

.runbook-terminal-input::placeholder {
	color: var(--text-faint);
}

/* Scrollbar styling */
.runbook-terminal-output::-webkit-scrollbar {
	width: 8px;
}

.runbook-terminal-output::-webkit-scrollbar-track {
	background: transparent;
}

.runbook-terminal-output::-webkit-scrollbar-thumb {
	background-color: var(--background-modifier-border);
	border-radius: 4px;
}

.runbook-terminal-output::-webkit-scrollbar-thumb:hover {
	background-color: var(--background-modifier-border-hover);
}
`;
