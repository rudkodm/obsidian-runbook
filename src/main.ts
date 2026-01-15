import { App, Editor, MarkdownView, Notice, Platform, Plugin, PluginManifest } from "obsidian";
import { ShellSession } from "./shell/session";
import {
	getCodeBlockContext,
	getTextToExecute,
	isLanguageSupported,
	advanceCursorToNextLine,
	stripPromptPrefix,
} from "./editor/code-block";
import { createCodeBlockProcessor } from "./ui/code-block-processor";

/**
 * Obsidian Runbook Plugin
 *
 * Executes code blocks directly from markdown notes using a persistent shell session.
 */
export default class RunbookPlugin extends Plugin {
	private session: ShellSession | null = null;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
	}

	async onload() {
		// Desktop-only check
		if (Platform.isMobile) {
			new Notice("Runbook plugin is desktop-only and cannot run on mobile.");
			return;
		}

		console.log("Runbook: Plugin loading...");

		// Initialize shell session
		this.session = new ShellSession();

		// Set up session event listeners
		this.session.on("stateChange", (state) => {
			console.log(`Runbook: Shell state changed to: ${state}`);
		});

		this.session.on("error", (error) => {
			console.error("Runbook: Shell error:", error);
			new Notice(`Shell error: ${error.message}`);
		});

		// Main command: Execute line or selection (Shift + Cmd/Ctrl + Enter)
		this.addCommand({
			id: "execute-line-or-selection",
			name: "Execute line or selection",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.executeLineOrSelection(editor);
			},
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "Enter",
				},
			],
		});

		// Shell management commands
		this.addCommand({
			id: "start-shell",
			name: "Start shell session",
			callback: () => this.startShell(),
		});

		this.addCommand({
			id: "restart-shell",
			name: "Restart shell session",
			callback: () => this.restartShell(),
		});

		this.addCommand({
			id: "get-session-status",
			name: "Get session status",
			callback: () => this.getSessionStatus(),
		});

		// Auto-start shell session
		this.session.spawn();
		console.log("Runbook: Shell auto-started", { pid: this.session.pid });

		// Register code block post-processor for reading view
		this.registerMarkdownPostProcessor(
			createCodeBlockProcessor({
				getSession: () => this.session,
			})
		);
		console.log("Runbook: Code block processor registered");

		new Notice(`Runbook: Ready (PID: ${this.session.pid})`);
		console.log("Runbook: Plugin loaded successfully");
	}

	async onunload() {
		console.log("Runbook: Plugin unloading...");
		if (this.session) {
			this.session.kill();
			this.session = null;
		}
	}

	/**
	 * Execute the current line or selection in the code block
	 */
	private async executeLineOrSelection(editor: Editor): Promise<void> {
		// Ensure shell is running
		if (!this.session) {
			new Notice("Session not initialized");
			return;
		}

		if (!this.session.isAlive) {
			new Notice("Shell not running. Restarting...");
			try {
				this.session.spawn();
			} catch (err) {
				new Notice(`Failed to start shell: ${err}`);
				return;
			}
		}

		// Get code block context
		const context = getCodeBlockContext(editor);

		if (!context.inCodeBlock || !context.codeBlock) {
			new Notice("Not inside a code block");
			return;
		}

		// Check if language is supported
		if (!isLanguageSupported(context.codeBlock.language)) {
			new Notice(`Unsupported language: ${context.codeBlock.language || "(none)"}`);
			return;
		}

		// Get text to execute
		const textInfo = getTextToExecute(editor);
		if (!textInfo) {
			new Notice("No text to execute (empty line)");
			return;
		}

		// Strip prompt prefix if present ($ or >)
		const command = stripPromptPrefix(textInfo.text);

		console.log("Runbook: Executing", {
			command,
			isSelection: textInfo.isSelection,
			language: context.codeBlock.language,
		});

		try {
			const output = await this.session.execute(command);

			// Show output in notice (truncate if too long)
			const maxLen = 200;
			const displayOutput = output.length > maxLen
				? output.slice(0, maxLen) + "..."
				: output;

			if (output.trim()) {
				new Notice(`Output:\n${displayOutput}`);
			} else {
				new Notice("Command executed (no output)");
			}

			console.log("Runbook: Execution complete", { output });

			// Auto-advance cursor if not a selection
			if (!textInfo.isSelection) {
				advanceCursorToNextLine(editor);
			}
		} catch (err) {
			new Notice(`Execution failed: ${err}`);
			console.error("Runbook: Execution failed", err);
		}
	}

	/**
	 * Start the shell session
	 */
	private startShell(): void {
		if (!this.session) {
			new Notice("Session not initialized");
			return;
		}

		if (this.session.isAlive) {
			new Notice(`Shell already running (PID: ${this.session.pid})`);
			return;
		}

		try {
			this.session.spawn();
			new Notice(`Shell started (PID: ${this.session.pid})`);
			console.log("Runbook: Shell started", { pid: this.session.pid });
		} catch (err) {
			new Notice(`Failed to start shell: ${err}`);
			console.error("Runbook: Failed to start shell", err);
		}
	}

	/**
	 * Get current session status
	 */
	private getSessionStatus(): void {
		if (!this.session) {
			new Notice("Session not initialized");
			return;
		}

		const status = {
			state: this.session.state,
			pid: this.session.pid,
			isAlive: this.session.isAlive,
		};

		const statusText = `State: ${status.state}\nPID: ${status.pid || "N/A"}\nAlive: ${status.isAlive}`;
		new Notice(`Shell Status:\n${statusText}`);
		console.log("Runbook: Session status", status);
	}

	/**
	 * Restart the shell session
	 */
	private restartShell(): void {
		if (!this.session) {
			new Notice("Session not initialized");
			return;
		}

		try {
			const oldPid = this.session.pid;
			this.session.restart();
			new Notice(`Shell restarted\nOld PID: ${oldPid}\nNew PID: ${this.session.pid}`);
			console.log("Runbook: Shell restarted", { oldPid, newPid: this.session.pid });
		} catch (err) {
			new Notice(`Restart failed: ${err}`);
			console.error("Runbook: Restart failed", err);
		}
	}
}
