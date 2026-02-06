import { App, PluginSettingTab, Setting } from "obsidian";
import RunbookPlugin from "./main";

/**
 * Plugin settings interface
 */
export interface RunbookSettings {
	/** Default shell path override (default: $SHELL or /bin/bash) */
	shellPath: string;
	/** Python interpreter path (default: python3) */
	pythonPath: string;
	/** Node.js interpreter path (default: node) */
	nodePath: string;
	/** TypeScript interpreter path (default: npx ts-node) */
	typescriptPath: string;
	/** Terminal font size (default: 13) */
	terminalFontSize: number;
	/** Auto-advance cursor after execution (default: true) */
	autoAdvanceCursor: boolean;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: RunbookSettings = {
	shellPath: "",
	pythonPath: "python3",
	nodePath: "node",
	typescriptPath: "npx ts-node",
	terminalFontSize: 13,
	autoAdvanceCursor: true,
};

/**
 * Settings tab UI
 */
export class RunbookSettingsTab extends PluginSettingTab {
	plugin: RunbookPlugin;

	constructor(app: App, plugin: RunbookPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Header
		;

		// Shell Path
		new Setting(containerEl)
			.setName("Shell path")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- technical description
			.setDesc("Overrides the default shell path. Leave empty to use $SHELL or /bin/bash.")
			.addText((text) =>
				text
					.setPlaceholder("e.g., /bin/zsh")
					.setValue(this.plugin.settings.shellPath)
					.onChange(async (value) => {
						this.plugin.settings.shellPath = value;
						await this.plugin.saveSettings();
					})
			);

		// Interpreter paths section
		new Setting(containerEl).setName("Interpreter paths").setHeading();

		// Python Path
		new Setting(containerEl)
			.setName("Python interpreter")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- technical description
			.setDesc("Sets the path to the Python interpreter.")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- command name
					.setPlaceholder("python3")
					.setValue(this.plugin.settings.pythonPath)
					.onChange(async (value) => {
						this.plugin.settings.pythonPath = value || "python3";
						await this.plugin.saveSettings();
					})
			);

		// Node.js Path
		new Setting(containerEl)
			.setName("Node.js interpreter")
			.setDesc("Sets the path to the Node.js interpreter.")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- command name
					.setPlaceholder("node")
					.setValue(this.plugin.settings.nodePath)
					.onChange(async (value) => {
						this.plugin.settings.nodePath = value || "node";
						await this.plugin.saveSettings();
					})
			);

		// TypeScript Path
		new Setting(containerEl)
			.setName("TypeScript interpreter")
			.setDesc("Sets the path to the TypeScript interpreter.")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- command name
					.setPlaceholder("npx ts-node")
					.setValue(this.plugin.settings.typescriptPath)
					.onChange(async (value) => {
						this.plugin.settings.typescriptPath = value || "npx ts-node";
						await this.plugin.saveSettings();
					})
			);

		// Terminal appearance section
		new Setting(containerEl).setName("Terminal appearance").setHeading();

		// Font Size
		new Setting(containerEl)
			.setName("Terminal font size")
			.setDesc("Font size for terminal text (default: 13)")
			.addText((text) =>
				text
					.setPlaceholder("13")
					.setValue(String(this.plugin.settings.terminalFontSize))
					.onChange(async (value) => {
						const size = parseInt(value);
						if (!isNaN(size) && size > 0 && size <= 72) {
							this.plugin.settings.terminalFontSize = size;
							await this.plugin.saveSettings();
						}
					})
			);

		// Editor behavior section
		new Setting(containerEl).setName("Editor behavior").setHeading();

		// Auto-advance Cursor
		new Setting(containerEl)
			.setName("Auto-advance cursor")
			.setDesc("Automatically move cursor to next line after executing current line")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoAdvanceCursor)
					.onChange(async (value) => {
						this.plugin.settings.autoAdvanceCursor = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
