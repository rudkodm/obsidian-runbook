import { Editor } from "obsidian";
import { CodeBlockAttributes } from "./parser";
import { getOpeningFenceInfo, isClosingFence } from "./parser";

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a code block
 */
export interface CodeBlockInfo {
	readonly language: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly content: string;
	readonly attributes: CodeBlockAttributes;
}

/**
 * Result of detecting code block context
 */
export interface CodeBlockContext {
	readonly inCodeBlock: boolean;
	readonly codeBlock: CodeBlockInfo | null;
	readonly currentLine: string;
	readonly currentLineNumber: number;
	readonly selectedText: string | null;
}

/**
 * Text to execute with metadata
 */
export interface TextToExecute {
	readonly text: string;
	readonly isSelection: boolean;
}

// ============================================================================
// Editor Queries (Read-only)
// ============================================================================

/**
 * Get the current line from editor
 */
const getCurrentLine = (editor: Editor): [string, number] => {
	const cursor = editor.getCursor();
	const lineNumber = cursor.line;
	const line = editor.getLine(lineNumber);
	return [line, lineNumber];
};

/**
 * Get selected text from editor
 */
const getSelectedText = (editor: Editor): string | null => {
	const selection = editor.getSelection();
	return selection.length > 0 ? selection : null;
};

/**
 * Extract content lines between start and end
 */
const extractContentLines = (
	editor: Editor,
	startLine: number,
	endLine: number
): string[] => {
	const lines: string[] = [];

	for (let i = startLine + 1; i < endLine; i++) {
		lines.push(editor.getLine(i));
	}

	return lines;
};

// ============================================================================
// Code Block Detection
// ============================================================================

/**
 * Find opening fence by searching backwards from a line
 */
const findOpeningFence = (
	editor: Editor,
	fromLine: number
): { line: number; language: string; attributes: CodeBlockAttributes } | null => {
	for (let i = fromLine; i >= 0; i--) {
		const line = editor.getLine(i);

		// Check for opening fence
		const openMatch = getOpeningFenceInfo(line);
		if (openMatch) {
			return {
				line: i,
				language: openMatch.language,
				attributes: openMatch.attributes,
			};
		}

		// Check for closing fence (means we're not in a code block)
		if (i < fromLine && isClosingFence(line)) {
			return null;
		}
	}

	return null;
};

/**
 * Find closing fence by searching forwards from a line
 */
const findClosingFence = (
	editor: Editor,
	fromLine: number
): number | null => {
	const totalLines = editor.lineCount();

	for (let i = fromLine + 1; i < totalLines; i++) {
		const line = editor.getLine(i);

		if (isClosingFence(line)) {
			return i;
		}
	}

	return null;
};

/**
 * Check if line number is within code block bounds
 */
const isWithinBlock = (
	lineNumber: number,
	startLine: number,
	endLine: number
): boolean =>
	lineNumber > startLine && lineNumber < endLine;

/**
 * Find the code block that contains the given line number
 */
export const findCodeBlockAtLine = (
	editor: Editor,
	lineNumber: number
): CodeBlockInfo | null => {
	// Search for opening fence
	const opening = findOpeningFence(editor, lineNumber);

	if (!opening) {
		return null;
	}

	// If cursor is on the opening fence line, not "inside" the code block
	if (lineNumber === opening.line) {
		return null;
	}

	// Search for closing fence
	const closingLine = findClosingFence(editor, opening.line);

	// No closing fence found (unclosed code block)
	if (closingLine === null) {
		return null;
	}

	// Check if cursor is within the block
	if (!isWithinBlock(lineNumber, opening.line, closingLine)) {
		return null;
	}

	// Extract content
	const contentLines = extractContentLines(editor, opening.line, closingLine);

	return {
		language: opening.language,
		startLine: opening.line,
		endLine: closingLine,
		content: contentLines.join("\n"),
		attributes: opening.attributes,
	};
};

/**
 * Detect if the cursor is inside a fenced code block
 * and return information about the context
 */
export const getCodeBlockContext = (editor: Editor): CodeBlockContext => {
	const [currentLine, currentLineNumber] = getCurrentLine(editor);
	const selectedText = getSelectedText(editor);
	const codeBlock = findCodeBlockAtLine(editor, currentLineNumber);

	return {
		inCodeBlock: codeBlock !== null,
		codeBlock,
		currentLine,
		currentLineNumber,
		selectedText,
	};
};

/**
 * Get the text to execute based on selection or current line
 */
export const getTextToExecute = (editor: Editor): TextToExecute | null => {
	const context = getCodeBlockContext(editor);

	if (!context.inCodeBlock || !context.codeBlock) {
		return null;
	}

	// Use selection if available
	if (context.selectedText) {
		return {
			text: context.selectedText,
			isSelection: true,
		};
	}

	// Use current line (strip leading/trailing whitespace)
	const text = context.currentLine.trim();

	if (text.length === 0) {
		return null;
	}

	return {
		text,
		isSelection: false,
	};
};

// ============================================================================
// Editor Mutations (Write operations)
// ============================================================================

/**
 * Find next non-empty line within code block
 */
const findNextNonEmptyLine = (
	editor: Editor,
	fromLine: number,
	endLine: number
): number | null => {
	for (let i = fromLine + 1; i < endLine; i++) {
		const line = editor.getLine(i);

		if (line.trim().length > 0) {
			return i;
		}
	}

	return null;
};

/**
 * Move cursor to the next non-empty line within the code block
 * Returns true if cursor was moved
 */
export const advanceCursorToNextLine = (editor: Editor): boolean => {
	const context = getCodeBlockContext(editor);

	if (!context.inCodeBlock || !context.codeBlock) {
		return false;
	}

	const { currentLineNumber, codeBlock } = context;

	// Try to find next non-empty line
	const nextLine = findNextNonEmptyLine(
		editor,
		currentLineNumber,
		codeBlock.endLine
	);

	if (nextLine !== null) {
		editor.setCursor({ line: nextLine, ch: 0 });
		return true;
	}

	// No more non-empty lines, just move to next line if within block
	if (currentLineNumber + 1 < codeBlock.endLine) {
		editor.setCursor({ line: currentLineNumber + 1, ch: 0 });
		return true;
	}

	return false;
};
