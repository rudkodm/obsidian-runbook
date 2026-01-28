/**
 * xterm.js terminal styles
 * Injected at runtime to style the terminal panel
 */
export const XTERM_STYLES = `
/* xterm.js container */
.runbook-xterm-view {
	display: flex;
	flex-direction: column;
	height: 100%;
	padding: 0;
	overflow: hidden;
}

.runbook-xterm-container {
	flex: 1;
	min-height: 0;
	padding: 4px;
}

/* Make xterm fill the container */
.runbook-xterm-container .xterm {
	height: 100%;
}

.runbook-xterm-container .xterm-viewport {
	overflow-y: auto;
}

/* Scrollbar styling */
.runbook-xterm-container .xterm-viewport::-webkit-scrollbar {
	width: 8px;
}

.runbook-xterm-container .xterm-viewport::-webkit-scrollbar-track {
	background: transparent;
}

.runbook-xterm-container .xterm-viewport::-webkit-scrollbar-thumb {
	background-color: var(--background-modifier-border);
	border-radius: 4px;
}

.runbook-xterm-container .xterm-viewport::-webkit-scrollbar-thumb:hover {
	background-color: var(--background-modifier-border-hover);
}
`;
