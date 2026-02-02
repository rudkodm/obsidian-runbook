import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as os from "os";
import * as fs from "fs";
import { SessionState, InterpreterType, IInterpreterSession } from "./types";
import { PYTHON_PTY_SCRIPT, findPython, isPtyAvailable, removeEmptyLines } from "./utils";

export interface InterpreterSessionOptions {
	cwd?: string;
	env?: Record<string, string>;
	cols?: number;
	rows?: number;
	pythonPath?: string;
	/** Override the default interpreter command */
	interpreterPath?: string;
}

/**
 * Abstract base class for interactive interpreter sessions.
 * Spawns a persistent REPL in a real PTY via Python's pty module.
 * State is preserved across code block executions within the same session.
 *
 * Subclasses provide language-specific command configuration and code wrapping.
 * To add a new interpreter, extend this class and implement:
 *   - interpreterType (identifier)
 *   - displayName (UI label)
 *   - getCommand() (interpreter command + args)
 *   - wrapCode() (REPL-specific code formatting)
 */
export abstract class BaseInterpreterSession extends EventEmitter implements IInterpreterSession {
	private process: ChildProcess | null = null;
	private cmdio: fs.WriteStream | null = null;
	private _state: SessionState = "idle";
	protected options: InterpreterSessionOptions;

	constructor(options: InterpreterSessionOptions = {}) {
		super();
		this.options = options;
	}

	/** The interpreter type identifier */
	abstract get interpreterType(): InterpreterType;

	/** Human-readable display name for the UI */
	abstract get displayName(): string;

	/** Get the default command and args to spawn the interpreter */
	protected abstract getCommand(): { command: string; args: string[] };

	/**
	 * Wrap code for execution in this interpreter's REPL.
	 * Default implementation removes empty lines.
	 * Override for language-specific wrapping (e.g., Python needs indentation handling).
	 */
	wrapCode(code: string): string {
		return removeEmptyLines(code);
	}

	get state(): SessionState {
		return this._state;
	}

	get pid(): number | undefined {
		return this.process?.pid;
	}

	get isAlive(): boolean {
		return this._state === "alive";
	}

	/**
	 * Check if interpreter sessions are available on this platform
	 */
	static isAvailable(): boolean {
		return isPtyAvailable();
	}

	/**
	 * Spawn the interpreter REPL in a PTY
	 */
	spawn(): void {
		if (this.process) {
			throw new Error("Interpreter session already running. Call kill() first.");
		}

		const pythonPath = this.options.pythonPath || findPython();
		if (!pythonPath) {
			throw new Error("Python 3 not found (needed for PTY). Please install Python 3.");
		}

		const config = this.getResolvedCommand();

		const env: Record<string, string> = {
			...(process.env as Record<string, string>),
			...this.options.env,
			TERM: "xterm-256color",
		};

		if (this.options.cols) {
			env.COLUMNS = String(this.options.cols);
		}
		if (this.options.rows) {
			env.LINES = String(this.options.rows);
		}

		// Spawn Python PTY helper with the interpreter command as arguments
		this.process = spawn(
			pythonPath,
			["-c", PYTHON_PTY_SCRIPT, config.command, ...config.args],
			{
				stdio: ["pipe", "pipe", "pipe", "pipe"],
				cwd: this.options.cwd || process.cwd(),
				env,
			},
		);

		const stdio3 = this.process.stdio[3];
		if (stdio3 && "write" in stdio3) {
			this.cmdio = stdio3 as unknown as fs.WriteStream;
		}

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
			this.cmdio = null;
		});

		if (this.options.cols && this.options.rows) {
			this.resize(this.options.cols, this.options.rows);
		}
	}

	/**
	 * Write data to the interpreter (user input or code)
	 */
	write(data: string): void {
		if (!this.process || !this.process.stdin) {
			throw new Error("Interpreter session not running. Call spawn() first.");
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
	 * Kill the interpreter session
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
	 * Get the resolved command, respecting interpreterPath override
	 */
	private getResolvedCommand(): { command: string; args: string[] } {
		if (this.options.interpreterPath) {
			return { command: this.options.interpreterPath, args: [] };
		}
		return this.getCommand();
	}

	private setState(state: SessionState): void {
		if (this._state !== state) {
			this._state = state;
			this.emit("stateChange", state);
		}
	}
}
