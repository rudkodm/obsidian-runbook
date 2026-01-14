import { App, Notice, Platform, Plugin, PluginManifest } from "obsidian";
import { spawn, ChildProcess } from "child_process";

/**
 * Phase 0: Architecture Validation Plugin
 *
 * This plugin validates that we can:
 * 1. Access Node.js child_process APIs
 * 2. Spawn and communicate with a persistent shell
 * 3. Maintain shell state across commands
 */
export default class RunbookPlugin extends Plugin {
	private shellProcess: ChildProcess | null = null;
	private shellOutput: string = "";

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

		// Register validation commands
		this.addCommand({
			id: "test-child-process",
			name: "Test: child_process.spawn (echo hello)",
			callback: () => this.testChildProcess(),
		});

		this.addCommand({
			id: "test-spawn-shell",
			name: "Test: Spawn persistent shell",
			callback: () => this.testSpawnShell(),
		});

		this.addCommand({
			id: "test-shell-state",
			name: "Test: Shell state persistence (export & echo)",
			callback: () => this.testShellState(),
		});

		this.addCommand({
			id: "test-kill-shell",
			name: "Test: Kill shell session",
			callback: () => this.testKillShell(),
		});

		new Notice("Runbook: Validation plugin loaded. Use command palette to run tests.");
		console.log("Runbook: Plugin loaded successfully");
	}

	async onunload() {
		console.log("Runbook: Plugin unloading...");
		this.killShell();
	}

	/**
	 * Test 1: Basic child_process.spawn
	 * Verifies we can spawn a simple command and capture output
	 */
	private testChildProcess(): void {
		console.log("Runbook: Testing child_process.spawn...");

		try {
			const proc = spawn("echo", ["hello from child_process"]);

			let output = "";
			let errorOutput = "";

			proc.stdout.on("data", (data: Buffer) => {
				output += data.toString();
			});

			proc.stderr.on("data", (data: Buffer) => {
				errorOutput += data.toString();
			});

			proc.on("close", (code: number) => {
				if (code === 0) {
					new Notice(`✅ child_process works!\nOutput: ${output.trim()}`);
					console.log("Runbook: child_process test PASSED", { output: output.trim() });
				} else {
					new Notice(`❌ child_process failed with code ${code}\nError: ${errorOutput}`);
					console.error("Runbook: child_process test FAILED", { code, errorOutput });
				}
			});

			proc.on("error", (err: Error) => {
				new Notice(`❌ child_process error: ${err.message}`);
				console.error("Runbook: child_process test ERROR", err);
			});
		} catch (err) {
			new Notice(`❌ child_process not available: ${err}`);
			console.error("Runbook: child_process not available", err);
		}
	}

	/**
	 * Test 2: Spawn a persistent shell
	 * Verifies we can spawn bash/sh and keep it running
	 */
	private testSpawnShell(): void {
		console.log("Runbook: Testing persistent shell spawn...");

		if (this.shellProcess) {
			new Notice("Shell already running. Kill it first.");
			return;
		}

		try {
			// Try bash first, fall back to sh
			const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
			const args = process.platform === "win32" ? [] : ["--norc", "--noprofile", "-i"];

			this.shellProcess = spawn(shell, args, {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, TERM: "dumb" },
			});

			this.shellOutput = "";

			this.shellProcess.stdout?.on("data", (data: Buffer) => {
				const text = data.toString();
				this.shellOutput += text;
				console.log("Runbook: Shell stdout:", text);
			});

			this.shellProcess.stderr?.on("data", (data: Buffer) => {
				const text = data.toString();
				this.shellOutput += text;
				console.log("Runbook: Shell stderr:", text);
			});

			this.shellProcess.on("close", (code: number) => {
				console.log("Runbook: Shell closed with code", code);
				this.shellProcess = null;
			});

			this.shellProcess.on("error", (err: Error) => {
				new Notice(`❌ Shell error: ${err.message}`);
				console.error("Runbook: Shell error", err);
				this.shellProcess = null;
			});

			new Notice(`✅ Shell spawned (${shell})\nPID: ${this.shellProcess.pid}`);
			console.log("Runbook: Shell spawned", { shell, pid: this.shellProcess.pid });
		} catch (err) {
			new Notice(`❌ Failed to spawn shell: ${err}`);
			console.error("Runbook: Failed to spawn shell", err);
		}
	}

	/**
	 * Test 3: Shell state persistence
	 * Verifies that shell state (variables, cd, etc.) persists across commands
	 */
	private testShellState(): void {
		console.log("Runbook: Testing shell state persistence...");

		if (!this.shellProcess || !this.shellProcess.stdin) {
			new Notice("No shell running. Spawn one first.");
			return;
		}

		try {
			// Clear previous output
			this.shellOutput = "";

			// Create a unique marker to identify our output
			const marker = `__RUNBOOK_TEST_${Date.now()}__`;
			const testValue = "runbook_works_" + Math.random().toString(36).substring(7);

			// Send commands: export a variable, then echo it with markers
			const commands = [
				`export RUNBOOK_TEST_VAR="${testValue}"`,
				`echo "${marker}_START"`,
				`echo "VALUE=$RUNBOOK_TEST_VAR"`,
				`echo "${marker}_END"`,
			].join("\n") + "\n";

			this.shellProcess.stdin.write(commands);

			// Wait a bit and check output
			setTimeout(() => {
				const output = this.shellOutput;
				console.log("Runbook: Shell output after state test:", output);

				if (output.includes(`VALUE=${testValue}`)) {
					new Notice(`✅ Shell state persists!\nVariable was preserved across commands.`);
					console.log("Runbook: Shell state test PASSED");
				} else if (output.includes("VALUE=")) {
					new Notice(`⚠️ Shell responded but variable may not have persisted.\nCheck console for details.`);
					console.log("Runbook: Shell state test PARTIAL", { output });
				} else {
					new Notice(`⚠️ Waiting for shell output...\nCheck console for details.`);
					console.log("Runbook: Shell state test PENDING", { output });
				}
			}, 500);
		} catch (err) {
			new Notice(`❌ Shell state test failed: ${err}`);
			console.error("Runbook: Shell state test failed", err);
		}
	}

	/**
	 * Kill the persistent shell
	 */
	private testKillShell(): void {
		if (this.killShell()) {
			new Notice("✅ Shell killed");
		} else {
			new Notice("No shell running");
		}
	}

	private killShell(): boolean {
		if (this.shellProcess) {
			console.log("Runbook: Killing shell", { pid: this.shellProcess.pid });
			this.shellProcess.kill();
			this.shellProcess = null;
			return true;
		}
		return false;
	}
}
