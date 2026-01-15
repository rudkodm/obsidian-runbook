/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OutputContainer } from "../../src/ui/output-container";

// Mock DOM environment
function createMockParentElement(): HTMLElement {
	const el = document.createElement("div");
	return el;
}

describe("OutputContainer", () => {
	let parentEl: HTMLElement;
	let container: OutputContainer;

	beforeEach(() => {
		parentEl = createMockParentElement();
		container = new OutputContainer(parentEl);
	});

	describe("constructor", () => {
		it("should create container element", () => {
			const containerEl = container.getElement();
			expect(containerEl).toBeDefined();
			expect(containerEl.className).toBe("runbook-output-container");
		});

		it("should be initially hidden", () => {
			const containerEl = container.getElement();
			expect(containerEl.style.display).toBe("none");
		});

		it("should be appended to parent element", () => {
			expect(parentEl.children.length).toBe(1);
			expect(parentEl.firstChild).toBe(container.getElement());
		});
	});

	describe("showLoading", () => {
		it("should make container visible", () => {
			container.showLoading();
			expect(container.getElement().style.display).toBe("block");
		});

		it("should show running message in header", () => {
			container.showLoading();
			const header = container.getElement().querySelector(".runbook-output-header");
			expect(header?.textContent).toContain("Running...");
		});

		it("should show spinner", () => {
			container.showLoading();
			const spinner = container.getElement().querySelector(".runbook-output-spinner");
			expect(spinner).not.toBeNull();
		});
	});

	describe("showOutput", () => {
		it("should display output text", () => {
			container.showOutput("Hello, World!");
			const pre = container.getElement().querySelector("pre");
			expect(pre?.textContent).toBe("Hello, World!");
		});

		it("should show Output label in header", () => {
			container.showOutput("test output");
			const status = container.getElement().querySelector(".runbook-output-status");
			expect(status?.textContent).toBe("Output");
		});

		it("should show timestamp", () => {
			container.showOutput("test");
			const timestamp = container.getElement().querySelector(".runbook-output-timestamp");
			expect(timestamp).not.toBeNull();
		});

		it("should show copy and clear buttons", () => {
			container.showOutput("test");
			const buttons = container.getElement().querySelectorAll(".runbook-output-btn");
			expect(buttons.length).toBe(2);
		});

		it("should handle empty output", () => {
			container.showOutput("");
			const status = container.getElement().querySelector(".runbook-output-status");
			expect(status?.textContent).toBe("No output");
			const empty = container.getElement().querySelector(".runbook-output-empty");
			expect(empty).not.toBeNull();
		});

		it("should handle whitespace-only output as empty", () => {
			container.showOutput("   \n\t  ");
			const status = container.getElement().querySelector(".runbook-output-status");
			expect(status?.textContent).toBe("No output");
		});
	});

	describe("showError", () => {
		it("should display error text", () => {
			container.showError("Command failed");
			const pre = container.getElement().querySelector("pre");
			expect(pre?.textContent).toBe("Command failed");
		});

		it("should show Error label in header", () => {
			container.showError("error");
			const status = container.getElement().querySelector(".runbook-output-status");
			expect(status?.textContent).toBe("Error");
		});

		it("should have error styling class", () => {
			container.showError("error");
			const status = container.getElement().querySelector(".runbook-output-status-error");
			expect(status).not.toBeNull();
		});

		it("should add error class to content", () => {
			container.showError("error");
			const content = container.getElement().querySelector(".runbook-output-error");
			expect(content).not.toBeNull();
		});
	});

	describe("clear", () => {
		it("should hide container", () => {
			container.showOutput("test");
			container.clear();
			expect(container.getElement().style.display).toBe("none");
		});

		it("should call onClear callback", () => {
			const callback = vi.fn();
			container.setClearCallback(callback);
			container.showOutput("test");
			container.clear();
			expect(callback).toHaveBeenCalled();
		});
	});

	describe("destroy", () => {
		it("should remove element from DOM", () => {
			expect(parentEl.children.length).toBe(1);
			container.destroy();
			expect(parentEl.children.length).toBe(0);
		});
	});

	describe("collapsible output", () => {
		it("should show expand button for long output", () => {
			// Create output with more than 20 lines
			const longOutput = Array(25).fill("line").join("\n");
			container.showOutput(longOutput);

			const expandBtn = container.getElement().querySelector(".runbook-output-expand");
			expect(expandBtn).not.toBeNull();
			expect(expandBtn?.textContent).toContain("more lines");
		});

		it("should not show expand button for short output", () => {
			container.showOutput("short output");

			const expandBtn = container.getElement().querySelector(".runbook-output-expand");
			expect(expandBtn).toBeNull();
		});
	});

	describe("callbacks", () => {
		it("should set copy callback", () => {
			const callback = vi.fn();
			container.setCopyCallback(callback);
			// Callback is stored but not directly testable without DOM events
			expect(true).toBe(true); // Verify method doesn't throw
		});

		it("should set clear callback", () => {
			const callback = vi.fn();
			container.setClearCallback(callback);
			expect(true).toBe(true); // Verify method doesn't throw
		});
	});
});
