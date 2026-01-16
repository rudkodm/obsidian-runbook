import { MarkdownPostProcessorContext, Notice, setIcon } from "obsidian";
import { ShellSession } from "../shell/session";
import { isLanguageSupported, stripPromptPrefix } from "../editor/code-block";

/**
 * Code Block Processor
 * Creates notebook-style cells with code and output areas
 */

export interface CodeBlockProcessorOptions {
	getSession: () => ShellSession | null;
}

/**
 * Creates a Markdown post-processor that creates notebook-style cells
 */
export function createCodeBlockProcessor(options: CodeBlockProcessorOptions) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		const codeBlocks = el.querySelectorAll("pre > code");

		codeBlocks.forEach((codeEl) => {
			const preEl = codeEl.parentElement;
			if (!preEl) return;

			const language = extractLanguage(codeEl);
			if (!language || !isLanguageSupported(language)) {
				return;
			}

			// Generate a cell ID for state management
			const sectionInfo = ctx.getSectionInfo(el);
			const cellId = `${ctx.sourcePath}:${sectionInfo?.lineStart ?? 0}`;

			// Create the cell structure
			createCell(preEl, codeEl as HTMLElement, language, cellId, options);
		});
	};
}

/**
 * Extract language from code element's class
 */
function extractLanguage(codeEl: Element): string | null {
	const classList = codeEl.className.split(" ");
	for (const cls of classList) {
		if (cls.startsWith("language-")) {
			return cls.substring("language-".length);
		}
	}
	return null;
}

/**
 * Cell state for managing execution
 */
interface CellState {
	status: "idle" | "running" | "error" | "done";
	outputText: string;
	timestamp: Date | null;
}

/**
 * Create a notebook-style cell
 */
function createCell(
	preEl: HTMLElement,
	codeEl: HTMLElement,
	language: string,
	cellId: string,
	options: CodeBlockProcessorOptions
): void {
	// Create cell wrapper
	const cell = document.createElement("div");
	cell.className = "rb-cell";
	cell.setAttribute("data-rb-cell-id", cellId);

	// Create toolbar (top-right)
	const toolbar = document.createElement("div");
	toolbar.className = "rb-cell-toolbar";

	// Run button
	const runBtn = document.createElement("button");
	runBtn.className = "rb-cell-btn clickable-icon";
	runBtn.setAttribute("aria-label", "Run code");
	setIcon(runBtn, "play");
	toolbar.appendChild(runBtn);

	// Copy code button
	const copyCodeBtn = document.createElement("button");
	copyCodeBtn.className = "rb-cell-btn clickable-icon";
	copyCodeBtn.setAttribute("aria-label", "Copy code");
	setIcon(copyCodeBtn, "copy");
	toolbar.appendChild(copyCodeBtn);

	// Create code area
	const codeArea = document.createElement("div");
	codeArea.className = "rb-cell-code";

	// Create output area
	const outputArea = document.createElement("div");
	outputArea.className = "rb-cell-output is-empty";

	const outputHeader = document.createElement("div");
	outputHeader.className = "rb-cell-output-header";

	const outputTitle = document.createElement("div");
	outputTitle.className = "rb-cell-output-title";
	outputTitle.textContent = "Output";

	const outputActions = document.createElement("div");
	outputActions.className = "rb-cell-output-actions";

	// Copy output button
	const copyOutputBtn = document.createElement("button");
	copyOutputBtn.className = "rb-cell-btn clickable-icon";
	copyOutputBtn.setAttribute("aria-label", "Copy output");
	setIcon(copyOutputBtn, "copy");
	outputActions.appendChild(copyOutputBtn);

	// Clear output button
	const clearOutputBtn = document.createElement("button");
	clearOutputBtn.className = "rb-cell-btn clickable-icon";
	clearOutputBtn.setAttribute("aria-label", "Clear output");
	setIcon(clearOutputBtn, "x");
	outputActions.appendChild(clearOutputBtn);

	outputHeader.appendChild(outputTitle);
	outputHeader.appendChild(outputActions);

	const outputBody = document.createElement("div");
	outputBody.className = "rb-cell-output-body";

	outputArea.appendChild(outputHeader);
	outputArea.appendChild(outputBody);

	// Assemble cell
	cell.appendChild(toolbar);
	cell.appendChild(codeArea);
	cell.appendChild(outputArea);

	// Move the original pre/code into our code area
	preEl.parentNode?.insertBefore(cell, preEl);
	codeArea.appendChild(preEl);

	// Cell state
	const state: CellState = {
		status: "idle",
		outputText: "",
		timestamp: null,
	};

	// Event handlers
	runBtn.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();
		await executeCell(codeEl, options, state, outputArea, outputBody, outputTitle, runBtn);
	});

	copyCodeBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		const code = codeEl.textContent || "";
		navigator.clipboard.writeText(code);
		new Notice("Code copied to clipboard");
	});

	copyOutputBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (state.outputText) {
			navigator.clipboard.writeText(state.outputText);
			new Notice("Output copied to clipboard");
		}
	});

	clearOutputBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		state.status = "idle";
		state.outputText = "";
		state.timestamp = null;
		outputBody.innerHTML = "";
		outputArea.classList.add("is-empty");
		outputArea.classList.remove("has-error");
		outputTitle.textContent = "Output";
	});
}

/**
 * Execute the cell's code
 */
async function executeCell(
	codeEl: HTMLElement,
	options: CodeBlockProcessorOptions,
	state: CellState,
	outputArea: HTMLElement,
	outputBody: HTMLElement,
	outputTitle: HTMLElement,
	runBtn: HTMLElement
): Promise<void> {
	const session = options.getSession();

	if (!session) {
		new Notice("Session not initialized");
		return;
	}

	if (!session.isAlive) {
		new Notice("Shell not running. Restarting...");
		try {
			session.spawn();
		} catch (err) {
			new Notice(`Failed to start shell: ${err}`);
			return;
		}
	}

	const code = codeEl.textContent || "";
	if (!code.trim()) {
		new Notice("Code block is empty");
		return;
	}

	const lines = code.split("\n").filter((line) => line.trim().length > 0);

	// Update state to running
	state.status = "running";
	outputArea.classList.remove("is-empty", "has-error");
	outputBody.innerHTML = '<div class="rb-cell-spinner"></div>';
	outputTitle.textContent = "Running...";
	runBtn.classList.add("is-running");

	try {
		const outputs: string[] = [];

		for (const line of lines) {
			const command = stripPromptPrefix(line.trim());
			if (!command) continue;

			console.log("Runbook: Executing:", command);
			const output = await session.execute(command);
			if (output.trim()) {
				outputs.push(output);
			}
		}

		state.status = "done";
		state.outputText = outputs.join("\n");
		state.timestamp = new Date();

		// Render output
		outputBody.innerHTML = "";
		if (state.outputText.trim()) {
			const pre = document.createElement("pre");
			pre.textContent = state.outputText;
			outputBody.appendChild(pre);
		} else {
			const empty = document.createElement("div");
			empty.className = "rb-cell-output-empty";
			empty.textContent = "(no output)";
			outputBody.appendChild(empty);
		}

		// Update title with timestamp
		const timeStr = state.timestamp.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		outputTitle.textContent = `Output • ${timeStr}`;

	} catch (err) {
		state.status = "error";
		state.outputText = err instanceof Error ? err.message : String(err);
		state.timestamp = new Date();

		outputArea.classList.add("has-error");
		outputBody.innerHTML = "";
		const pre = document.createElement("pre");
		pre.className = "rb-cell-error";
		pre.textContent = state.outputText;
		outputBody.appendChild(pre);

		outputTitle.textContent = "Error";
		console.error("Runbook: Execution failed", err);
	} finally {
		runBtn.classList.remove("is-running");
	}
}
