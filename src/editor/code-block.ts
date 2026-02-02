/**
 * Code block utilities - refactored into focused modules
 *
 * This file re-exports from the new modular structure for backward compatibility.
 * Import from specific modules for better tree-shaking:
 *
 * - ./language - Language detection, normalization, and command building
 * - ./parser - Parsing frontmatter, attributes, and fence detection
 * - ./navigator - Editor navigation and code block context
 * - ./collector - Code block collection for Run All feature
 */

// Language module
export {
	SUPPORTED_LANGUAGES,
	SHELL_LANGUAGES,
	type SupportedLanguage,
	isLanguageSupported,
	normalizeLanguage,
	isShellLanguage,
	getInterpreterType,
	buildInterpreterCommand,
	stripPromptPrefix,
} from "./language";

// Parser module
export {
	type CodeBlockAttributes,
	type FrontmatterConfig,
	type OpeningFenceInfo,
	parseCodeBlockAttributes,
	getOpeningFenceInfo,
	isClosingFence,
	parseFrontmatter,
} from "./parser";

// Navigator module
export {
	type CodeBlockInfo,
	type CodeBlockContext,
	type TextToExecute,
	findCodeBlockAtLine,
	getCodeBlockContext,
	getTextToExecute,
	advanceCursorToNextLine,
} from "./navigator";

// Collector module
export {
	collectCodeBlocks,
	filterCodeBlocks,
	getExecutableBlocks,
	countByLanguage,
} from "./collector";
