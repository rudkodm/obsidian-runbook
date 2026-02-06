import tsparser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";
import obsidianmd from "eslint-plugin-obsidianmd";

const plugin = obsidianmd.default || obsidianmd;

export default [
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
		plugins: {
			"@typescript-eslint": tseslint,
			obsidianmd: plugin,
		},
		rules: {
			...plugin.configs.recommended,
			// TODO: Address these properly
			"obsidianmd/no-static-styles-assignment": "warn",
			"obsidianmd/no-forbidden-elements": "warn",
			"obsidianmd/ui/sentence-case": "warn", // Placeholders use command names
		},
	},
	{
		ignores: ["main.js", "node_modules/**", "tests/**"],
	},
];
