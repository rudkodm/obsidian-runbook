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

/* Terminal Output Area */
.runbook-terminal-output {
	flex: 1;
	overflow-y: auto;
	padding: 8px 12px;
	background-color: var(--background-primary);
	user-select: text;
	cursor: text;
}

/* Terminal Lines */
.runbook-terminal-line {
	white-space: pre-wrap;
	word-break: break-all;
	line-height: 1.5;
	margin: 0;
	padding: 0;
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

/* Input Line (at bottom of terminal) */
.runbook-terminal-input-line {
	display: flex;
	align-items: center;
	line-height: 1.5;
	margin-top: 2px;
}

.runbook-terminal-prompt {
	color: var(--text-accent);
	flex-shrink: 0;
}

.runbook-terminal-input {
	flex: 1;
	background: transparent;
	border: none;
	outline: none;
	color: var(--text-normal);
	font-family: var(--font-monospace);
	font-size: inherit;
	padding: 0;
	margin: 0;
	line-height: inherit;
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
