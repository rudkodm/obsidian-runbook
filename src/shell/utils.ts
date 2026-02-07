import { execSync } from "child_process";
import * as os from "os";

/**
 * Unified Python PTY helper script.
 * Supports both shell sessions and interpreter sessions.
 *
 * For shells: spawns a login shell (shell -l)
 * For interpreters: spawns arbitrary commands via login shell (shell -l -c "exec cmd")
 */
export const PYTHON_PTY_SCRIPT = `
import sys
import os
import pty
import select
import struct
import fcntl
import termios
import signal
import shlex

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

    shell = os.environ.get('SHELL', '/bin/bash')

    # Detect if this is a direct shell invocation vs an interpreter command
    # Direct shell: absolute path (/bin/bash) or common shell name
    is_shell = False
    if len(cmd) == 1:
        cmd_lower = os.path.basename(cmd[0]).lower()
        # Check if it's a known shell or absolute path to shell
        if cmd[0].startswith('/') or cmd_lower in ['bash', 'zsh', 'sh', 'fish', 'ksh', 'tcsh', 'csh']:
            is_shell = True

    if is_shell:
        # Direct shell invocation - start as login shell
        args = [cmd[0], '-l']
    else:
        # Interpreter or command - run through interactive login shell to inherit PATH
        # -i ensures shell initialization files (.zshrc, .bashrc) are sourced
        # -l makes it a login shell
        # This is needed for tools installed via nvm, npm, homebrew, etc.
        full_cmd = ' '.join(shlex.quote(c) for c in cmd)
        args = [shell, '-i', '-l', '-c', 'exec ' + full_cmd]

    pid, pty_fd = pty.fork()

    if pid == 0:
        os.execvp(args[0], args)
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

/**
 * Find Python 3 executable
 * @returns Python command or null if not found
 */
export const findPython = (): string | null => {
  const candidates = ["python3", "python"] as const;

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
      // Not found, continue to next candidate
    }
  }

  return null;
};

/**
 * Get default shell for the current platform
 * @returns Shell path
 */
export const getDefaultShell = (): string => {
  const platform = os.platform();

  if (platform === "win32") {
    return process.env.COMSPEC || "cmd.exe";
  }

  return process.env.SHELL || "/bin/bash";
};

/**
 * Check if PTY sessions are available on this platform
 * @returns true if platform supports PTY and Python 3 is available
 */
export const isPtyAvailable = (): boolean => {
  const platform = os.platform();

  // PTY only works on Unix-like systems
  if (platform !== "darwin" && platform !== "linux") {
    return false;
  }

  return findPython() !== null;
};

/**
 * Remove empty lines from code
 * @param code Source code
 * @returns Code with empty lines removed
 */
export const removeEmptyLines = (code: string): string => {
  const lines = code
    .split("\n")
    .filter(line => line.trim() !== "")
    .join("\n");
  return lines ? lines + "\n" : "";
};

/**
 * Create a delay promise
 * @param ms Milliseconds to wait
 * @returns Promise that resolves after delay
 */
export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxAttempts Maximum number of attempts
 * @param baseDelay Base delay in milliseconds
 * @returns Result of the function
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts - 1) {
        const delayMs = baseDelay * Math.pow(2, attempt);
        await delay(delayMs);
      }
    }
  }

  throw lastError ?? new Error("All retry attempts failed");
};

/**
 * Create a timeout promise that rejects after specified time
 * @param ms Milliseconds to wait before timeout
 * @param message Error message
 * @returns Promise that rejects on timeout
 */
export const timeout = (ms: number, message: string = "Operation timed out"): Promise<never> =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );

/**
 * Race a promise against a timeout
 * @param promise Promise to race
 * @param ms Timeout in milliseconds
 * @param message Timeout error message
 * @returns Result of the promise
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> =>
  Promise.race([promise, timeout(ms, message)]);
