import { MarkdownPostProcessorContext, Notice, setIcon } from "obsidian";
import {
	isLanguageSupported,
	isShellLanguage,
	buildInterpreterCommand,
	stripPromptPrefix,
	getOpeningFenceInfo,
	CodeBlockAttributes,
} from "../editor/code-block";

/**
 * Code Block Processor
 * Adds a run button to code blocks that executes in the terminal
 */

// Interface for terminal view (works with both old TerminalView and new XtermView)
interface ITerminalView {
	writeCommand?(command: string): void;
	executeFromCodeBlock?(command: string, language: string): Promise<string>;
}

export interface CodeBlockProcessorOptions {
	getTerminalView: () => ITerminalView | null;
	createTerminal: () => Promise<void>;
	/**
	 * Execute a full code block with language-aware routing and attribute support.
	 * When provided, the play button uses this instead of raw line-by-line execution.
	 */
	executeBlock?: (code: string, language: string, attributes: CodeBlockAttributes) => Promise<void>;
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

			// Try to extract Runme-compatible attributes from the source fence line
			const attributes = extractAttributes(el, ctx);

			// Add run button to the code block
			addRunButton(preEl, codeEl as HTMLElement, language, attributes, options);
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
 * Extract Runme-compatible attributes from the source markdown via section info
 */
function extractAttributes(el: HTMLElement, ctx: MarkdownPostProcessorContext): CodeBlockAttributes {
	try {
		const sectionInfo = ctx.getSectionInfo(el);
		if (sectionInfo) {
			const lines = sectionInfo.text.split("\n");
			const fenceLine = lines[sectionInfo.lineStart];
			if (fenceLine) {
				const info = getOpeningFenceInfo(fenceLine);
				if (info) {
					return info.attributes;
				}
			}
		}
	} catch {
		// getSectionInfo may not be available in all contexts
	}
	return {};
}

/**
 * Add a run button to a code block
 */
function addRunButton(
	preEl: HTMLElement,
	codeEl: HTMLElement,
	language: string,
	attributes: CodeBlockAttributes,
	options: CodeBlockProcessorOptions
): void {
	// Run button - positioned at top-right next to native copy button
	const runBtn = document.createElement("button");
	runBtn.className = "rb-run-button clickable-icon";
	runBtn.setAttribute("aria-label", "Run code in terminal");
	setIcon(runBtn, "play");

	// Add run button inside pre element
	preEl.appendChild(runBtn);

	let isRunning = false;

	// Click handler - execute in terminal
	const handleRunClick = async (e: MouseEvent): Promise<void> => {
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
			// Use the executeBlock callback if available (handles cwd, multi-lang, session isolation)
			if (options.executeBlock) {
				await options.executeBlock(code, language, attributes);
				return;
			}

			// Fallback: direct terminal execution (legacy path)
			let terminalView = options.getTerminalView();
			if (!terminalView) {
				await options.createTerminal();
				await new Promise(resolve => setTimeout(resolve, 200));
				terminalView = options.getTerminalView();
			}

			if (!terminalView) {
				new Notice("Failed to create terminal");
				return;
			}

			await executeInTerminal(terminalView, code, language, attributes);
		} catch (err) {
			new Notice(`Execution failed: ${err}`);
			console.error("Runbook: Execution failed", err);
		} finally {
			isRunning = false;
			runBtn.classList.remove("is-running");
		}
	};
	runBtn.addEventListener("click", (e) => {
		void handleRunClick(e);
	});
}

/**
 * Execute code in terminal with language-aware routing and cwd support
 */
async function executeInTerminal(
	terminalView: ITerminalView,
	code: string,
	language: string,
	attributes: CodeBlockAttributes
): Promise<void> {
	if (!terminalView.writeCommand) return;

	// Handle per-cell cwd
	if (attributes.cwd) {
		terminalView.writeCommand(`cd ${attributes.cwd}`);
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	if (isShellLanguage(language)) {
		// Shell: execute each line
		const lines = code.split("\n").filter((line) => line.trim().length > 0);
		for (const line of lines) {
			const command = stripPromptPrefix(line.trim());
			if (!command) continue;
			terminalView.writeCommand(command);
			await new Promise(resolve => setTimeout(resolve, 100));
		}
	} else {
		// Non-shell: wrap entire block in interpreter command
		const command = buildInterpreterCommand(code, language);
		terminalView.writeCommand(command);
	}
}
