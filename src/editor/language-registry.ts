import { InterpreterType } from "../shell/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Language capability flags
 */
export interface LanguageCapabilities {
	/** Can be executed in a shell */
	readonly shell: boolean;
	/** Has an interactive REPL interpreter */
	readonly repl: boolean;
	/** Can be executed as one-off commands */
	readonly oneOff: boolean;
}

/**
 * Language configuration
 */
export interface LanguageConfig {
	/** Canonical name */
	readonly name: string;
	/** Aliases for this language */
	readonly aliases: readonly string[];
	/** File extensions */
	readonly extensions: readonly string[];
	/** Interpreter type (if not a shell language) */
	readonly interpreterType?: InterpreterType;
	/** Language capabilities */
	readonly capabilities: LanguageCapabilities;
	/** Default interpreter command */
	readonly defaultCommand?: string;
}

/**
 * Language registry interface
 */
export interface LanguageRegistry {
	/** Register a language */
	register(config: LanguageConfig): LanguageRegistry;
	/** Find language by name or alias */
	find(nameOrAlias: string): LanguageConfig | undefined;
	/** Get all registered languages */
	all(): readonly LanguageConfig[];
	/** Check if a language is registered */
	has(nameOrAlias: string): boolean;
	/** Get interpreter type for a language */
	getInterpreterType(nameOrAlias: string): InterpreterType | undefined;
}

// ============================================================================
// Registry Implementation (Functional)
// ============================================================================

/**
 * Create an empty language registry
 */
const createEmptyRegistry = (): {
	configs: Map<string, LanguageConfig>;
	aliases: Map<string, string>;
} => ({
	configs: new Map(),
	aliases: new Map(),
});

/**
 * Register a language configuration in the registry
 */
const registerLanguage = (
	state: ReturnType<typeof createEmptyRegistry>,
	config: LanguageConfig
): void => {
	// Register canonical name
	state.configs.set(config.name.toLowerCase(), config);

	// Register all aliases pointing to canonical name
	for (const alias of config.aliases) {
		state.aliases.set(alias.toLowerCase(), config.name.toLowerCase());
	}
};

/**
 * Find language by name or alias
 */
const findLanguage = (
	state: ReturnType<typeof createEmptyRegistry>,
	nameOrAlias: string
): LanguageConfig | undefined => {
	const normalized = nameOrAlias.toLowerCase().trim();

	// Try direct lookup
	const direct = state.configs.get(normalized);
	if (direct) {
		return direct;
	}

	// Try alias lookup
	const canonical = state.aliases.get(normalized);
	if (canonical) {
		return state.configs.get(canonical);
	}

	return undefined;
};

/**
 * Create a new language registry
 */
export const createLanguageRegistry = (): LanguageRegistry => {
	const state = createEmptyRegistry();

	return {
		register(config: LanguageConfig): LanguageRegistry {
			registerLanguage(state, config);
			return this;
		},

		find(nameOrAlias: string): LanguageConfig | undefined {
			return findLanguage(state, nameOrAlias);
		},

		all(): readonly LanguageConfig[] {
			return Array.from(state.configs.values());
		},

		has(nameOrAlias: string): boolean {
			return findLanguage(state, nameOrAlias) !== undefined;
		},

		getInterpreterType(nameOrAlias: string): InterpreterType | undefined {
			const config = findLanguage(state, nameOrAlias);
			return config?.interpreterType;
		},
	};
};

// ============================================================================
// Default Language Configurations
// ============================================================================

/**
 * Create shell language capability
 */
const shellCapability: LanguageCapabilities = {
	shell: true,
	repl: false,
	oneOff: true,
};

/**
 * Create REPL language capability
 */
const replCapability: LanguageCapabilities = {
	shell: false,
	repl: true,
	oneOff: true,
};

/**
 * Bash/Shell configuration
 */
export const BASH_CONFIG: LanguageConfig = {
	name: "bash",
	aliases: ["sh", "shell", "zsh"],
	extensions: [".sh", ".bash", ".zsh"],
	capabilities: shellCapability,
};

/**
 * Python configuration
 */
export const PYTHON_CONFIG: LanguageConfig = {
	name: "python",
	aliases: ["py"],
	extensions: [".py"],
	interpreterType: "python",
	capabilities: replCapability,
	defaultCommand: "python3",
};

/**
 * JavaScript/Node configuration
 */
export const JAVASCRIPT_CONFIG: LanguageConfig = {
	name: "javascript",
	aliases: ["js", "node"],
	extensions: [".js", ".mjs"],
	interpreterType: "javascript",
	capabilities: replCapability,
	defaultCommand: "node",
};

/**
 * TypeScript configuration
 */
export const TYPESCRIPT_CONFIG: LanguageConfig = {
	name: "typescript",
	aliases: ["ts"],
	extensions: [".ts"],
	interpreterType: "typescript",
	capabilities: replCapability,
	defaultCommand: "npx ts-node",
};

/**
 * Create default language registry with built-in languages
 */
export const createDefaultRegistry = (): LanguageRegistry =>
	createLanguageRegistry()
		.register(BASH_CONFIG)
		.register(PYTHON_CONFIG)
		.register(JAVASCRIPT_CONFIG)
		.register(TYPESCRIPT_CONFIG);

// ============================================================================
// Global Registry (Singleton)
// ============================================================================

let globalRegistry: LanguageRegistry | null = null;

/**
 * Get or create the global language registry
 */
export const getLanguageRegistry = (): LanguageRegistry => {
	if (!globalRegistry) {
		globalRegistry = createDefaultRegistry();
	}
	return globalRegistry;
};

/**
 * Reset the global registry (useful for testing)
 */
export const resetLanguageRegistry = (): void => {
	globalRegistry = null;
};

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if a language is supported
 */
export const isLanguageSupported = (language: string): boolean =>
	getLanguageRegistry().has(language);

/**
 * Normalize language name (alias -> canonical)
 */
export const normalizeLanguageName = (language: string): string => {
	const config = getLanguageRegistry().find(language);
	return config?.name ?? language.toLowerCase().trim();
};

/**
 * Check if a language is a shell language
 */
export const isShellLanguage = (language: string): boolean => {
	const config = getLanguageRegistry().find(language);
	return config?.capabilities.shell ?? false;
};

/**
 * Check if a language has REPL support
 */
export const hasReplSupport = (language: string): boolean => {
	const config = getLanguageRegistry().find(language);
	return config?.capabilities.repl ?? false;
};

/**
 * Get interpreter type for a language
 */
export const getInterpreterType = (language: string): InterpreterType | undefined =>
	getLanguageRegistry().getInterpreterType(language);

/**
 * Get default command for a language
 */
export const getDefaultCommand = (language: string): string | undefined => {
	const config = getLanguageRegistry().find(language);
	return config?.defaultCommand;
};
