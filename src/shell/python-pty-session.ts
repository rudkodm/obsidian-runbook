import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import { PYTHON_PTY_SCRIPT, findPython, isPtyAvailable, getDefaultShell } from "./utils";

export type PythonPtyState = "idle" | "alive" | "dead";

export interface PythonPtyOptions {
	shell?: string;
	cwd?: string;
	env?: Record<string, string>;
	cols?: number;
	rows?: number;
	pythonPath?: string;
}

/**
 * PTY session using Python's pty module.
 * Creates a real pseudo-terminal without native modules.
 * Works on macOS and Linux where Python 3 is available.
 */
export class PythonPtySession extends EventEmitter {
	private process: ChildProcess | null = null;
	private cmdio: fs.WriteStream | null = null;
	private _state: PythonPtyState = "idle";
	private options: PythonPtyOptions;

	constructor(options: PythonPtyOptions = {}) {
		super();
		this.options = options;
	}

	get state(): PythonPtyState {
		return this._state;
	}

	get pid(): number | undefined {
		return this.process?.pid;
	}

	get isAlive(): boolean {
		return this._state === "alive";
	}

	/**
	 * Check if Python PTY is available on this platform
	 */
	static isAvailable(): boolean {
		return isPtyAvailable();
	}

	/**
	 * Spawn the PTY session
	 */
	spawn(): void {
		if (this.process) {
			throw new Error("PTY session already running. Call kill() first.");
		}

		const pythonPath = this.options.pythonPath || findPython();
		if (!pythonPath) {
			throw new Error("Python 3 not found. Please install Python 3.");
		}

		const shell = this.options.shell || getDefaultShell();

		// Set up environment
		const env: Record<string, string> = {
			...(process.env as Record<string, string>),
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

		// Spawn Python with embedded script
		this.process = spawn(pythonPath, ["-c", PYTHON_PTY_SCRIPT, shell], {
			stdio: ["pipe", "pipe", "pipe", "pipe"], // stdin, stdout, stderr, cmdio
			cwd: this.options.cwd || process.cwd(),
			env,
		});

		// Get command I/O stream for resize
		const stdio3 = this.process.stdio[3];
		if (stdio3 && "write" in stdio3) {
			this.cmdio = stdio3 as unknown as fs.WriteStream;
		}

		this.setState("alive");

		// Handle stdout (shell output)
		this.process.stdout?.on("data", (data: Buffer) => {
			this.emit("data", data.toString());
		});

		// Handle stderr (errors)
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
			this.cmdio = null;
		});

		// Set initial size
		if (this.options.cols && this.options.rows) {
			this.resize(this.options.cols, this.options.rows);
		}
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
	 * Resize the PTY
	 */
	resize(cols: number, rows: number): void {
		if (this.cmdio) {
			this.cmdio.write(`${cols}x${rows}\n`);
		}
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
			this.cmdio = null;
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

	private setState(state: PythonPtyState): void {
		if (this._state !== state) {
			this._state = state;
			this.emit("stateChange", state);
		}
	}
}
