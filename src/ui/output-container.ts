import { setIcon } from "obsidian";

/**
 * Output Container Component
 * Renders execution output inline below code blocks
 */

export interface OutputState {
	isLoading: boolean;
	output: string | null;
	error: string | null;
	timestamp: Date | null;
}

/**
 * Creates and manages an output container element for displaying execution results
 */
export class OutputContainer {
	private containerEl: HTMLElement;
	private headerEl: HTMLElement;
	private contentEl: HTMLElement;
	private state: OutputState;
	private onCopy: (() => void) | null = null;
	private onClear: (() => void) | null = null;

	// Maximum characters before truncating output
	private static readonly MAX_OUTPUT_LENGTH = 5000;
	// Lines to show when collapsed
	private static readonly COLLAPSED_LINES = 20;

	constructor(parentEl: HTMLElement) {
		this.state = {
			isLoading: false,
			output: null,
			error: null,
			timestamp: null,
		};

		this.containerEl = this.createDiv(parentEl, "runbook-output-container");
		this.headerEl = this.createDiv(this.containerEl, "runbook-output-header");
		this.contentEl = this.createDiv(this.containerEl, "runbook-output-content");

		// Initially hidden until there's output
		this.containerEl.classList.add("is-hidden");
	}

	/**
	 * Show loading state
	 */
	showLoading(): void {
		this.state = {
			isLoading: true,
			output: null,
			error: null,
			timestamp: null,
		};
		this.render();
	}

	/**
	 * Show output result
	 */
	showOutput(output: string): void {
		this.state = {
			isLoading: false,
			output,
			error: null,
			timestamp: new Date(),
		};
		this.render();
	}

	/**
	 * Show error result
	 */
	showError(error: string): void {
		this.state = {
			isLoading: false,
			output: null,
			error,
			timestamp: new Date(),
		};
		this.render();
	}

	/**
	 * Clear the output
	 */
	clear(): void {
		this.state = {
			isLoading: false,
			output: null,
			error: null,
			timestamp: null,
		};
		this.containerEl.classList.add("is-hidden");
		this.onClear?.();
	}

	/**
	 * Set callback for copy action
	 */
	setCopyCallback(callback: () => void): void {
		this.onCopy = callback;
	}

	/**
	 * Set callback for clear action
	 */
	setClearCallback(callback: () => void): void {
		this.onClear = callback;
	}

	/**
	 * Get the container element
	 */
	getElement(): HTMLElement {
		return this.containerEl;
	}

	/**
	 * Remove the container from DOM
	 */
	destroy(): void {
		this.containerEl.remove();
	}

	/**
	 * Render the current state
	 */
	private render(): void {
		this.containerEl.classList.remove("is-hidden");
		this.headerEl.replaceChildren();
		this.contentEl.replaceChildren();
		this.contentEl.classList.remove("runbook-output-error");

		if (this.state.isLoading) {
			this.renderLoading();
		} else if (this.state.error) {
			this.renderError();
		} else if (this.state.output !== null) {
			this.renderOutput();
		}
	}

	/**
	 * Render loading state
	 */
	private renderLoading(): void {
		this.createSpan(this.headerEl, "runbook-output-status", "Running...");

		const spinner = this.createDiv(this.contentEl, "runbook-output-spinner");
		setIcon(spinner, "loader-2");
	}

	/**
	 * Render error state
	 */
	private renderError(): void {
		this.renderHeader("Error", true);

		this.contentEl.classList.add("runbook-output-error");
		this.createElement(this.contentEl, "pre", undefined, this.state.error || "");
	}

	/**
	 * Render output state
	 */
	private renderOutput(): void {
		const output = this.state.output || "";
		const isEmpty = output.trim().length === 0;

		this.renderHeader(isEmpty ? "No output" : "Output", false);

		if (isEmpty) {
			this.createSpan(this.contentEl, "runbook-output-empty", "(command produced no output)");
			return;
		}

		// Check if output needs truncation
		const lines = output.split("\n");
		const needsExpand = lines.length > OutputContainer.COLLAPSED_LINES ||
			output.length > OutputContainer.MAX_OUTPUT_LENGTH;

		if (needsExpand) {
			this.renderCollapsibleOutput(output, lines);
		} else {
			this.createElement(this.contentEl, "pre", undefined, output);
		}
	}

	/**
	 * Render collapsible output for large results
	 */
	private renderCollapsibleOutput(output: string, lines: string[]): void {
		const previewLines = lines.slice(0, OutputContainer.COLLAPSED_LINES);
		let previewText = previewLines.join("\n");

		if (previewText.length > OutputContainer.MAX_OUTPUT_LENGTH) {
			previewText = previewText.slice(0, OutputContainer.MAX_OUTPUT_LENGTH);
		}

		const preEl = this.createElement(this.contentEl, "pre", undefined, previewText);

		const moreCount = lines.length - OutputContainer.COLLAPSED_LINES;
		if (moreCount > 0) {
			const expandBtn = this.createElement(
				this.contentEl,
				"button",
				"runbook-output-expand",
				`Show ${moreCount} more lines...`
			);

			let expanded = false;
			expandBtn.addEventListener("click", () => {
				if (expanded) {
					preEl.textContent = previewText;
					expandBtn.textContent = `Show ${moreCount} more lines...`;
				} else {
					preEl.textContent = output.length > OutputContainer.MAX_OUTPUT_LENGTH
						? output.slice(0, OutputContainer.MAX_OUTPUT_LENGTH) + "\n... (output truncated)"
						: output;
					expandBtn.textContent = "Show less";
				}
				expanded = !expanded;
			});
		}
	}

	/**
	 * Render header with timestamp and action buttons
	 */
	private renderHeader(label: string, isError: boolean): void {
		// Status label
		const statusClass = isError
			? "runbook-output-status runbook-output-status-error"
			: "runbook-output-status";
		this.createSpan(this.headerEl, statusClass, label);

		// Timestamp
		if (this.state.timestamp) {
			const timeStr = this.formatTimestamp(this.state.timestamp);
			this.createSpan(this.headerEl, "runbook-output-timestamp", timeStr);
		}

		// Action buttons container - add to main container for absolute positioning
		const actionsEl = this.createDiv(this.containerEl, "runbook-output-actions");

		// Copy button
		const copyBtn = this.createElement(actionsEl, "button", "runbook-output-btn clickable-icon");
		copyBtn.setAttribute("aria-label", "Copy output");
		setIcon(copyBtn, "copy");
		copyBtn.addEventListener("click", () => {
			void this.copyOutput();
		});

		// Clear button
		const clearBtn = this.createElement(actionsEl, "button", "runbook-output-btn clickable-icon");
		clearBtn.setAttribute("aria-label", "Clear output");
		setIcon(clearBtn, "x");
		clearBtn.addEventListener("click", () => this.clear());
	}

	/**
	 * Copy output to clipboard
	 */
	private async copyOutput(): Promise<void> {
		const text = this.state.output || this.state.error || "";
		if (!text) return;

		try {
			await navigator.clipboard.writeText(text);
			this.onCopy?.();
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
		}
	}

	/**
	 * Format timestamp for display
	 */
	private formatTimestamp(date: Date): string {
		return date.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	/**
	 * Helper to create a div element (works in both Obsidian and standard DOM)
	 */
	private createDiv(parent: HTMLElement, className: string): HTMLElement {
		const div = document.createElement("div");
		div.className = className;
		parent.appendChild(div);
		return div;
	}

	/**
	 * Helper to create a span element
	 */
	private createSpan(parent: HTMLElement, className: string, text?: string): HTMLElement {
		const span = document.createElement("span");
		span.className = className;
		if (text) span.textContent = text;
		parent.appendChild(span);
		return span;
	}

	/**
	 * Helper to create an element
	 */
	private createElement<K extends keyof HTMLElementTagNameMap>(
		parent: HTMLElement,
		tag: K,
		className?: string,
		text?: string
	): HTMLElementTagNameMap[K] {
		const el = document.createElement(tag);
		if (className) el.className = className;
		if (text) el.textContent = text;
		parent.appendChild(el);
		return el;
	}
}
