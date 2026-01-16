import { describe, it, expect, vi } from "vitest";
import {
	isLanguageSupported,
	normalizeLanguage,
	getOpeningFenceInfo,
	isClosingFence,
	stripPromptPrefix,
	findCodeBlockAtLine,
	getCodeBlockContext,
	getTextToExecute,
	SUPPORTED_LANGUAGES,
} from "../../src/editor/code-block";

// Mock Editor for testing
function createMockEditor(lines: string[], cursorLine: number = 0, selection: string = "") {
	return {
		getLine: (n: number) => lines[n] || "",
		lineCount: () => lines.length,
		getCursor: () => ({ line: cursorLine, ch: 0 }),
		getSelection: () => selection,
		setCursor: vi.fn(),
	} as any;
}

describe("code-block utilities", () => {
	describe("isLanguageSupported", () => {
		it("should accept supported languages", () => {
			expect(isLanguageSupported("bash")).toBe(true);
			expect(isLanguageSupported("sh")).toBe(true);
			expect(isLanguageSupported("zsh")).toBe(true);
			expect(isLanguageSupported("shell")).toBe(true);
			expect(isLanguageSupported("python")).toBe(true);
			expect(isLanguageSupported("py")).toBe(true);
		});

		it("should reject unsupported languages", () => {
			expect(isLanguageSupported("javascript")).toBe(false);
			expect(isLanguageSupported("rust")).toBe(false);
			expect(isLanguageSupported("go")).toBe(false);
			expect(isLanguageSupported("")).toBe(false);
		});

		it("should be case-insensitive", () => {
			expect(isLanguageSupported("BASH")).toBe(true);
			expect(isLanguageSupported("Python")).toBe(true);
			expect(isLanguageSupported("ZSH")).toBe(true);
		});

		it("should handle whitespace", () => {
			expect(isLanguageSupported("  bash  ")).toBe(true);
			expect(isLanguageSupported("\tbash\n")).toBe(true);
		});
	});

	describe("normalizeLanguage", () => {
		it("should normalize aliases to canonical names", () => {
			expect(normalizeLanguage("sh")).toBe("bash");
			expect(normalizeLanguage("shell")).toBe("bash");
			expect(normalizeLanguage("zsh")).toBe("bash");
			expect(normalizeLanguage("py")).toBe("python");
		});

		it("should keep canonical names as-is", () => {
			expect(normalizeLanguage("bash")).toBe("bash");
			expect(normalizeLanguage("python")).toBe("python");
		});

		it("should lowercase the result", () => {
			expect(normalizeLanguage("BASH")).toBe("bash");
			expect(normalizeLanguage("PYTHON")).toBe("python");
		});
	});

	describe("getOpeningFenceInfo", () => {
		it("should detect backtick fences with language", () => {
			expect(getOpeningFenceInfo("```bash")).toEqual({ language: "bash" });
			expect(getOpeningFenceInfo("```python")).toEqual({ language: "python" });
			expect(getOpeningFenceInfo("```javascript")).toEqual({ language: "javascript" });
		});

		it("should NOT detect backtick fences without language (language required)", () => {
			expect(getOpeningFenceInfo("```")).toBeNull();
		});

		it("should detect tilde fences with language", () => {
			expect(getOpeningFenceInfo("~~~bash")).toEqual({ language: "bash" });
			expect(getOpeningFenceInfo("~~~")).toBeNull(); // language required
		});

		it("should detect longer fences", () => {
			expect(getOpeningFenceInfo("````bash")).toEqual({ language: "bash" });
			expect(getOpeningFenceInfo("~~~~~python")).toEqual({ language: "python" });
		});

		it("should return null for non-fence lines", () => {
			expect(getOpeningFenceInfo("regular text")).toBeNull();
			expect(getOpeningFenceInfo("``not a fence")).toBeNull();
			expect(getOpeningFenceInfo("  ```indented")).toBeNull();
		});

		it("should handle trailing whitespace", () => {
			expect(getOpeningFenceInfo("```bash  ")).toEqual({ language: "bash" });
			expect(getOpeningFenceInfo("```  ")).toBeNull(); // language required
		});
	});

	describe("isClosingFence", () => {
		it("should detect closing backtick fences", () => {
			expect(isClosingFence("```")).toBe(true);
			expect(isClosingFence("````")).toBe(true);
		});

		it("should detect closing tilde fences", () => {
			expect(isClosingFence("~~~")).toBe(true);
			expect(isClosingFence("~~~~~")).toBe(true);
		});

		it("should handle trailing whitespace", () => {
			expect(isClosingFence("```  ")).toBe(true);
			expect(isClosingFence("~~~\t")).toBe(true);
		});

		it("should reject non-fence lines", () => {
			expect(isClosingFence("regular text")).toBe(false);
			expect(isClosingFence("```bash")).toBe(false); // This is an opening fence
			expect(isClosingFence("``")).toBe(false);
		});
	});

	describe("stripPromptPrefix", () => {
		it("should strip $ prefix", () => {
			expect(stripPromptPrefix("$ echo hello")).toBe("echo hello");
			expect(stripPromptPrefix("$  ls -la")).toBe("ls -la"); // strips all whitespace after $
		});

		it("should strip > prefix", () => {
			expect(stripPromptPrefix("> echo hello")).toBe("echo hello");
		});

		it("should not strip if no prefix", () => {
			expect(stripPromptPrefix("echo hello")).toBe("echo hello");
			expect(stripPromptPrefix("ls -la")).toBe("ls -la");
		});

		it("should only strip from beginning", () => {
			expect(stripPromptPrefix("echo $VAR")).toBe("echo $VAR");
		});
	});

	describe("findCodeBlockAtLine", () => {
		it("should find code block containing cursor", () => {
			const editor = createMockEditor([
				"# Header",
				"```bash",
				"echo hello",
				"echo world",
				"```",
				"More text",
			]);

			const block = findCodeBlockAtLine(editor, 2);

			expect(block).not.toBeNull();
			expect(block?.language).toBe("bash");
			expect(block?.startLine).toBe(1);
			expect(block?.endLine).toBe(4);
			expect(block?.content).toBe("echo hello\necho world");
		});

		it("should return null when cursor is outside code block", () => {
			const editor = createMockEditor([
				"# Header",
				"```bash",
				"echo hello",
				"```",
				"More text",
			]);

			expect(findCodeBlockAtLine(editor, 0)).toBeNull();
			expect(findCodeBlockAtLine(editor, 4)).toBeNull();
		});

		it("should return null when cursor is on fence line", () => {
			const editor = createMockEditor([
				"```bash",
				"echo hello",
				"```",
			]);

			expect(findCodeBlockAtLine(editor, 0)).toBeNull(); // Opening fence
			expect(findCodeBlockAtLine(editor, 2)).toBeNull(); // Closing fence
		});

		it("should handle multiple code blocks", () => {
			const editor = createMockEditor([
				"```bash",
				"echo first",
				"```",
				"text between",
				"```python",
				"print('second')",
				"```",
			]);

			const firstBlock = findCodeBlockAtLine(editor, 1);
			expect(firstBlock?.language).toBe("bash");

			const secondBlock = findCodeBlockAtLine(editor, 5);
			expect(secondBlock?.language).toBe("python");

			// Between blocks
			expect(findCodeBlockAtLine(editor, 3)).toBeNull();
		});

		it("should handle unclosed code blocks", () => {
			const editor = createMockEditor([
				"```bash",
				"echo unclosed",
			]);

			expect(findCodeBlockAtLine(editor, 1)).toBeNull();
		});

		it("should handle empty code blocks", () => {
			const editor = createMockEditor([
				"```bash",
				"```",
			]);

			// No lines between fences, so nowhere to be "inside"
			expect(findCodeBlockAtLine(editor, 0)).toBeNull();
			expect(findCodeBlockAtLine(editor, 1)).toBeNull();
		});

		it("should NOT detect code blocks without language (language required for execution)", () => {
			const editor = createMockEditor([
				"```",
				"some code",
				"```",
			]);

			// Code blocks without language are not detected (can't be executed)
			const block = findCodeBlockAtLine(editor, 1);
			expect(block).toBeNull();
		});
	});

	describe("getCodeBlockContext", () => {
		it("should return context when inside code block", () => {
			const editor = createMockEditor(
				[
					"```bash",
					"echo hello",
					"```",
				],
				1 // cursor on "echo hello"
			);

			const context = getCodeBlockContext(editor);

			expect(context.inCodeBlock).toBe(true);
			expect(context.codeBlock?.language).toBe("bash");
			expect(context.currentLine).toBe("echo hello");
			expect(context.currentLineNumber).toBe(1);
			expect(context.selectedText).toBeNull();
		});

		it("should return context when outside code block", () => {
			const editor = createMockEditor(
				[
					"regular text",
					"```bash",
					"echo hello",
					"```",
				],
				0 // cursor on "regular text"
			);

			const context = getCodeBlockContext(editor);

			expect(context.inCodeBlock).toBe(false);
			expect(context.codeBlock).toBeNull();
		});

		it("should include selection when present", () => {
			const editor = createMockEditor(
				[
					"```bash",
					"echo hello",
					"echo world",
					"```",
				],
				1,
				"echo hello\necho world" // selection
			);

			const context = getCodeBlockContext(editor);

			expect(context.selectedText).toBe("echo hello\necho world");
		});
	});

	describe("getTextToExecute", () => {
		it("should return selected text when selection exists", () => {
			const editor = createMockEditor(
				[
					"```bash",
					"echo hello",
					"echo world",
					"```",
				],
				1,
				"echo hello"
			);

			const result = getTextToExecute(editor);

			expect(result?.text).toBe("echo hello");
			expect(result?.isSelection).toBe(true);
		});

		it("should return current line when no selection", () => {
			const editor = createMockEditor(
				[
					"```bash",
					"echo hello",
					"```",
				],
				1
			);

			const result = getTextToExecute(editor);

			expect(result?.text).toBe("echo hello");
			expect(result?.isSelection).toBe(false);
		});

		it("should return null when outside code block", () => {
			const editor = createMockEditor(
				[
					"regular text",
					"```bash",
					"echo hello",
					"```",
				],
				0
			);

			expect(getTextToExecute(editor)).toBeNull();
		});

		it("should return null for empty lines", () => {
			const editor = createMockEditor(
				[
					"```bash",
					"",
					"echo hello",
					"```",
				],
				1 // cursor on empty line
			);

			expect(getTextToExecute(editor)).toBeNull();
		});

		it("should trim whitespace from current line", () => {
			const editor = createMockEditor(
				[
					"```bash",
					"  echo hello  ",
					"```",
				],
				1
			);

			const result = getTextToExecute(editor);

			expect(result?.text).toBe("echo hello");
		});
	});
});
