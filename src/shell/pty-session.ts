import * as os from "os";
import { EventEmitter } from "events";

// node-pty types
interface IPty {
	pid: number;
	cols: number;
	rows: number;
	onData: (callback: (data: string) => void) => { dispose: () => void };
	onExit: (callback: (exitCode: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
	write(data: string): void;
	resize(cols: number, rows: number): void;
	kill(signal?: string): void;
}

interface IPtyForkOptions {
	name?: string;
	cols?: number;
	rows?: number;
	cwd?: string;
	env?: { [key: string]: string | undefined };
}

type SpawnFn = (shell: string, args: string[], options: IPtyForkOptions) => IPty;

export interface PtySessionOptions {
	shell?: string;
	cwd?: string;
	env?: Record<string, string>;
	cols?: number;
	rows?: number;
}

export type PtySessionState = "idle" | "alive" | "dead";

/**
 * Manages a PTY shell session using node-pty.
 * Provides full terminal emulation with ANSI support.
 */
export class PtySession extends EventEmitter {
	private pty: IPty | null = null;
	private _state: PtySessionState = "idle";
	private options: PtySessionOptions;
	private disposables: Array<{ dispose: () => void }> = [];

	constructor(options: PtySessionOptions = {}) {
		super();
		this.options = {
			cols: 80,
			rows: 24,
			...options,
		};
	}

	/**
	 * Get the current session state
	 */
	get state(): PtySessionState {
		return this._state;
	}

	/**
	 * Get the PTY process PID (if running)
	 */
	get pid(): number | undefined {
		return this.pty?.pid;
	}

	/**
	 * Check if the PTY is currently alive
	 */
	get isAlive(): boolean {
		return this._state === "alive";
	}

	/**
	 * Get current terminal dimensions
	 */
	get dimensions(): { cols: number; rows: number } {
		return {
			cols: this.pty?.cols ?? this.options.cols ?? 80,
			rows: this.pty?.rows ?? this.options.rows ?? 24,
		};
	}

	/**
	 * Detect the default shell for the current platform
	 */
	static getDefaultShell(): string {
		if (os.platform() === "win32") {
			return process.env.COMSPEC || "cmd.exe";
		}
		return process.env.SHELL || "/bin/bash";
	}

	/**
	 * Start the PTY session
	 */
	spawn(): void {
		if (this.pty) {
			throw new Error("PTY session already running. Call kill() first.");
		}

		// Dynamic import of node-pty (it's a native module)
		let nodePty;
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			nodePty = require("node-pty");
			console.log("Runbook: node-pty loaded successfully");
		} catch (err) {
			console.error("Runbook: Failed to load node-pty:", err);
			throw new Error(`Failed to load node-pty: ${err}. Native modules may not be supported in this Obsidian version.`);
		}

		const spawn: SpawnFn = nodePty.spawn;

		const shell = this.options.shell || PtySession.getDefaultShell();
		const args: string[] = [];

		// Use login shell on Unix for proper environment
		if (os.platform() !== "win32") {
			args.push("-l");
		}

		console.log("Runbook: Spawning PTY with shell:", shell, "args:", args);

		try {
			this.pty = spawn(shell, args, {
				name: "xterm-256color",
				cols: this.options.cols ?? 80,
				rows: this.options.rows ?? 24,
				cwd: this.options.cwd || os.homedir(),
				env: {
					...process.env,
					...this.options.env,
				} as { [key: string]: string },
			});
		} catch (err) {
			console.error("Runbook: Failed to spawn PTY process:", err);
			throw new Error(`Failed to spawn shell process: ${err}`);
		}

		this.setState("alive");
		console.log("Runbook: PTY spawned, pid:", this.pty.pid);

		// Handle data from PTY
		const dataDisposable = this.pty.onData((data: string) => {
			this.emit("data", data);
		});
		this.disposables.push(dataDisposable);

		// Handle PTY exit
		const exitDisposable = this.pty.onExit(({ exitCode, signal }) => {
			this.emit("exit", exitCode, signal);
			this.setState("dead");
			this.cleanup();
		});
		this.disposables.push(exitDisposable);
	}

	/**
	 * Write data to the PTY (user input)
	 */
	write(data: string): void {
		if (!this.pty) {
			throw new Error("PTY session not running. Call spawn() first.");
		}
		this.pty.write(data);
	}

	/**
	 * Resize the PTY
	 */
	resize(cols: number, rows: number): void {
		if (this.pty && cols > 0 && rows > 0) {
			this.pty.resize(cols, rows);
			this.emit("resize", { cols, rows });
		}
	}

	/**
	 * Kill the PTY session
	 */
	kill(): void {
		if (this.pty) {
			this.pty.kill();
			this.cleanup();
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

	/**
	 * Clean up resources
	 */
	private cleanup(): void {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];
		this.pty = null;
	}

	private setState(state: PtySessionState): void {
		if (this._state !== state) {
			this._state = state;
			this.emit("stateChange", state);
		}
	}
}
