import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TerminalManager, TerminalTab } from "../../src/terminal/terminal-manager";

describe("TerminalManager", () => {
	let manager: TerminalManager;

	beforeEach(() => {
		manager = new TerminalManager();
	});

	afterEach(() => {
		manager.destroy();
	});

	describe("createTab", () => {
		it("should create a new terminal tab", () => {
			const tab = manager.createTab();

			expect(tab).toBeDefined();
			expect(tab.id).toBe("terminal-1");
			expect(tab.name).toBe("Terminal 1");
			expect(tab.session).toBeDefined();
			expect(tab.history).toEqual([]);
		});

		it("should auto-increment tab IDs", () => {
			const tab1 = manager.createTab();
			const tab2 = manager.createTab();
			const tab3 = manager.createTab();

			expect(tab1.id).toBe("terminal-1");
			expect(tab2.id).toBe("terminal-2");
			expect(tab3.id).toBe("terminal-3");
		});

		it("should allow custom names", () => {
			const tab = manager.createTab("My Custom Terminal");

			expect(tab.name).toBe("My Custom Terminal");
		});

		it("should auto-activate first tab", () => {
			const tab = manager.createTab();

			expect(manager.activeTabId).toBe(tab.id);
			expect(manager.activeTab).toBe(tab);
		});

		it("should emit tabCreated event", () => {
			const listener = vi.fn();
			manager.on("tabCreated", listener);

			const tab = manager.createTab();

			expect(listener).toHaveBeenCalledWith(tab);
		});
	});

	describe("closeTab", () => {
		it("should close a tab", () => {
			const tab = manager.createTab();
			expect(manager.tabCount).toBe(1);

			manager.closeTab(tab.id);

			expect(manager.tabCount).toBe(0);
		});

		it("should emit tabClosed event", () => {
			const tab = manager.createTab();
			const listener = vi.fn();
			manager.on("tabClosed", listener);

			manager.closeTab(tab.id);

			expect(listener).toHaveBeenCalledWith(tab.id);
		});

		it("should activate another tab when closing active tab", () => {
			const tab1 = manager.createTab();
			const tab2 = manager.createTab();
			manager.activateTab(tab1.id);

			manager.closeTab(tab1.id);

			expect(manager.activeTabId).toBe(tab2.id);
		});

		it("should set activeTabId to null when closing last tab", () => {
			const tab = manager.createTab();
			manager.closeTab(tab.id);

			expect(manager.activeTabId).toBeNull();
			expect(manager.activeTab).toBeNull();
		});
	});

	describe("activateTab", () => {
		it("should activate a tab", () => {
			const tab1 = manager.createTab();
			const tab2 = manager.createTab();

			manager.activateTab(tab2.id);

			expect(manager.activeTabId).toBe(tab2.id);
			expect(manager.activeTab).toBe(tab2);
		});

		it("should emit tabActivated event", () => {
			const tab1 = manager.createTab();
			const tab2 = manager.createTab();
			const listener = vi.fn();
			manager.on("tabActivated", listener);

			manager.activateTab(tab2.id);

			expect(listener).toHaveBeenCalledWith(tab2);
		});

		it("should do nothing for non-existent tab", () => {
			const tab = manager.createTab();

			manager.activateTab("non-existent");

			expect(manager.activeTabId).toBe(tab.id);
		});
	});

	describe("renameTab", () => {
		it("should rename a tab", () => {
			const tab = manager.createTab();

			manager.renameTab(tab.id, "New Name");

			expect(tab.name).toBe("New Name");
		});

		it("should emit tabRenamed event", () => {
			const tab = manager.createTab();
			const listener = vi.fn();
			manager.on("tabRenamed", listener);

			manager.renameTab(tab.id, "New Name");

			expect(listener).toHaveBeenCalledWith(tab);
		});
	});

	describe("getAllTabs", () => {
		it("should return all tabs", () => {
			const tab1 = manager.createTab();
			const tab2 = manager.createTab();
			const tab3 = manager.createTab();

			const tabs = manager.getAllTabs();

			expect(tabs).toHaveLength(3);
			expect(tabs).toContain(tab1);
			expect(tabs).toContain(tab2);
			expect(tabs).toContain(tab3);
		});

		it("should return empty array when no tabs", () => {
			expect(manager.getAllTabs()).toEqual([]);
		});
	});

	describe("getTab", () => {
		it("should return tab by ID", () => {
			const tab = manager.createTab();

			expect(manager.getTab(tab.id)).toBe(tab);
		});

		it("should return undefined for non-existent tab", () => {
			expect(manager.getTab("non-existent")).toBeUndefined();
		});
	});

	describe("executeInActive", () => {
		it("should throw when no active terminal", async () => {
			await expect(manager.executeInActive("echo test")).rejects.toThrow(
				"No active terminal"
			);
		});

		it("should execute command in active terminal", async () => {
			manager.createTab();
			const output = await manager.executeInActive("echo hello");

			expect(output).toBe("hello");
		});

		it("should add command to history", async () => {
			const tab = manager.createTab();
			await manager.executeInActive("echo hello");

			expect(tab.history).toContain("echo hello");
		});

		it("should not add duplicate commands to history", async () => {
			const tab = manager.createTab();
			await manager.executeInActive("echo hello");
			await manager.executeInActive("echo hello");

			expect(tab.history.filter((cmd) => cmd === "echo hello")).toHaveLength(1);
		});
	});

	describe("history navigation", () => {
		it("should navigate to previous command", async () => {
			manager.createTab();
			await manager.executeInActive("echo 1");
			await manager.executeInActive("echo 2");
			await manager.executeInActive("echo 3");

			expect(manager.historyPrevious()).toBe("echo 3");
			expect(manager.historyPrevious()).toBe("echo 2");
			expect(manager.historyPrevious()).toBe("echo 1");
		});

		it("should navigate to next command", async () => {
			manager.createTab();
			await manager.executeInActive("echo 1");
			await manager.executeInActive("echo 2");

			manager.historyPrevious();
			manager.historyPrevious();

			expect(manager.historyNext()).toBe("echo 2");
		});

		it("should return empty string when at end of history", async () => {
			manager.createTab();
			await manager.executeInActive("echo 1");

			expect(manager.historyNext()).toBe("");
		});

		it("should return null when no history", () => {
			manager.createTab();

			expect(manager.historyPrevious()).toBeNull();
		});
	});

	describe("destroy", () => {
		it("should kill all sessions and clear tabs", () => {
			const tab1 = manager.createTab();
			const tab2 = manager.createTab();

			manager.destroy();

			expect(manager.tabCount).toBe(0);
			expect(manager.activeTabId).toBeNull();
		});
	});
});
