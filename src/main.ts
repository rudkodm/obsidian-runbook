import { App, Notice, Platform, Plugin, PluginManifest } from "obsidian";
import { ShellSession } from "./shell/session";

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

		// Register commands for manual verification
		this.addCommand({
			id: "start-shell",
			name: "Start shell session",
			callback: () => this.startShell(),
		});

		this.addCommand({
			id: "execute-test-command",
			name: "Execute test command (echo hello)",
			callback: () => this.executeTestCommand(),
		});

		this.addCommand({
			id: "check-shell-state",
			name: "Check shell state (export & echo)",
			callback: () => this.checkShellState(),
		});

		this.addCommand({
			id: "get-session-status",
			name: "Get session status",
			callback: () => this.getSessionStatus(),
		});

		this.addCommand({
			id: "restart-shell",
			name: "Restart shell session",
			callback: () => this.restartShell(),
		});

		new Notice("Runbook: Plugin loaded. Use command palette for shell commands.");
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
			new Notice(`✅ Shell started (PID: ${this.session.pid})`);
			console.log("Runbook: Shell started", { pid: this.session.pid });
		} catch (err) {
			new Notice(`❌ Failed to start shell: ${err}`);
			console.error("Runbook: Failed to start shell", err);
		}
	}

	/**
	 * Execute a test command
	 */
	private async executeTestCommand(): Promise<void> {
		if (!this.session) {
			new Notice("Session not initialized");
			return;
		}

		if (!this.session.isAlive) {
			new Notice("Shell not running. Start it first.");
			return;
		}

		try {
			new Notice("Executing: echo hello");
			const output = await this.session.execute("echo hello");
			new Notice(`✅ Output: ${output}`);
			console.log("Runbook: Command executed", { output });
		} catch (err) {
			new Notice(`❌ Execution failed: ${err}`);
			console.error("Runbook: Execution failed", err);
		}
	}

	/**
	 * Check shell state persistence
	 */
	private async checkShellState(): Promise<void> {
		if (!this.session) {
			new Notice("Session not initialized");
			return;
		}

		if (!this.session.isAlive) {
			new Notice("Shell not running. Start it first.");
			return;
		}

		try {
			const testValue = "runbook_" + Math.random().toString(36).slice(2, 8);

			// Set a variable
			new Notice(`Setting TEST_VAR=${testValue}`);
			await this.session.execute(`export TEST_VAR="${testValue}"`);

			// Read it back
			const output = await this.session.execute("echo $TEST_VAR");

			if (output.trim() === testValue) {
				new Notice(`✅ State persists!\nTEST_VAR=${output.trim()}`);
				console.log("Runbook: State persistence test PASSED");
			} else {
				new Notice(`⚠️ State may not persist.\nExpected: ${testValue}\nGot: ${output.trim()}`);
				console.log("Runbook: State persistence test PARTIAL", { expected: testValue, got: output });
			}
		} catch (err) {
			new Notice(`❌ State check failed: ${err}`);
			console.error("Runbook: State check failed", err);
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
			new Notice(`✅ Shell restarted\nOld PID: ${oldPid}\nNew PID: ${this.session.pid}`);
			console.log("Runbook: Shell restarted", { oldPid, newPid: this.session.pid });
		} catch (err) {
			new Notice(`❌ Restart failed: ${err}`);
			console.error("Runbook: Restart failed", err);
		}
	}
}
