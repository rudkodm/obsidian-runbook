// ============================================================================
// Types
// ============================================================================

/**
 * Runme-compatible code block attributes
 * Parsed from JSON after language tag: ```sh {"name":"setup","cwd":"/tmp"}
 */
export interface CodeBlockAttributes {
	readonly name?: string;
	readonly excludeFromRunAll?: boolean;
	readonly cwd?: string;
	/** Use persistent REPL session (default true for non-shell languages) */
	readonly interactive?: boolean;
	/** Override the interpreter command path */
	readonly interpreter?: string;
	readonly [key: string]: unknown; // Forward-compatible with unknown attributes
}

/**
 * Document-level configuration from frontmatter
 */
export interface FrontmatterConfig {
	readonly shell?: string;
	readonly cwd?: string;
}

/**
 * Information about opening fence
 */
export interface OpeningFenceInfo {
	readonly language: string;
	readonly attributes: CodeBlockAttributes;
}

// ============================================================================
// Pure Parsing Functions
// ============================================================================

/**
 * Parse Runme-compatible JSON attributes from code block fence line
 */
export const parseCodeBlockAttributes = (str: string): CodeBlockAttributes => {
	const trimmed = str.trim();

	if (!trimmed) {
		return {};
	}

	try {
		const parsed = JSON.parse(trimmed);

		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as CodeBlockAttributes;
		}
	} catch {
		// Not valid JSON - ignore gracefully (forward-compatible)
	}

	return {};
};

/**
 * Check if a line is an opening fence and extract language + optional attributes
 * Only matches fences WITH a language specifier (required for execution)
 * Supports Runme-compatible JSON attributes: ```sh {"name":"setup","cwd":"/tmp"}
 */
export const getOpeningFenceInfo = (line: string): OpeningFenceInfo | null => {
	// Match ``` or ~~~ followed by REQUIRED language, then optional JSON attributes
	const match = line.match(/^(`{3,}|~{3,})(\w+)\s*(.*?)\s*$/);

	if (!match) {
		return null;
	}

	const language = match[2];
	const attributesStr = match[3];

	const attributes = attributesStr
		? parseCodeBlockAttributes(attributesStr)
		: {};

	return { language, attributes };
};

/**
 * Check if a line is a closing fence
 */
export const isClosingFence = (line: string): boolean =>
	/^(`{3,}|~{3,})\s*$/.test(line);

// ============================================================================
// Frontmatter Parsing
// ============================================================================

/**
 * Strip surrounding quotes from a string
 */
const stripQuotes = (value: string): string =>
	value.replace(/^["']|["']$/g, "");

/**
 * Parse a single YAML key-value line
 */
const parseYamlLine = (line: string): [string, string] | null => {
	const match = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);

	if (!match) {
		return null;
	}

	const key = match[1].toLowerCase();
	const value = stripQuotes(match[2]);

	return [key, value];
};

/**
 * Parse frontmatter configuration from YAML lines
 */
const parseFrontmatterLines = (lines: string[]): FrontmatterConfig => {
	let config: FrontmatterConfig = {};

	for (const line of lines) {
		const parsed = parseYamlLine(line);

		if (!parsed) {
			continue;
		}

		const [key, value] = parsed;

		if (key === "shell") {
			config = { ...config, shell: value };
		} else if (key === "cwd") {
			config = { ...config, cwd: value };
		}
	}

	return config;
};

/**
 * Extract YAML content from frontmatter
 */
const extractFrontmatterContent = (content: string): string | null => {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	return match ? match[1] : null;
};

/**
 * Parse frontmatter from document content
 * Supports YAML-style frontmatter between --- delimiters
 */
export const parseFrontmatter = (content: string): FrontmatterConfig => {
	const yaml = extractFrontmatterContent(content);

	if (!yaml) {
		return {};
	}

	const lines = yaml.split("\n");
	return parseFrontmatterLines(lines);
};
