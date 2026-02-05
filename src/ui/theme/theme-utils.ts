import { ANSI_PALETTE } from "./ansi-colors";

// ============================================================================
// Types
// ============================================================================

/**
 * Obsidian CSS variable names
 */
export interface ObsidianThemeVars {
	readonly background: string;
	readonly foreground: string;
	readonly accent: string;
	readonly selection: string;
	readonly monospace: string;
}

/**
 * Terminal theme configuration for xterm.js
 */
export interface TerminalTheme {
	readonly background: string;
	readonly foreground: string;
	readonly cursor: string;
	readonly cursorAccent: string;
	readonly selectionBackground: string;
	// ANSI colors
	readonly black: string;
	readonly red: string;
	readonly green: string;
	readonly yellow: string;
	readonly blue: string;
	readonly magenta: string;
	readonly cyan: string;
	readonly white: string;
	readonly brightBlack: string;
	readonly brightRed: string;
	readonly brightGreen: string;
	readonly brightYellow: string;
	readonly brightBlue: string;
	readonly brightMagenta: string;
	readonly brightCyan: string;
	readonly brightWhite: string;
}

// ============================================================================
// CSS Variable Extraction
// ============================================================================

/**
 * Get computed style value from CSS variable
 */
const getCssVar = (varName: string, fallback: string = ""): string => {
	const value = getComputedStyle(document.body)
		.getPropertyValue(varName)
		.trim();
	return value || fallback;
};

/**
 * Extract Obsidian theme variables
 */
export const getObsidianThemeVars = (): ObsidianThemeVars => ({
	background: getCssVar("--background-primary", "#1e1e1e"),
	foreground: getCssVar("--text-normal", "#d4d4d4"),
	accent: getCssVar("--text-accent", "#569cd6"),
	selection: getCssVar("--text-selection", "#264f78"),
	monospace: getCssVar("--font-monospace", "monospace"),
});

// ============================================================================
// Terminal Theme Creation
// ============================================================================

/**
 * Create terminal theme from Obsidian CSS variables
 * Uses Obsidian's theme colors with fallback ANSI palette
 */
export const createTerminalTheme = (): TerminalTheme => {
	const vars = getObsidianThemeVars();
	const palette = ANSI_PALETTE;

	return {
		background: vars.background,
		foreground: vars.foreground,
		cursor: vars.accent,
		cursorAccent: vars.background,
		selectionBackground: vars.selection,
		// ANSI colors from palette
		black: palette.normal[0],
		red: palette.normal[1],
		green: palette.normal[2],
		yellow: palette.normal[3],
		blue: palette.normal[4],
		magenta: palette.normal[5],
		cyan: palette.normal[6],
		white: palette.normal[7],
		brightBlack: palette.bright[0],
		brightRed: palette.bright[1],
		brightGreen: palette.bright[2],
		brightYellow: palette.bright[3],
		brightBlue: palette.bright[4],
		brightMagenta: palette.bright[5],
		brightCyan: palette.bright[6],
		brightWhite: palette.bright[7],
	};
};

/**
 * Convert terminal theme to xterm.js ITheme format
 * Returns Record<string, string> for compatibility
 */
export const getXtermTheme = (): Record<string, string> => {
	const theme = createTerminalTheme();
	return theme as unknown as Record<string, string>;
};

// ============================================================================
// Font Family
// ============================================================================

/**
 * Default monospace font stack for terminals
 */
export const MONOSPACE_FONTS = [
	"var(--font-monospace)",
	"Menlo",
	"Monaco",
	"'Courier New'",
	"monospace",
] as const;

/**
 * Get terminal font family as CSS string
 */
export const getTerminalFontFamily = (): string =>
	MONOSPACE_FONTS.join(", ");

// ============================================================================
// Theme Detection
// ============================================================================

/**
 * Check if Obsidian is in dark mode
 */
export const isDarkTheme = (): boolean => {
	const background = getCssVar("--background-primary", "#1e1e1e");
	// Simple heuristic: parse hex color and check lightness
	const hex = background.replace("#", "");
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	const lightness = (r + g + b) / 3;
	return lightness < 128;
};

/**
 * Get contrast color (black or white) for a background color
 */
export const getContrastColor = (backgroundColor: string): string => {
	const hex = backgroundColor.replace("#", "");
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	const lightness = (r * 299 + g * 587 + b * 114) / 1000;
	return lightness > 128 ? "#000000" : "#ffffff";
};
