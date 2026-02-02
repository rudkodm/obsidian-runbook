import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as os from "os";
import { getDefaultShell } from "./utils";

export interface ShellSessionOptions {
	shell?: string;
	cwd?: string;
	env?: Record<string, string>;
}

export interface ExecuteResult {
	output: string;
	exitCode: number | null;
}

export type ShellSessionState = "idle" | "alive" | "dead";

export interface ShellSessionEvents {
	output: (data: string) => void;
	error: (error: Error) => void;
	exit: (code: number | null) => void;
	stateChange: (state: ShellSessionState) => void;
}

/**
 * Manages a persistent shell session using child_process.
 * Allows executing commands while preserving shell state (variables, cwd, etc.)
 */
export class ShellSession extends EventEmitter {
	private process: ChildProcess | null = null;
	private _state: ShellSessionState = "idle";
	private outputBuffer: string = "";
	private options: ShellSessionOptions;

	constructor(options: ShellSessionOptions = {}) {
		super();
		this.options = options;
	}

	/**
	 * Get the current session state
	 */
	get state(): ShellSessionState {
		return this._state;
	}

	/**
	 * Get the shell process PID (if running)
	 */
	get pid(): number | undefined {
		return this.process?.pid;
	}

	/**
	 * Check if the shell is currently alive
	 */
	get isAlive(): boolean {
		return this._state === "alive";
	}

	/**
	 * Detect the default shell for the current platform
	 */
	static getDefaultShell(): string {
		return getDefaultShell();
	}

	/**
	 * Get shell arguments for the current platform
	 */
	private getShellArgs(): string[] {
		const shell = this.options.shell || ShellSession.getDefaultShell();

		if (os.platform() === "win32") {
			return [];
		}

		// Don't use interactive mode - it requires a real TTY
		// Just disable profile/rc loading to keep the shell clean
		if (shell.includes("bash")) {
			return ["--norc", "--noprofile"];
		}
		if (shell.includes("zsh")) {
			return ["--no-rcs"];
		}

		return [];
	}

	/**
	 * Start the shell session
	 */
	spawn(): void {
		if (this.process) {
			throw new Error("Shell session already running. Call kill() first.");
		}

		const shell = this.options.shell || ShellSession.getDefaultShell();
		const args = this.getShellArgs();

		this.process = spawn(shell, args, {
			stdio: ["pipe", "pipe", "pipe"],
			cwd: this.options.cwd || process.cwd(),
			env: {
				...process.env,
				...this.options.env,
				TERM: "dumb", // Disable terminal escape sequences
				PS1: "", // Disable prompt
				PS2: "", // Disable continuation prompt
			},
		});

		this.outputBuffer = "";
		this.setState("alive");

		this.process.stdout?.on("data", (data: Buffer) => {
			const text = data.toString();
			this.outputBuffer += text;
			this.emit("output", text);
		});

		this.process.stderr?.on("data", (data: Buffer) => {
			const text = data.toString();
			this.outputBuffer += text;
			this.emit("output", text);
		});

		this.process.on("error", (error: Error) => {
			this.emit("error", error);
			this.setState("dead");
		});

		this.process.on("exit", (code: number | null) => {
			this.emit("exit", code);
			this.setState("dead");
			this.process = null;
		});
	}

	/**
	 * Execute a command in the shell
	 * @param command The command to execute
	 * @param timeout Optional timeout in milliseconds
	 * @returns Promise that resolves with the command output
	 */
	async execute(command: string, timeout: number = 30000): Promise<string> {
		if (!this.process || !this.process.stdin) {
			throw new Error("Shell session not running. Call spawn() first.");
		}

		if (this._state !== "alive") {
			throw new Error(`Shell session is ${this._state}. Cannot execute command.`);
		}

		// Create unique markers to identify command output
		const markerId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
		const startMarker = `RUNBOOK_S_${markerId}`;
		const endMarker = `RUNBOOK_E_${markerId}`;

		return new Promise((resolve, reject) => {
			let output = "";
			let timeoutId: NodeJS.Timeout | null = null;

			const onOutput = (data: string) => {
				output += data;

				// Check if we have the end marker
				if (output.includes(endMarker)) {
					cleanup();

					// Extract output between markers
					const startIdx = output.indexOf(startMarker);
					const endIdx = output.indexOf(endMarker);

					if (startIdx !== -1 && endIdx !== -1) {
						// Get content between markers
						let content = output.slice(startIdx + startMarker.length, endIdx);

						// Clean up the output:
						// 1. Remove leading newline from echo
						// 2. Remove trailing newline before end marker
						// 3. Filter out any remaining prompt artifacts
						const lines = content.split("\n");
						const cleanedLines = lines.filter((line) => {
							// Skip empty first/last lines from echo
							if (line === "") return false;
							// Skip lines that look like echoed commands
							if (line.startsWith("echo ") && line.includes("RUNBOOK_")) return false;
							// Skip the command itself if it got echoed
							if (line === command) return false;
							return true;
						});

						resolve(cleanedLines.join("\n"));
					} else {
						resolve(output);
					}
				}
			};

			const onError = (error: Error) => {
				cleanup();
				reject(error);
			};

			const onExit = () => {
				cleanup();
				reject(new Error("Shell exited unexpectedly"));
			};

			const cleanup = () => {
				if (timeoutId) {
					clearTimeout(timeoutId);
				}
				this.off("output", onOutput);
				this.off("error", onError);
				this.off("exit", onExit);
			};

			this.on("output", onOutput);
			this.on("error", onError);
			this.on("exit", onExit);

			if (timeout > 0) {
				timeoutId = setTimeout(() => {
					cleanup();
					reject(new Error(`Command timed out after ${timeout}ms`));
				}, timeout);
			}

			// Send command wrapped with markers
			// Use printf to avoid extra newlines and potential escaping issues
			const wrappedCommand = `printf '%s\\n' '${startMarker}'; ${command}; printf '%s\\n' '${endMarker}'\n`;
			this.process!.stdin!.write(wrappedCommand);
		});
	}

	/**
	 * Send raw input to the shell (without waiting for output)
	 */
	sendRaw(input: string): void {
		if (!this.process || !this.process.stdin) {
			throw new Error("Shell session not running. Call spawn() first.");
		}
		this.process.stdin.write(input);
	}

	/**
	 * Kill the shell session
	 */
	kill(): void {
		if (this.process) {
			// Remove all listeners to prevent race conditions on restart
			this.process.removeAllListeners();
			this.process.stdout?.removeAllListeners();
			this.process.stderr?.removeAllListeners();
			this.process.kill();
			this.process = null;
			this.setState("dead");
		}
	}

	/**
	 * Restart the shell session
	 */
	restart(): void {
		this.kill();
		this.spawn();
	}

	/**
	 * Get the accumulated output buffer
	 */
	getOutputBuffer(): string {
		return this.outputBuffer;
	}

	/**
	 * Clear the output buffer
	 */
	clearOutputBuffer(): void {
		this.outputBuffer = "";
	}

	private setState(state: ShellSessionState): void {
		if (this._state !== state) {
			this._state = state;
			this.emit("stateChange", state);
		}
	}
}
