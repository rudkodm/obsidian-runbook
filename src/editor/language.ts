import { InterpreterType } from "../shell/types";
import {
	isLanguageSupported as registryHasLanguage,
	normalizeLanguageName,
	isShellLanguage as registryIsShell,
	getInterpreterType as registryGetInterpreterType,
} from "./language-registry";

// ============================================================================
// Re-export from Registry (Backward Compatibility)
// ============================================================================

/**
 * Check if a language is supported for execution
 */
export const isLanguageSupported = (language: string): boolean =>
	registryHasLanguage(language);

/**
 * Normalize language aliases to canonical form
 * @example normalizeLanguage("py") // "python"
 * @example normalizeLanguage("sh") // "bash"
 */
export const normalizeLanguage = (language: string): string =>
	normalizeLanguageName(language);

/**
 * Check if a language is a shell language (executed directly in PTY)
 */
export const isShellLanguage = (language: string): boolean =>
	registryIsShell(language);

/**
 * Get the interpreter type for a language (non-shell languages only).
 * Returns null for shell languages.
 */
export const getInterpreterType = (
	language: string
): InterpreterType | null =>
	registryGetInterpreterType(language) ?? null;

// ============================================================================
// Legacy Constants (for backward compatibility)
// ============================================================================

/** Supported languages for execution */
export const SUPPORTED_LANGUAGES = [
	"bash", "sh", "zsh", "shell",
	"python", "py",
	"javascript", "js",
	"typescript", "ts",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Shell languages that execute directly in the PTY */
export const SHELL_LANGUAGES = ["bash", "sh", "zsh", "shell"] as const;

// ============================================================================
// Command Building
// ============================================================================

/**
 * Escape single quotes in code for shell execution
 */
const escapeSingleQuotes = (code: string): string =>
	code.replace(/'/g, "'\\''");

/**
 * Build the command to execute code in Python
 */
const buildPythonCommand = (code: string): string =>
	`python3 -c '${escapeSingleQuotes(code)}'`;

/**
 * Build the command to execute code in Node.js
 */
const buildNodeCommand = (code: string): string =>
	`node -e '${escapeSingleQuotes(code)}'`;

/**
 * Build the command to execute code in TypeScript
 */
const buildTypeScriptCommand = (code: string): string =>
	`npx tsx -e '${escapeSingleQuotes(code)}'`;

/**
 * Build the command to execute a code block in the appropriate interpreter.
 * Shell languages return code as-is. Other languages wrap in interpreter commands.
 */
export const buildInterpreterCommand = (code: string, language: string): string => {
	const normalized = normalizeLanguage(language);

	switch (normalized) {
		case "python":
			return buildPythonCommand(code);
		case "javascript":
			return buildNodeCommand(code);
		case "typescript":
			return buildTypeScriptCommand(code);
		default:
			// Shell languages - return code as-is
			return code;
	}
};

/**
 * Strip common prompt prefixes from command text
 * @example stripPromptPrefix("$ ls -la") // "ls -la"
 * @example stripPromptPrefix("> echo hello") // "echo hello"
 */
export const stripPromptPrefix = (text: string): string =>
	text.replace(/^[$>]\s+/, "");
