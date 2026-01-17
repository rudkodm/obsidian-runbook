import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TerminalManager } from "../../src/terminal/terminal-manager";

describe("TerminalManager", () => {
	let manager: TerminalManager;

	beforeEach(() => {
		manager = new TerminalManager();
	});

	afterEach(() => {
		manager.destroy();
	});

	describe("createSession", () => {
		it("should create a new session", () => {
			const { id, name, session } = manager.createSession();

			expect(id).toBe("terminal-1");
			expect(name).toBe("Terminal 1");
			expect(session).toBeDefined();
		});

		it("should auto-increment session IDs", () => {
			const session1 = manager.createSession();
			const session2 = manager.createSession();
			const session3 = manager.createSession();

			expect(session1.id).toBe("terminal-1");
			expect(session2.id).toBe("terminal-2");
			expect(session3.id).toBe("terminal-3");
		});

		it("should auto-activate first session", () => {
			const { id } = manager.createSession();

			expect(manager.activeSessionId).toBe(id);
			expect(manager.activeSession).toBeDefined();
		});

		it("should emit sessionCreated event", () => {
			const listener = vi.fn();
			manager.on("sessionCreated", listener);

			const result = manager.createSession();

			expect(listener).toHaveBeenCalledWith(result);
		});
	});

	describe("removeSession", () => {
		it("should remove a session", () => {
			const { id } = manager.createSession();
			expect(manager.sessionCount).toBe(1);

			manager.removeSession(id);

			expect(manager.sessionCount).toBe(0);
		});

		it("should emit sessionRemoved event", () => {
			const { id } = manager.createSession();
			const listener = vi.fn();
			manager.on("sessionRemoved", listener);

			manager.removeSession(id);

			expect(listener).toHaveBeenCalledWith(id);
		});

		it("should activate another session when removing active session", () => {
			const session1 = manager.createSession();
			const session2 = manager.createSession();
			manager.setActiveSession(session1.id);

			manager.removeSession(session1.id);

			expect(manager.activeSessionId).toBe(session2.id);
		});

		it("should set activeSessionId to null when removing last session", () => {
			const { id } = manager.createSession();
			manager.removeSession(id);

			expect(manager.activeSessionId).toBeNull();
			expect(manager.activeSession).toBeNull();
		});
	});

	describe("setActiveSession", () => {
		it("should set active session", () => {
			const session1 = manager.createSession();
			const session2 = manager.createSession();

			manager.setActiveSession(session2.id);

			expect(manager.activeSessionId).toBe(session2.id);
		});

		it("should emit activeSessionChanged event", () => {
			const session1 = manager.createSession();
			const session2 = manager.createSession();
			const listener = vi.fn();
			manager.on("activeSessionChanged", listener);

			manager.setActiveSession(session2.id);

			expect(listener).toHaveBeenCalledWith(session2.id);
		});

		it("should do nothing for non-existent session", () => {
			const { id } = manager.createSession();

			manager.setActiveSession("non-existent");

			expect(manager.activeSessionId).toBe(id);
		});
	});

	describe("getSession", () => {
		it("should return session by ID", () => {
			const { id, session } = manager.createSession();

			expect(manager.getSession(id)).toBe(session);
		});

		it("should return undefined for non-existent session", () => {
			expect(manager.getSession("non-existent")).toBeUndefined();
		});
	});

	describe("executeInActive", () => {
		it("should throw when no active session", async () => {
			await expect(manager.executeInActive("echo test")).rejects.toThrow(
				"No active terminal"
			);
		});

		it("should execute command in active session", async () => {
			manager.createSession();
			const output = await manager.executeInActive("echo hello");

			expect(output).toBe("hello");
		});
	});

	describe("executeInSession", () => {
		it("should execute command in specific session", async () => {
			const { id } = manager.createSession();
			const output = await manager.executeInSession(id, "echo hello");

			expect(output).toBe("hello");
		});

		it("should throw for non-existent session", async () => {
			await expect(manager.executeInSession("non-existent", "echo test")).rejects.toThrow(
				"Session non-existent not found"
			);
		});
	});

	describe("history navigation", () => {
		it("should navigate to previous command", async () => {
			const { id } = manager.createSession();
			await manager.executeInSession(id, "echo 1");
			await manager.executeInSession(id, "echo 2");
			await manager.executeInSession(id, "echo 3");

			expect(manager.historyPrevious(id)).toBe("echo 3");
			expect(manager.historyPrevious(id)).toBe("echo 2");
			expect(manager.historyPrevious(id)).toBe("echo 1");
		});

		it("should navigate to next command", async () => {
			const { id } = manager.createSession();
			await manager.executeInSession(id, "echo 1");
			await manager.executeInSession(id, "echo 2");

			manager.historyPrevious(id);
			manager.historyPrevious(id);

			expect(manager.historyNext(id)).toBe("echo 2");
		});

		it("should return empty string when at end of history", async () => {
			const { id } = manager.createSession();
			await manager.executeInSession(id, "echo 1");

			expect(manager.historyNext(id)).toBe("");
		});

		it("should return null when no history", () => {
			const { id } = manager.createSession();

			expect(manager.historyPrevious(id)).toBeNull();
		});
	});

	describe("destroy", () => {
		it("should kill all sessions and clear state", () => {
			manager.createSession();
			manager.createSession();

			manager.destroy();

			expect(manager.sessionCount).toBe(0);
			expect(manager.activeSessionId).toBeNull();
		});
	});
});
