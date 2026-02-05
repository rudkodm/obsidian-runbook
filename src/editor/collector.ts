import { CodeBlockInfo } from "./navigator";
import { getOpeningFenceInfo, isClosingFence } from "./parser";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of searching for a closing fence
 */
interface ClosingFenceResult {
	readonly found: boolean;
	readonly line: number;
}

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Search for closing fence starting from a line
 */
const findClosingFenceInLines = (
	lines: readonly string[],
	startIndex: number
): ClosingFenceResult => {
	for (let i = startIndex + 1; i < lines.length; i++) {
		if (isClosingFence(lines[i])) {
			return { found: true, line: i };
		}
	}

	return { found: false, line: -1 };
};

/**
 * Extract content between fences
 */
const extractContent = (
	lines: readonly string[],
	startLine: number,
	endLine: number
): string => {
	const contentLines = lines.slice(startLine + 1, endLine);
	return contentLines.join("\n");
};

/**
 * Create code block info from parsed data
 */
const createCodeBlockInfo = (
	language: string,
	startLine: number,
	endLine: number,
	content: string,
	attributes: Record<string, unknown>
): CodeBlockInfo => ({
	language,
	startLine,
	endLine,
	content,
	attributes,
});

// ============================================================================
// Collection
// ============================================================================

/**
 * Collect all code blocks from document content (for Run All)
 * Returns array of code block info in document order
 */
export const collectCodeBlocks = (content: string): readonly CodeBlockInfo[] => {
	const blocks: CodeBlockInfo[] = [];
	const lines = content.split("\n");

	let i = 0;

	while (i < lines.length) {
		const openMatch = getOpeningFenceInfo(lines[i]);

		if (!openMatch) {
			i++;
			continue;
		}

		const startLine = i;
		const closingResult = findClosingFenceInLines(lines, i);

		if (!closingResult.found) {
			// Unclosed code block - skip it
			i++;
			continue;
		}

		const content = extractContent(lines, startLine, closingResult.line);

		blocks.push(
			createCodeBlockInfo(
				openMatch.language,
				startLine,
				closingResult.line,
				content,
				openMatch.attributes
			)
		);

		i = closingResult.line + 1;
	}

	return blocks;
};

/**
 * Filter code blocks by predicate
 */
export const filterCodeBlocks = (
	blocks: readonly CodeBlockInfo[],
	predicate: (block: CodeBlockInfo) => boolean
): readonly CodeBlockInfo[] => blocks.filter(predicate);

/**
 * Filter code blocks to only executable ones
 * (excludes blocks marked with excludeFromRunAll)
 */
export const getExecutableBlocks = (
	blocks: readonly CodeBlockInfo[]
): readonly CodeBlockInfo[] =>
	filterCodeBlocks(
		blocks,
		block => !block.attributes.excludeFromRunAll
	);

/**
 * Count code blocks by language
 */
export const countByLanguage = (
	blocks: readonly CodeBlockInfo[]
): Readonly<Record<string, number>> => {
	const counts: Record<string, number> = {};

	for (const block of blocks) {
		const lang = block.language.toLowerCase();
		counts[lang] = (counts[lang] ?? 0) + 1;
	}

	return counts;
};
