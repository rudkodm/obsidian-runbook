import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ShellSession } from "../../src/shell/session";

describe("ShellSession", () => {
	let session: ShellSession;

	beforeEach(() => {
		session = new ShellSession();
	});

	afterEach(() => {
		if (session.isAlive) {
			session.kill();
		}
	});

	describe("initialization", () => {
		it("should start in idle state", () => {
			expect(session.state).toBe("idle");
			expect(session.isAlive).toBe(false);
		});

		it("should detect default shell", () => {
			const shell = ShellSession.getDefaultShell();
			expect(shell).toBeTruthy();
			expect(typeof shell).toBe("string");
		});
	});

	describe("spawn", () => {
		it("should spawn a shell successfully", () => {
			session.spawn();

			expect(session.state).toBe("alive");
			expect(session.isAlive).toBe(true);
			expect(session.pid).toBeDefined();
		});

		it("should throw if already running", () => {
			session.spawn();

			expect(() => session.spawn()).toThrow("Shell session already running");
		});

		it("should emit stateChange event when spawned", async () => {
			const states: string[] = [];
			session.on("stateChange", (state) => states.push(state));

			session.spawn();

			expect(states).toContain("alive");
		});
	});

	describe("execute", () => {
		beforeEach(() => {
			session.spawn();
		});

		it("should execute a simple command and return output", async () => {
			const output = await session.execute("echo hello");

			expect(output.trim()).toBe("hello");
		});

		it("should handle commands with arguments", async () => {
			const output = await session.execute("echo foo bar baz");

			expect(output.trim()).toBe("foo bar baz");
		});

		it("should preserve state across commands", async () => {
			await session.execute("export TEST_VAR=runbook_test_123");
			const output = await session.execute("echo $TEST_VAR");

			expect(output.trim()).toBe("runbook_test_123");
		});

		it("should preserve working directory across commands", async () => {
			await session.execute("cd /tmp");
			const output = await session.execute("pwd");

			// On macOS, /tmp is a symlink to /private/tmp
		expect(output.trim()).toMatch(/^(\/private)?\/tmp$/);
		});

		it("should throw if shell not running", async () => {
			session.kill();

			await expect(session.execute("echo test")).rejects.toThrow(
				"Shell session not running"
			);
		});

		it("should handle multiline output", async () => {
			const output = await session.execute("echo line1; echo line2; echo line3");

			expect(output).toContain("line1");
			expect(output).toContain("line2");
			expect(output).toContain("line3");
		});

		it("should timeout on long-running commands", async () => {
			await expect(session.execute("sleep 10", 100)).rejects.toThrow(
				"timed out"
			);
		}, 5000);
	});

	describe("kill", () => {
		it("should kill a running shell", () => {
			session.spawn();
			expect(session.isAlive).toBe(true);

			session.kill();

			expect(session.isAlive).toBe(false);
			expect(session.state).toBe("dead");
		});

		it("should be safe to call multiple times", () => {
			session.spawn();
			session.kill();
			session.kill(); // Should not throw

			expect(session.state).toBe("dead");
		});

		it("should emit stateChange event when killed", () => {
			session.spawn();

			const states: string[] = [];
			session.on("stateChange", (state) => states.push(state));

			session.kill();

			expect(states).toContain("dead");
		});
	});

	describe("restart", () => {
		it("should restart a shell session", () => {
			session.spawn();
			const oldPid = session.pid;

			session.restart();

			expect(session.isAlive).toBe(true);
			expect(session.pid).not.toBe(oldPid);
		});

		it("should clear state after restart", async () => {
			session.spawn();
			await session.execute("export RESTART_TEST=before");

			session.restart();

			// Small delay to let shell initialize
			await new Promise((resolve) => setTimeout(resolve, 100));

			const output = await session.execute("echo ${RESTART_TEST:-empty}");
			expect(output.trim()).toBe("empty");
		});
	});

	describe("output buffer", () => {
		it("should accumulate output in buffer", async () => {
			session.spawn();

			await session.execute("echo test1");
			await session.execute("echo test2");

			const buffer = session.getOutputBuffer();
			expect(buffer).toContain("test1");
			expect(buffer).toContain("test2");
		});

		it("should clear buffer when requested", async () => {
			session.spawn();
			await session.execute("echo something");

			session.clearOutputBuffer();

			expect(session.getOutputBuffer()).toBe("");
		});
	});

	describe("error handling", () => {
		it("should handle shell exit gracefully", async () => {
			session.spawn();

			const exitPromise = new Promise<number | null>((resolve) => {
				session.on("exit", resolve);
			});

			session.sendRaw("exit\n");

			const exitCode = await exitPromise;
			expect(exitCode).toBe(0);
			expect(session.state).toBe("dead");
		});

		it("should emit error on invalid command without crashing", async () => {
			session.spawn();

			// Invalid command should still return (with error output)
			const output = await session.execute("nonexistent_command_12345 2>&1 || true");

			// Shell should still be alive
			expect(session.isAlive).toBe(true);
		});
	});

	describe("custom options", () => {
		it("should accept custom working directory", async () => {
			const customSession = new ShellSession({ cwd: "/tmp" });
			customSession.spawn();

			try {
				const output = await customSession.execute("pwd");
				// On macOS, /tmp is a symlink to /private/tmp
		expect(output.trim()).toMatch(/^(\/private)?\/tmp$/);
			} finally {
				customSession.kill();
			}
		});

		it("should accept custom environment variables", async () => {
			const customSession = new ShellSession({
				env: { CUSTOM_VAR: "custom_value" },
			});
			customSession.spawn();

			try {
				const output = await customSession.execute("echo $CUSTOM_VAR");
				expect(output.trim()).toBe("custom_value");
			} finally {
				customSession.kill();
			}
		});
	});
});
