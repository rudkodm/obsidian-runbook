import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as os from "os";

export type ScriptPtyState = "idle" | "alive" | "dead";

export interface ScriptPtyOptions {
	shell?: string;
	cwd?: string;
	env?: Record<string, string>;
	cols?: number;
	rows?: number;
}

/**
 * PTY session using Unix `script` command.
 * Creates a real pseudo-terminal without native modules.
 * Works on macOS and Linux.
 */
export class ScriptPtySession extends EventEmitter {
	private process: ChildProcess | null = null;
	private _state: ScriptPtyState = "idle";
	private options: ScriptPtyOptions;

	constructor(options: ScriptPtyOptions = {}) {
		super();
		this.options = options;
	}

	get state(): ScriptPtyState {
		return this._state;
	}

	get pid(): number | undefined {
		return this.process?.pid;
	}

	get isAlive(): boolean {
		return this._state === "alive";
	}

	/**
	 * Check if the script command is available on this platform
	 */
	static isAvailable(): boolean {
		const platform = os.platform();
		// script command is available on macOS and Linux
		return platform === "darwin" || platform === "linux";
	}

	/**
	 * Get the default shell for the current platform
	 */
	static getDefaultShell(): string {
		return process.env.SHELL || "/bin/bash";
	}

	/**
	 * Get script command arguments based on platform
	 */
	private getScriptArgs(shell: string): string[] {
		const platform = os.platform();

		if (platform === "darwin") {
			// macOS: script -q /dev/null <shell>
			return ["-q", "/dev/null", shell];
		} else {
			// Linux: script -q -c <shell> /dev/null
			return ["-q", "-c", shell, "/dev/null"];
		}
	}

	/**
	 * Spawn the PTY session
	 */
	spawn(): void {
		if (this.process) {
			throw new Error("PTY session already running. Call kill() first.");
		}

		if (!ScriptPtySession.isAvailable()) {
			throw new Error("script command not available on this platform");
		}

		const shell = this.options.shell || ScriptPtySession.getDefaultShell();
		const args = this.getScriptArgs(shell);

		// Set up environment with TERM for proper terminal emulation
		const env: Record<string, string> = {
			...process.env as Record<string, string>,
			...this.options.env,
			TERM: "xterm-256color",
		};

		// Add size environment variables if provided
		if (this.options.cols) {
			env.COLUMNS = String(this.options.cols);
		}
		if (this.options.rows) {
			env.LINES = String(this.options.rows);
		}

		this.process = spawn("script", args, {
			stdio: ["pipe", "pipe", "pipe"],
			cwd: this.options.cwd || process.cwd(),
			env,
		});

		this.setState("alive");

		this.process.stdout?.on("data", (data: Buffer) => {
			this.emit("data", data.toString());
		});

		this.process.stderr?.on("data", (data: Buffer) => {
			this.emit("data", data.toString());
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
	 * Write data to the PTY (user input)
	 */
	write(data: string): void {
		if (!this.process || !this.process.stdin) {
			throw new Error("PTY session not running. Call spawn() first.");
		}
		this.process.stdin.write(data);
	}

	/**
	 * Resize the PTY (sends SIGWINCH via stty)
	 * Note: This is a best-effort approach since script doesn't support direct resize
	 */
	resize(cols: number, rows: number): void {
		if (!this.process || !this.process.stdin) {
			return;
		}
		// Send stty command to resize - this works in some shells
		// The shell will receive SIGWINCH when we change the terminal size
		this.process.stdin.write(`stty cols ${cols} rows ${rows}\n`);
	}

	/**
	 * Kill the PTY session
	 */
	kill(): void {
		if (this.process) {
			this.process.removeAllListeners();
			this.process.stdout?.removeAllListeners();
			this.process.stderr?.removeAllListeners();
			this.process.kill("SIGTERM");
			this.process = null;
			this.setState("dead");
		}
	}

	/**
	 * Restart the PTY session
	 */
	restart(): void {
		this.kill();
		this.spawn();
	}

	private setState(state: ScriptPtyState): void {
		if (this._state !== state) {
			this._state = state;
			this.emit("stateChange", state);
		}
	}
}
