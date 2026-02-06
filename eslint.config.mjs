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
		},
	},
	{
		ignores: ["main.js", "node_modules/**", "tests/**"],
	},
];
