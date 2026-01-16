import { MarkdownPostProcessorContext, Notice } from "obsidian";
import { ShellSession } from "../shell/session";
import { isLanguageSupported, stripPromptPrefix } from "../editor/code-block";
import { OutputContainer } from "./output-container";

/**
 * Code Block Processor
 * Adds execute button and output container to supported code blocks in reading view
 */

export interface CodeBlockProcessorOptions {
	getSession: () => ShellSession | null;
}

/**
 * Creates a Markdown post-processor that enhances code blocks with execute functionality
 */
export function createCodeBlockProcessor(options: CodeBlockProcessorOptions) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		// Find all code blocks in this element
		const codeBlocks = el.querySelectorAll("pre > code");

		codeBlocks.forEach((codeEl) => {
			const preEl = codeEl.parentElement;
			if (!preEl) return;

			// Extract language from class (e.g., "language-bash")
			const language = extractLanguage(codeEl);

			// Only process supported languages
			if (!language || !isLanguageSupported(language)) {
				return;
			}

			// Create wrapper to hold code block and output
			const wrapper = document.createElement("div");
			wrapper.className = "runbook-code-wrapper";

			// Insert wrapper before pre, then move pre into wrapper
			preEl.parentNode?.insertBefore(wrapper, preEl);
			wrapper.appendChild(preEl);

			// Add execute button to the code block
			const buttonContainer = createExecuteButton(
				preEl,
				codeEl as HTMLElement,
				language,
				options,
				wrapper
			);

			// Store reference to button container for cleanup
			(preEl as any)._runbookButtonContainer = buttonContainer;
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
 * Create execute button and attach to code block
 */
function createExecuteButton(
	preEl: HTMLElement,
	codeEl: HTMLElement,
	language: string,
	options: CodeBlockProcessorOptions,
	wrapper: HTMLElement
): HTMLElement {
	// Create button container - positioned inside the pre element at top-left
	const buttonContainer = document.createElement("div");
	buttonContainer.className = "runbook-button-container";

	// Create execute button - IntelliJ style green arrow
	const executeBtn = document.createElement("button");
	executeBtn.className = "runbook-execute-btn";
	executeBtn.setAttribute("aria-label", "Execute code block");
	// Use inline SVG with explicit dimensions
	executeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="#4CAF50"><polygon points="6,4 20,12 6,20"/></svg>`;

	buttonContainer.appendChild(executeBtn);

	// Position button inside the pre element (top-left corner)
	preEl.style.position = "relative";
	preEl.insertBefore(buttonContainer, preEl.firstChild);

	// Create output container (initially hidden)
	const outputContainer = new OutputContainer(wrapper);

	// Handle click
	executeBtn.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		await executeCodeBlock(codeEl, language, options, outputContainer, executeBtn);
	});

	return buttonContainer;
}

/**
 * Execute the entire code block
 */
async function executeCodeBlock(
	codeEl: HTMLElement,
	language: string,
	options: CodeBlockProcessorOptions,
	outputContainer: OutputContainer,
	executeBtn: HTMLElement
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

	// Get code content
	const code = codeEl.textContent || "";
	if (!code.trim()) {
		new Notice("Code block is empty");
		return;
	}

	// Process code lines
	const lines = code.split("\n").filter((line) => line.trim().length > 0);

	// Show loading state
	outputContainer.showLoading();
	executeBtn.classList.add("runbook-execute-btn-loading");

	try {
		const outputs: string[] = [];

		// Execute each non-empty line
		for (const line of lines) {
			// Strip prompt prefix if present
			const command = stripPromptPrefix(line.trim());
			if (!command) continue;

			console.log("Runbook: Executing block line:", command);

			const output = await session.execute(command);
			if (output.trim()) {
				outputs.push(output);
			}
		}

		// Show combined output
		const combinedOutput = outputs.join("\n");
		outputContainer.showOutput(combinedOutput);

		console.log("Runbook: Block execution complete", { linesExecuted: lines.length });
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		outputContainer.showError(errorMessage);
		console.error("Runbook: Block execution failed", err);
	} finally {
		executeBtn.classList.remove("runbook-execute-btn-loading");
	}
}
