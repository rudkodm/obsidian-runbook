import { MarkdownPostProcessorContext, Notice, setIcon } from "obsidian";
import { isLanguageSupported, stripPromptPrefix } from "../editor/code-block";
import { TerminalView } from "../terminal/terminal-view";

/**
 * Code Block Processor
 * Adds a run button to code blocks that executes in the terminal
 */

export interface CodeBlockProcessorOptions {
	getTerminalView: () => TerminalView | null;
	createTerminal: () => Promise<void>;
}

/**
 * Creates a Markdown post-processor that adds run buttons to code blocks
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

			// Add run button to the code block
			addRunButton(preEl, codeEl as HTMLElement, language, options);
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
 * Add a run button to a code block
 */
function addRunButton(
	preEl: HTMLElement,
	codeEl: HTMLElement,
	language: string,
	options: CodeBlockProcessorOptions
): void {
	// Run button - will be added inside <pre> element (next to native copy button)
	const runBtn = document.createElement("button");
	runBtn.className = "rb-run-button clickable-icon";
	runBtn.setAttribute("aria-label", "Run code in terminal");
	setIcon(runBtn, "play");

	// Add run button inside pre element
	preEl.appendChild(runBtn);

	let isRunning = false;

	// Click handler - execute in terminal
	runBtn.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		if (isRunning) return;

		const code = codeEl.textContent || "";
		if (!code.trim()) {
			new Notice("Code block is empty");
			return;
		}

		isRunning = true;
		runBtn.classList.add("is-running");

		try {
			// Get or create terminal
			let terminalView = options.getTerminalView();
			if (!terminalView) {
				await options.createTerminal();
				// Wait for terminal to be ready
				await new Promise(resolve => setTimeout(resolve, 200));
				terminalView = options.getTerminalView();
			}

			if (!terminalView) {
				new Notice("Failed to create terminal");
				return;
			}

			// Execute each line in terminal
			const lines = code.split("\n").filter((line) => line.trim().length > 0);
			for (const line of lines) {
				const command = stripPromptPrefix(line.trim());
				if (!command) continue;

				await terminalView.executeFromCodeBlock(command, language);
			}
		} catch (err) {
			new Notice(`Execution failed: ${err}`);
			console.error("Runbook: Execution failed", err);
		} finally {
			isRunning = false;
			runBtn.classList.remove("is-running");
		}
	});
}
