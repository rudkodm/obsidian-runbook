/**
 * ANSI Escape Codes
 * Terminal color and formatting escape sequences
 */

// ============================================================================
// Basic ANSI Control Codes
// ============================================================================

export const ANSI = {
	/** Reset all formatting */
	RESET: "\x1b[0m",
	/** Clear current line */
	CLEAR_LINE: "\x1b[K",
} as const;

// ============================================================================
// Standard Colors (30-37)
// ============================================================================

export const ANSI_COLORS = {
	BLACK: "\x1b[30m",
	RED: "\x1b[31m",
	GREEN: "\x1b[32m",
	YELLOW: "\x1b[33m",
	BLUE: "\x1b[34m",
	MAGENTA: "\x1b[35m",
	CYAN: "\x1b[36m",
	WHITE: "\x1b[37m",
	GRAY: "\x1b[90m", // Bright black
} as const;

// ============================================================================
// Bright Colors (90-97)
// ============================================================================

export const ANSI_BRIGHT_COLORS = {
	BRIGHT_BLACK: "\x1b[90m",
	BRIGHT_RED: "\x1b[91m",
	BRIGHT_GREEN: "\x1b[92m",
	BRIGHT_YELLOW: "\x1b[93m",
	BRIGHT_BLUE: "\x1b[94m",
	BRIGHT_MAGENTA: "\x1b[95m",
	BRIGHT_CYAN: "\x1b[96m",
	BRIGHT_WHITE: "\x1b[97m",
} as const;

// ============================================================================
// Background Colors (40-47)
// ============================================================================

export const ANSI_BG_COLORS = {
	BG_BLACK: "\x1b[40m",
	BG_RED: "\x1b[41m",
	BG_GREEN: "\x1b[42m",
	BG_YELLOW: "\x1b[43m",
	BG_BLUE: "\x1b[44m",
	BG_MAGENTA: "\x1b[45m",
	BG_CYAN: "\x1b[46m",
	BG_WHITE: "\x1b[47m",
} as const;

// ============================================================================
// Text Formatting
// ============================================================================

export const ANSI_FORMATTING = {
	BOLD: "\x1b[1m",
	DIM: "\x1b[2m",
	ITALIC: "\x1b[3m",
	UNDERLINE: "\x1b[4m",
	BLINK: "\x1b[5m",
	REVERSE: "\x1b[7m",
	HIDDEN: "\x1b[8m",
	STRIKETHROUGH: "\x1b[9m",
} as const;

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * All ANSI codes combined for easy access
 */
export const ANSI_ALL = {
	...ANSI,
	...ANSI_COLORS,
	...ANSI_BRIGHT_COLORS,
	...ANSI_BG_COLORS,
	...ANSI_FORMATTING,
} as const;

// ============================================================================
// Color Palette (for xterm.js theme)
// ============================================================================

/**
 * Default ANSI color palette (16 colors)
 * Used by xterm.js for terminal rendering
 */
export const ANSI_PALETTE = {
	/** Normal colors (0-7) */
	normal: [
		"#000000", // Black
		"#cd3131", // Red
		"#0dbc79", // Green
		"#e5e510", // Yellow
		"#2472c8", // Blue
		"#bc3fbc", // Magenta
		"#11a8cd", // Cyan
		"#e5e5e5", // White
	] as const,

	/** Bright colors (8-15) */
	bright: [
		"#666666", // Bright Black (Gray)
		"#f14c4c", // Bright Red
		"#23d18b", // Bright Green
		"#f5f543", // Bright Yellow
		"#3b8eea", // Bright Blue
		"#d670d6", // Bright Magenta
		"#29b8db", // Bright Cyan
		"#ffffff", // Bright White
	] as const,
} as const;

/**
 * Get full 16-color ANSI palette as array
 */
export const getAnsiPalette = (): readonly string[] => [
	...ANSI_PALETTE.normal,
	...ANSI_PALETTE.bright,
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap text with ANSI color
 */
export const colorize = (text: string, color: string): string =>
	`${color}${text}${ANSI.RESET}`;

/**
 * Create colored text helpers
 */
export const colored = {
	red: (text: string) => colorize(text, ANSI_COLORS.RED),
	green: (text: string) => colorize(text, ANSI_COLORS.GREEN),
	yellow: (text: string) => colorize(text, ANSI_COLORS.YELLOW),
	blue: (text: string) => colorize(text, ANSI_COLORS.BLUE),
	magenta: (text: string) => colorize(text, ANSI_COLORS.MAGENTA),
	cyan: (text: string) => colorize(text, ANSI_COLORS.CYAN),
	gray: (text: string) => colorize(text, ANSI_COLORS.GRAY),
} as const;

/**
 * Strip all ANSI codes from text
 */
export const stripAnsi = (text: string): string => {
	// Use String.fromCharCode to avoid control character in source (ANSI escape = 0x1B = 27)
	const escapeChar = String.fromCharCode(27);
	const ansiPattern = new RegExp(`${escapeChar}\\[[0-9;]*m`, "g");
	return text.replace(ansiPattern, "");
};
