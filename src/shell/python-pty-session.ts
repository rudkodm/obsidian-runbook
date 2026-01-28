import { spawn, ChildProcess, execSync } from "child_process";
import { EventEmitter } from "events";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

export type PythonPtyState = "idle" | "alive" | "dead";

export interface PythonPtyOptions {
	shell?: string;
	cwd?: string;
	env?: Record<string, string>;
	cols?: number;
	rows?: number;
	pythonPath?: string;
}

// Embedded Python PTY helper script
const PTY_HELPER_SCRIPT = `
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
    if len(sys.argv) > 1:
        shell = sys.argv[1]
        args = sys.argv[1:]
    else:
        shell = os.environ.get('SHELL', '/bin/bash')
        args = [shell]

    pid, pty_fd = pty.fork()

    if pid == 0:
        os.execvp(shell, args)
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
                                        # Send SIGWINCH to notify child of resize
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
	 * Find Python 3 executable
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
				// Not found or error, try next
			}
		}
		return null;
	}

	/**
	 * Check if Python PTY is available on this platform
	 */
	static isAvailable(): boolean {
		const platform = os.platform();
		// Only works on Unix-like systems
		if (platform !== "darwin" && platform !== "linux") {
			return false;
		}
		// Check if Python 3 is available
		return PythonPtySession.findPython() !== null;
	}

	/**
	 * Get the default shell for the current platform
	 */
	static getDefaultShell(): string {
		return process.env.SHELL || "/bin/bash";
	}

	/**
	 * Spawn the PTY session
	 */
	spawn(): void {
		if (this.process) {
			throw new Error("PTY session already running. Call kill() first.");
		}

		const pythonPath = this.options.pythonPath || PythonPtySession.findPython();
		if (!pythonPath) {
			throw new Error("Python 3 not found. Please install Python 3.");
		}

		const shell = this.options.shell || PythonPtySession.getDefaultShell();

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
		this.process = spawn(pythonPath, ["-c", PTY_HELPER_SCRIPT, shell], {
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
