/**
 * Design Tokens
 * Centralized design system constants for consistent UI
 */

// ============================================================================
// Spacing Scale
// ============================================================================

/**
 * Base spacing unit (4px)
 * All spacing should be multiples of this value
 */
export const SPACING_UNIT = 4;

/**
 * Spacing scale based on 4px unit
 * Use these instead of hardcoded pixel values
 */
export const SPACING = {
	/** 0px */
	none: 0,
	/** 2px - Minimal spacing */
	xxs: SPACING_UNIT * 0.5,
	/** 4px - Extra small */
	xs: SPACING_UNIT,
	/** 8px - Small */
	sm: SPACING_UNIT * 2,
	/** 12px - Medium */
	md: SPACING_UNIT * 3,
	/** 16px - Large */
	lg: SPACING_UNIT * 4,
	/** 20px - Extra large */
	xl: SPACING_UNIT * 5,
	/** 24px - 2X large */
	xxl: SPACING_UNIT * 6,
	/** 32px - 3X large */
	xxxl: SPACING_UNIT * 8,
} as const;

// ============================================================================
// Typography Scale
// ============================================================================

/**
 * Font sizes in pixels
 */
export const FONT_SIZE = {
	/** 10px - Extra small */
	xs: 10,
	/** 11px - Small (output titles) */
	sm: 11,
	/** 12px - Medium (output text) */
	md: 12,
	/** 13px - Base (output body, terminal default) */
	base: 13,
	/** 14px - Large (status bar icons) */
	lg: 14,
	/** 16px - Extra large */
	xl: 16,
	/** 18px - 2X large */
	xxl: 18,
} as const;

/**
 * Line heights (unitless multipliers)
 */
export const LINE_HEIGHT = {
	/** 1.2 - Tight */
	tight: 1.2,
	/** 1.4 - Snug */
	snug: 1.4,
	/** 1.5 - Normal (output body) */
	normal: 1.5,
	/** 1.6 - Relaxed */
	relaxed: 1.6,
	/** 1.8 - Loose */
	loose: 1.8,
} as const;

/**
 * Font weights
 */
export const FONT_WEIGHT = {
	/** 300 - Light */
	light: 300,
	/** 400 - Normal */
	normal: 400,
	/** 500 - Medium */
	medium: 500,
	/** 600 - Semibold */
	semibold: 600,
	/** 700 - Bold */
	bold: 700,
} as const;

// ============================================================================
// Border Radius
// ============================================================================

/**
 * Border radius values in pixels
 */
export const BORDER_RADIUS = {
	/** 0px - No radius */
	none: 0,
	/** 2px - Small */
	sm: 2,
	/** 4px - Medium (scrollbar thumb) */
	md: 4,
	/** 6px - Large */
	lg: 6,
	/** 8px - Extra large */
	xl: 8,
	/** 50% - Circular */
	full: "50%",
} as const;

// ============================================================================
// Sizes (Icon, Button, etc.)
// ============================================================================

/**
 * Icon sizes in pixels
 */
export const ICON_SIZE = {
	/** 12px - Extra small */
	xs: 12,
	/** 14px - Small */
	sm: 14,
	/** 16px - Medium (default) */
	md: 16,
	/** 20px - Large (spinner) */
	lg: 20,
	/** 24px - Extra large */
	xl: 24,
	/** 32px - 2X large */
	xxl: 32,
} as const;

/**
 * Button sizes
 */
export const BUTTON_SIZE = {
	/** Small button */
	sm: {
		padding: `${SPACING.xs}px ${SPACING.sm}px`,
		fontSize: FONT_SIZE.sm,
	},
	/** Medium button (default) */
	md: {
		padding: `${SPACING.xs}px ${SPACING.md}px`,
		fontSize: FONT_SIZE.base,
	},
	/** Large button */
	lg: {
		padding: `${SPACING.sm}px ${SPACING.lg}px`,
		fontSize: FONT_SIZE.lg,
	},
} as const;

// ============================================================================
// Z-Index Scale
// ============================================================================

/**
 * Z-index layering system
 */
export const Z_INDEX = {
	/** -1 - Behind everything */
	behind: -1,
	/** 0 - Base level */
	base: 0,
	/** 10 - Elevated content */
	elevated: 10,
	/** 50 - Dropdown menus */
	dropdown: 50,
	/** 100 - Modals */
	modal: 100,
	/** 1000 - Notifications/Toasts */
	notification: 1000,
	/** 9999 - Tooltips */
	tooltip: 9999,
} as const;

// ============================================================================
// Animation Timing
// ============================================================================

/**
 * Animation durations in milliseconds
 */
export const DURATION = {
	/** 100ms - Instant */
	instant: 100,
	/** 150ms - Fast */
	fast: 150,
	/** 200ms - Normal */
	normal: 200,
	/** 300ms - Slow */
	slow: 300,
	/** 500ms - Slower */
	slower: 500,
} as const;

/**
 * Easing functions (CSS timing functions)
 */
export const EASING = {
	/** Linear */
	linear: "linear",
	/** Ease in */
	easeIn: "cubic-bezier(0.4, 0, 1, 1)",
	/** Ease out */
	easeOut: "cubic-bezier(0, 0, 0.2, 1)",
	/** Ease in-out */
	easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
	/** Spring-like */
	spring: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
} as const;

// ============================================================================
// Breakpoints (for future responsive design)
// ============================================================================

/**
 * Responsive breakpoints in pixels
 */
export const BREAKPOINT = {
	/** 640px - Small mobile */
	sm: 640,
	/** 768px - Tablet */
	md: 768,
	/** 1024px - Desktop */
	lg: 1024,
	/** 1280px - Large desktop */
	xl: 1280,
	/** 1536px - Extra large desktop */
	xxl: 1536,
} as const;

// ============================================================================
// Semantic Colors (for future use)
// ============================================================================

/**
 * Semantic color roles
 * Note: These should map to Obsidian CSS variables when possible
 */
export const SEMANTIC_COLORS = {
	/** Primary action color */
	primary: "var(--interactive-accent)",
	/** Success/positive state */
	success: "var(--text-success, #0dbc79)",
	/** Warning state */
	warning: "var(--text-warning, #e5e510)",
	/** Error/danger state */
	error: "var(--text-error, #cd3131)",
	/** Information */
	info: "var(--text-accent, #2472c8)",
	/** Muted/disabled */
	muted: "var(--text-muted)",
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get spacing value as CSS string
 */
export const spacing = (multiplier: number): string =>
	`${SPACING_UNIT * multiplier}px`;

/**
 * Get font size with line height as CSS string
 */
export const fontSize = (
	size: number,
	lineHeight: number = LINE_HEIGHT.normal
): string =>
	`${size}px/${lineHeight}`;

/**
 * Create CSS transition string
 */
export const transition = (
	property: string = "all",
	duration: number = DURATION.normal,
	easing: string = EASING.easeInOut
): string =>
	`${property} ${duration}ms ${easing}`;

/**
 * Create CSS box shadow
 */
export const shadow = (
	size: "sm" | "md" | "lg" = "md"
): string => {
	const shadows = {
		sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
		md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
		lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
	};
	return shadows[size];
};
