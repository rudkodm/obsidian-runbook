import { spawn, ChildProcess, execSync } from "child_process";
import { EventEmitter } from "events";
import * as os from "os";
import * as fs from "fs";

/** Supported interactive interpreter types */
export type InterpreterType = "python" | "javascript" | "typescript";

/** Interpreter command configuration */
export interface InterpreterConfig {
	command: string;
	args: string[];
}

export interface InterpreterSessionOptions {
	type: InterpreterType;
	cwd?: string;
	env?: Record<string, string>;
	cols?: number;
	rows?: number;
	pythonPath?: string;
	/** Override the default interpreter command */
	interpreterPath?: string;
}

/** Default interpreter configurations for each language */
export const DEFAULT_INTERPRETERS: Record<InterpreterType, InterpreterConfig> = {
	python: { command: "python3", args: [] },
	javascript: { command: "node", args: [] },
	typescript: { command: "npx", args: ["ts-node"] },
};

/**
 * Embedded Python PTY helper that spawns an arbitrary command.
 * Unlike the shell PTY helper, this does NOT add -l (login shell) flag.
 * The command to run is passed as argv[1:].
 */
const INTERPRETER_PTY_SCRIPT = `
import sys
import os
import pty
import select
import struct
import fcntl
import termios
import signal

STDIN = sys.stdin.fileno()
STDOUT = sys.stdout.fileno()
CMDIO = 3

def set_nonblocking(fd):
    flags = fcntl.fcntl(fd, fcntl.F_GETFL)
    fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

def set_winsize(fd, cols, rows):
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def main():
    cmd = sys.argv[1:]
    if not cmd:
        print("No command specified", file=sys.stderr)
        sys.exit(1)

    pid, pty_fd = pty.fork()

    if pid == 0:
        os.execvp(cmd[0], cmd)
        sys.exit(1)

    set_nonblocking(STDIN)
    set_nonblocking(pty_fd)

    has_cmdio = False
    try:
        set_nonblocking(CMDIO)
        has_cmdio = True
    except OSError:
        pass

    read_fds = [STDIN, pty_fd]
    if has_cmdio:
        read_fds.append(CMDIO)

    cmd_buffer = ""

    try:
        while True:
            try:
                readable, _, _ = select.select(read_fds, [], [], 0.1)
            except select.error:
                break

            for fd in readable:
                if fd == pty_fd:
                    try:
                        data = os.read(pty_fd, 4096)
                        if not data:
                            return
                        os.write(STDOUT, data)
                    except OSError:
                        return

                elif fd == STDIN:
                    try:
                        data = os.read(STDIN, 4096)
                        if not data:
                            return
                        os.write(pty_fd, data)
                    except OSError:
                        pass

                elif fd == CMDIO:
                    try:
                        data = os.read(CMDIO, 256)
                        if data:
                            cmd_buffer += data.decode('utf-8', errors='ignore')
                            while '\\n' in cmd_buffer:
                                line, cmd_buffer = cmd_buffer.split('\\n', 1)
                                if 'x' in line:
                                    try:
                                        cols, rows = line.strip().split('x')
                                        set_winsize(pty_fd, int(cols), int(rows))
                                        os.kill(pid, signal.SIGWINCH)
                                    except (ValueError, OSError):
                                        pass
                    except OSError:
                        pass

            result = os.waitpid(pid, os.WNOHANG)
            if result[0] != 0:
                break

    except KeyboardInterrupt:
        pass
    finally:
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass

if __name__ == '__main__':
    main()
`;

export type InterpreterState = "idle" | "alive" | "dead";

/**
 * Interactive interpreter session using Python's pty module.
 * Spawns a persistent REPL (python3, node, ts-node) in a real PTY.
 * State is preserved across code block executions within the same session.
 */
export class InterpreterSession extends EventEmitter {
	private process: ChildProcess | null = null;
	private cmdio: fs.WriteStream | null = null;
	private _state: InterpreterState = "idle";
	private options: InterpreterSessionOptions;

	constructor(options: InterpreterSessionOptions) {
		super();
		this.options = options;
	}

	get state(): InterpreterState {
		return this._state;
	}

	get pid(): number | undefined {
		return this.process?.pid;
	}

	get isAlive(): boolean {
		return this._state === "alive";
	}

	get interpreterType(): InterpreterType {
		return this.options.type;
	}

	/**
	 * Get the interpreter command + args for this session
	 */
	private getInterpreterConfig(): InterpreterConfig {
		if (this.options.interpreterPath) {
			return { command: this.options.interpreterPath, args: [] };
		}
		return DEFAULT_INTERPRETERS[this.options.type];
	}

	/**
	 * Find Python 3 executable (needed for the PTY helper)
	 */
	static findPython(): string | null {
		const candidates = ["python3", "python"];

		for (const cmd of candidates) {
			try {
				const result = execSync(`${cmd} --version 2>&1`, {
					encoding: "utf-8",
					timeout: 5000,
				});
				if (result.includes("Python 3")) {
					return cmd;
				}
			} catch {
				// Not found, try next
			}
		}
		return null;
	}

	/**
	 * Check if interpreter sessions are available on this platform
	 */
	static isAvailable(): boolean {
		const platform = os.platform();
		if (platform !== "darwin" && platform !== "linux") {
			return false;
		}
		return InterpreterSession.findPython() !== null;
	}

	/**
	 * Spawn the interpreter REPL in a PTY
	 */
	spawn(): void {
		if (this.process) {
			throw new Error("Interpreter session already running. Call kill() first.");
		}

		const pythonPath = this.options.pythonPath || InterpreterSession.findPython();
		if (!pythonPath) {
			throw new Error("Python 3 not found (needed for PTY). Please install Python 3.");
		}

		const config = this.getInterpreterConfig();

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
			["-c", INTERPRETER_PTY_SCRIPT, config.command, ...config.args],
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

	private setState(state: InterpreterState): void {
		if (this._state !== state) {
			this._state = state;
			this.emit("stateChange", state);
		}
	}
}
