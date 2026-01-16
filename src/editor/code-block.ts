import { Editor, EditorPosition } from "obsidian";

/**
 * Supported languages for execution
 */
export const SUPPORTED_LANGUAGES = ["bash", "sh", "zsh", "shell", "python", "py"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Information about a code block
 */
export interface CodeBlockInfo {
	language: string;
	startLine: number;
	endLine: number;
	content: string;
}

/**
 * Result of detecting code block context
 */
export interface CodeBlockContext {
	inCodeBlock: boolean;
	codeBlock: CodeBlockInfo | null;
	currentLine: string;
	currentLineNumber: number;
	selectedText: string | null;
}

/**
 * Check if a language is supported for execution
 */
export function isLanguageSupported(language: string): boolean {
	const normalized = language.toLowerCase().trim();
	return SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage);
}

/**
 * Normalize language aliases to canonical form
 */
export function normalizeLanguage(language: string): string {
	const normalized = language.toLowerCase().trim();

	// Map aliases to canonical names
	const aliases: Record<string, string> = {
		sh: "bash",
		shell: "bash",
		zsh: "bash",
		py: "python",
	};

	return aliases[normalized] || normalized;
}

/**
 * Detect if the cursor is inside a fenced code block
 * and return information about the context
 */
export function getCodeBlockContext(editor: Editor): CodeBlockContext {
	const cursor = editor.getCursor();
	const currentLineNumber = cursor.line;
	const currentLine = editor.getLine(currentLineNumber);

	// Get selection if any
	const selection = editor.getSelection();
	const selectedText = selection.length > 0 ? selection : null;

	// Find code block boundaries
	const codeBlock = findCodeBlockAtLine(editor, currentLineNumber);

	return {
		inCodeBlock: codeBlock !== null,
		codeBlock,
		currentLine,
		currentLineNumber,
		selectedText,
	};
}

/**
 * Find the code block that contains the given line number
 */
export function findCodeBlockAtLine(editor: Editor, lineNumber: number): CodeBlockInfo | null {
	const totalLines = editor.lineCount();

	// Search backwards for opening fence
	let startLine = -1;
	let language = "";

	for (let i = lineNumber; i >= 0; i--) {
		const line = editor.getLine(i);

		// Check for opening fence FIRST (handles bare ``` which could be either)
		const openMatch = getOpeningFenceInfo(line);
		if (openMatch) {
			startLine = i;
			language = openMatch.language;
			break;
		}

		// Check for closing fence (means we're not in a code block)
		if (i < lineNumber && isClosingFence(line)) {
			return null;
		}
	}

	// No opening fence found
	if (startLine === -1) {
		return null;
	}

	// If cursor is on the opening fence line, not "inside" the code block
	if (lineNumber === startLine) {
		return null;
	}

	// Search forwards for closing fence
	let endLine = -1;

	for (let i = startLine + 1; i < totalLines; i++) {
		const line = editor.getLine(i);

		if (isClosingFence(line)) {
			endLine = i;
			break;
		}
	}

	// No closing fence found (unclosed code block)
	if (endLine === -1) {
		return null;
	}

	// If cursor is on or after the closing fence, not inside
	if (lineNumber >= endLine) {
		return null;
	}

	// Extract content (lines between fences, not including fences)
	const contentLines: string[] = [];
	for (let i = startLine + 1; i < endLine; i++) {
		contentLines.push(editor.getLine(i));
	}

	return {
		language,
		startLine,
		endLine,
		content: contentLines.join("\n"),
	};
}

/**
 * Check if a line is an opening fence and extract language
 * Only matches fences WITH a language specifier (required for execution)
 */
export function getOpeningFenceInfo(line: string): { language: string } | null {
	// Match ``` or ~~~ followed by REQUIRED language
	const match = line.match(/^(`{3,}|~{3,})(\w+)\s*$/);

	if (match) {
		return { language: match[2] };
	}

	return null;
}

/**
 * Check if a line is a closing fence
 */
export function isClosingFence(line: string): boolean {
	return /^(`{3,}|~{3,})\s*$/.test(line);
}

/**
 * Get the text to execute based on selection or current line
 */
export function getTextToExecute(editor: Editor): { text: string; isSelection: boolean } | null {
	const context = getCodeBlockContext(editor);

	if (!context.inCodeBlock || !context.codeBlock) {
		return null;
	}

	if (context.selectedText) {
		return { text: context.selectedText, isSelection: true };
	}

	// Use current line (strip leading/trailing whitespace but preserve internal)
	const text = context.currentLine.trim();
	if (text.length === 0) {
		return null;
	}

	return { text, isSelection: false };
}

/**
 * Move cursor to the next non-empty line within the code block
 */
export function advanceCursorToNextLine(editor: Editor): boolean {
	const context = getCodeBlockContext(editor);

	if (!context.inCodeBlock || !context.codeBlock) {
		return false;
	}

	const { currentLineNumber, codeBlock } = context;

	// Find next non-empty line within the code block
	for (let i = currentLineNumber + 1; i < codeBlock.endLine; i++) {
		const line = editor.getLine(i);
		if (line.trim().length > 0) {
			// Move cursor to beginning of this line
			editor.setCursor({ line: i, ch: 0 });
			return true;
		}
	}

	// No more non-empty lines, just move to next line if within block
	if (currentLineNumber + 1 < codeBlock.endLine) {
		editor.setCursor({ line: currentLineNumber + 1, ch: 0 });
		return true;
	}

	return false;
}

/**
 * Strip common prompt prefixes from command text
 */
export function stripPromptPrefix(text: string): string {
	// Strip leading $ or > followed by space
	return text.replace(/^[\$\>]\s+/, "");
}
