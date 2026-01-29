import { Editor, EditorPosition } from "obsidian";

/**
 * Supported languages for execution
 */
export const SUPPORTED_LANGUAGES = [
	"bash", "sh", "zsh", "shell",
	"python", "py",
	"javascript", "js",
	"typescript", "ts",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Shell languages that execute directly in the PTY
 */
export const SHELL_LANGUAGES = ["bash", "sh", "zsh", "shell"] as const;

/**
 * Runme-compatible code block attributes
 * Parsed from JSON after language tag: ```sh {"name":"setup","cwd":"/tmp"}
 */
export interface CodeBlockAttributes {
	name?: string;
	excludeFromRunAll?: boolean;
	cwd?: string;
	[key: string]: unknown; // Forward-compatible with unknown attributes
}

/**
 * Document-level configuration from frontmatter
 */
export interface FrontmatterConfig {
	shell?: string;
	cwd?: string;
}

/**
 * Information about a code block
 */
export interface CodeBlockInfo {
	language: string;
	startLine: number;
	endLine: number;
	content: string;
	attributes: CodeBlockAttributes;
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
		js: "javascript",
		ts: "typescript",
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
	let attributes: CodeBlockAttributes = {};

	for (let i = lineNumber; i >= 0; i--) {
		const line = editor.getLine(i);

		// Check for opening fence FIRST (handles bare ``` which could be either)
		const openMatch = getOpeningFenceInfo(line);
		if (openMatch) {
			startLine = i;
			language = openMatch.language;
			attributes = openMatch.attributes;
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
		attributes,
	};
}

/**
 * Check if a line is an opening fence and extract language + optional attributes
 * Only matches fences WITH a language specifier (required for execution)
 * Supports Runme-compatible JSON attributes: ```sh {"name":"setup","cwd":"/tmp"}
 */
export function getOpeningFenceInfo(line: string): { language: string; attributes: CodeBlockAttributes } | null {
	// Match ``` or ~~~ followed by REQUIRED language, then optional JSON attributes
	const match = line.match(/^(`{3,}|~{3,})(\w+)\s*(.*?)\s*$/);

	if (!match) {
		return null;
	}

	const language = match[2];
	const attributesStr = match[3];

	// Parse JSON attributes if present
	let attributes: CodeBlockAttributes = {};
	if (attributesStr) {
		attributes = parseCodeBlockAttributes(attributesStr);
	}

	return { language, attributes };
}

/**
 * Parse Runme-compatible JSON attributes from code block fence line
 */
export function parseCodeBlockAttributes(str: string): CodeBlockAttributes {
	const trimmed = str.trim();
	if (!trimmed) return {};

	try {
		const parsed = JSON.parse(trimmed);
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as CodeBlockAttributes;
		}
	} catch {
		// Not valid JSON - ignore gracefully (forward-compatible)
	}
	return {};
}

/**
 * Parse frontmatter from document content
 * Supports YAML-style frontmatter between --- delimiters
 */
export function parseFrontmatter(content: string): FrontmatterConfig {
	const config: FrontmatterConfig = {};

	// Match YAML frontmatter between --- delimiters
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return config;

	const yaml = match[1];
	const lines = yaml.split("\n");

	for (const line of lines) {
		const kvMatch = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
		if (!kvMatch) continue;

		const key = kvMatch[1].toLowerCase();
		const value = kvMatch[2].replace(/^["']|["']$/g, ""); // Strip surrounding quotes

		if (key === "shell") {
			config.shell = value;
		} else if (key === "cwd") {
			config.cwd = value;
		}
	}

	return config;
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

/**
 * Check if a language is a shell language (executed directly in PTY)
 */
export function isShellLanguage(language: string): boolean {
	const normalized = language.toLowerCase().trim();
	return (SHELL_LANGUAGES as readonly string[]).includes(normalized);
}

/**
 * Build the command to execute a code block in the appropriate interpreter.
 * Shell languages return lines as-is. Other languages wrap in interpreter commands.
 */
export function buildInterpreterCommand(code: string, language: string): string {
	const normalized = normalizeLanguage(language);

	switch (normalized) {
		case "python": {
			// Use python3 -c for inline execution
			// Escape single quotes in the code
			const escaped = code.replace(/'/g, "'\\''");
			return `python3 -c '${escaped}'`;
		}
		case "javascript": {
			const escaped = code.replace(/'/g, "'\\''");
			return `node -e '${escaped}'`;
		}
		case "typescript": {
			const escaped = code.replace(/'/g, "'\\''");
			return `npx tsx -e '${escaped}'`;
		}
		default:
			// Shell languages - return code as-is
			return code;
	}
}

/**
 * Collect all code blocks from document content (for Run All)
 */
export function collectCodeBlocks(content: string): CodeBlockInfo[] {
	const blocks: CodeBlockInfo[] = [];
	const lines = content.split("\n");

	let i = 0;
	while (i < lines.length) {
		const openMatch = getOpeningFenceInfo(lines[i]);
		if (openMatch) {
			const startLine = i;
			const language = openMatch.language;
			const attributes = openMatch.attributes;

			// Find closing fence
			let endLine = -1;
			for (let j = i + 1; j < lines.length; j++) {
				if (isClosingFence(lines[j])) {
					endLine = j;
					break;
				}
			}

			if (endLine !== -1) {
				const contentLines = lines.slice(startLine + 1, endLine);
				blocks.push({
					language,
					startLine,
					endLine,
					content: contentLines.join("\n"),
					attributes,
				});
				i = endLine + 1;
				continue;
			}
		}
		i++;
	}

	return blocks;
}
