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
	parseCodeBlockAttributes,
	parseFrontmatter,
	isShellLanguage,
	buildInterpreterCommand,
	collectCodeBlocks,
	getInterpreterType,
	SUPPORTED_LANGUAGES,
	SHELL_LANGUAGES,
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
		it("should accept supported shell languages", () => {
			expect(isLanguageSupported("bash")).toBe(true);
			expect(isLanguageSupported("sh")).toBe(true);
			expect(isLanguageSupported("zsh")).toBe(true);
			expect(isLanguageSupported("shell")).toBe(true);
		});

		it("should accept supported scripting languages", () => {
			expect(isLanguageSupported("python")).toBe(true);
			expect(isLanguageSupported("py")).toBe(true);
			expect(isLanguageSupported("javascript")).toBe(true);
			expect(isLanguageSupported("js")).toBe(true);
			expect(isLanguageSupported("typescript")).toBe(true);
			expect(isLanguageSupported("ts")).toBe(true);
		});

		it("should reject unsupported languages", () => {
			expect(isLanguageSupported("rust")).toBe(false);
			expect(isLanguageSupported("go")).toBe(false);
			expect(isLanguageSupported("")).toBe(false);
			expect(isLanguageSupported("java")).toBe(false);
		});

		it("should be case-insensitive", () => {
			expect(isLanguageSupported("BASH")).toBe(true);
			expect(isLanguageSupported("Python")).toBe(true);
			expect(isLanguageSupported("ZSH")).toBe(true);
			expect(isLanguageSupported("JavaScript")).toBe(true);
			expect(isLanguageSupported("TypeScript")).toBe(true);
		});

		it("should handle whitespace", () => {
			expect(isLanguageSupported("  bash  ")).toBe(true);
			expect(isLanguageSupported("\tbash\n")).toBe(true);
		});
	});

	describe("normalizeLanguage", () => {
		it("should normalize shell aliases to canonical names", () => {
			expect(normalizeLanguage("sh")).toBe("bash");
			expect(normalizeLanguage("shell")).toBe("bash");
			expect(normalizeLanguage("zsh")).toBe("bash");
			expect(normalizeLanguage("py")).toBe("python");
		});

		it("should normalize JS/TS aliases", () => {
			expect(normalizeLanguage("js")).toBe("javascript");
			expect(normalizeLanguage("ts")).toBe("typescript");
		});

		it("should keep canonical names as-is", () => {
			expect(normalizeLanguage("bash")).toBe("bash");
			expect(normalizeLanguage("python")).toBe("python");
			expect(normalizeLanguage("javascript")).toBe("javascript");
			expect(normalizeLanguage("typescript")).toBe("typescript");
		});

		it("should lowercase the result", () => {
			expect(normalizeLanguage("BASH")).toBe("bash");
			expect(normalizeLanguage("PYTHON")).toBe("python");
		});
	});

	describe("isShellLanguage", () => {
		it("should return true for shell languages", () => {
			expect(isShellLanguage("bash")).toBe(true);
			expect(isShellLanguage("sh")).toBe(true);
			expect(isShellLanguage("zsh")).toBe(true);
			expect(isShellLanguage("shell")).toBe(true);
		});

		it("should return false for non-shell languages", () => {
			expect(isShellLanguage("python")).toBe(false);
			expect(isShellLanguage("javascript")).toBe(false);
			expect(isShellLanguage("typescript")).toBe(false);
		});

		it("should be case-insensitive", () => {
			expect(isShellLanguage("BASH")).toBe(true);
			expect(isShellLanguage("Shell")).toBe(true);
		});
	});

	describe("getOpeningFenceInfo", () => {
		it("should detect backtick fences with language", () => {
			const result = getOpeningFenceInfo("```bash");
			expect(result).not.toBeNull();
			expect(result!.language).toBe("bash");
			expect(result!.attributes).toEqual({});
		});

		it("should detect fences with multiple languages", () => {
			expect(getOpeningFenceInfo("```python")!.language).toBe("python");
			expect(getOpeningFenceInfo("```javascript")!.language).toBe("javascript");
		});

		it("should NOT detect backtick fences without language (language required)", () => {
			expect(getOpeningFenceInfo("```")).toBeNull();
		});

		it("should detect tilde fences with language", () => {
			expect(getOpeningFenceInfo("~~~bash")!.language).toBe("bash");
			expect(getOpeningFenceInfo("~~~")).toBeNull(); // language required
		});

		it("should detect longer fences", () => {
			expect(getOpeningFenceInfo("````bash")!.language).toBe("bash");
			expect(getOpeningFenceInfo("~~~~~python")!.language).toBe("python");
		});

		it("should return null for non-fence lines", () => {
			expect(getOpeningFenceInfo("regular text")).toBeNull();
			expect(getOpeningFenceInfo("``not a fence")).toBeNull();
			expect(getOpeningFenceInfo("  ```indented")).toBeNull();
		});

		it("should handle trailing whitespace", () => {
			expect(getOpeningFenceInfo("```bash  ")!.language).toBe("bash");
			expect(getOpeningFenceInfo("```  ")).toBeNull(); // language required
		});

		// Phase 8: JSON attributes
		it("should parse JSON attributes after language", () => {
			const result = getOpeningFenceInfo('```sh {"name":"setup"}');
			expect(result).not.toBeNull();
			expect(result!.language).toBe("sh");
			expect(result!.attributes.name).toBe("setup");
		});

		it("should parse multiple JSON attributes", () => {
			const result = getOpeningFenceInfo('```bash {"name":"deploy","excludeFromRunAll":true,"cwd":"/tmp"}');
			expect(result).not.toBeNull();
			expect(result!.language).toBe("bash");
			expect(result!.attributes.name).toBe("deploy");
			expect(result!.attributes.excludeFromRunAll).toBe(true);
			expect(result!.attributes.cwd).toBe("/tmp");
		});

		it("should return empty attributes when no JSON present", () => {
			const result = getOpeningFenceInfo("```bash");
			expect(result!.attributes).toEqual({});
		});

		it("should ignore invalid JSON gracefully", () => {
			const result = getOpeningFenceInfo("```bash {invalid json}");
			expect(result).not.toBeNull();
			expect(result!.language).toBe("bash");
			expect(result!.attributes).toEqual({});
		});

		it("should ignore unknown attributes gracefully (forward-compatible)", () => {
			const result = getOpeningFenceInfo('```sh {"name":"test","unknownProp":"value"}');
			expect(result!.attributes.name).toBe("test");
			expect(result!.attributes["unknownProp"]).toBe("value");
		});
	});

	describe("parseCodeBlockAttributes", () => {
		it("should parse valid JSON attributes", () => {
			expect(parseCodeBlockAttributes('{"name":"setup"}')).toEqual({ name: "setup" });
			expect(parseCodeBlockAttributes('{"excludeFromRunAll": true}')).toEqual({ excludeFromRunAll: true });
			expect(parseCodeBlockAttributes('{"cwd": "/home/user"}')).toEqual({ cwd: "/home/user" });
		});

		it("should return empty object for empty string", () => {
			expect(parseCodeBlockAttributes("")).toEqual({});
			expect(parseCodeBlockAttributes("   ")).toEqual({});
		});

		it("should return empty object for invalid JSON", () => {
			expect(parseCodeBlockAttributes("{invalid}")).toEqual({});
			expect(parseCodeBlockAttributes("not json")).toEqual({});
		});

		it("should return empty object for non-object JSON", () => {
			expect(parseCodeBlockAttributes('"just a string"')).toEqual({});
			expect(parseCodeBlockAttributes("[1, 2, 3]")).toEqual({});
			expect(parseCodeBlockAttributes("42")).toEqual({});
		});

		it("should parse complex attributes", () => {
			const result = parseCodeBlockAttributes('{"name":"deploy","excludeFromRunAll":true,"cwd":"/tmp"}');
			expect(result.name).toBe("deploy");
			expect(result.excludeFromRunAll).toBe(true);
			expect(result.cwd).toBe("/tmp");
		});
	});

	describe("parseFrontmatter", () => {
		it("should parse shell from frontmatter", () => {
			const content = "---\nshell: /bin/zsh\n---\n# Hello";
			const config = parseFrontmatter(content);
			expect(config.shell).toBe("/bin/zsh");
		});

		it("should parse cwd from frontmatter", () => {
			const content = "---\ncwd: /home/user/project\n---\n# Hello";
			const config = parseFrontmatter(content);
			expect(config.cwd).toBe("/home/user/project");
		});

		it("should parse multiple frontmatter fields", () => {
			const content = "---\nshell: /bin/bash\ncwd: /tmp\n---\n# Hello";
			const config = parseFrontmatter(content);
			expect(config.shell).toBe("/bin/bash");
			expect(config.cwd).toBe("/tmp");
		});

		it("should return empty config when no frontmatter", () => {
			const config = parseFrontmatter("# Hello\nSome content");
			expect(config.shell).toBeUndefined();
			expect(config.cwd).toBeUndefined();
		});

		it("should handle quoted values", () => {
			const content = '---\nshell: "/bin/zsh"\ncwd: \'/tmp\'\n---\n# Hello';
			const config = parseFrontmatter(content);
			expect(config.shell).toBe("/bin/zsh");
			expect(config.cwd).toBe("/tmp");
		});

		it("should be case-insensitive for keys", () => {
			const content = "---\nShell: /bin/zsh\nCWD: /tmp\n---\n# Hello";
			const config = parseFrontmatter(content);
			expect(config.shell).toBe("/bin/zsh");
			expect(config.cwd).toBe("/tmp");
		});
	});

	describe("buildInterpreterCommand", () => {
		it("should build python3 command", () => {
			const cmd = buildInterpreterCommand("print('hello')", "python");
			expect(cmd).toBe("python3 -c 'print('\\''hello'\\'')'");
		});

		it("should build python3 command for py alias", () => {
			const cmd = buildInterpreterCommand("print('hello')", "py");
			expect(cmd).toBe("python3 -c 'print('\\''hello'\\'')'");
		});

		it("should build node command for javascript", () => {
			const cmd = buildInterpreterCommand("console.log('hello')", "javascript");
			expect(cmd).toBe("node -e 'console.log('\\''hello'\\'')'");
		});

		it("should build node command for js alias", () => {
			const cmd = buildInterpreterCommand("console.log('hello')", "js");
			expect(cmd).toBe("node -e 'console.log('\\''hello'\\'')'");
		});

		it("should build tsx command for typescript", () => {
			const cmd = buildInterpreterCommand("const x: number = 1", "typescript");
			expect(cmd).toBe("npx tsx -e 'const x: number = 1'");
		});

		it("should build tsx command for ts alias", () => {
			const cmd = buildInterpreterCommand("const x: number = 1", "ts");
			expect(cmd).toBe("npx tsx -e 'const x: number = 1'");
		});

		it("should return code as-is for shell languages", () => {
			expect(buildInterpreterCommand("echo hello", "bash")).toBe("echo hello");
			expect(buildInterpreterCommand("ls -la", "sh")).toBe("ls -la");
			expect(buildInterpreterCommand("pwd", "zsh")).toBe("pwd");
		});

		it("should handle code without single quotes", () => {
			const cmd = buildInterpreterCommand("console.log(42)", "javascript");
			expect(cmd).toBe("node -e 'console.log(42)'");
		});
	});

	describe("collectCodeBlocks", () => {
		it("should collect all code blocks from content", () => {
			const content = [
				"# My Runbook",
				"",
				"```bash",
				"echo hello",
				"```",
				"",
				"```python",
				"print('world')",
				"```",
			].join("\n");

			const blocks = collectCodeBlocks(content);
			expect(blocks).toHaveLength(2);
			expect(blocks[0].language).toBe("bash");
			expect(blocks[0].content).toBe("echo hello");
			expect(blocks[1].language).toBe("python");
			expect(blocks[1].content).toBe("print('world')");
		});

		it("should parse attributes from code blocks", () => {
			const content = [
				'```sh {"name":"setup","cwd":"/tmp"}',
				"echo setup",
				"```",
				"",
				'```bash {"excludeFromRunAll":true}',
				"echo excluded",
				"```",
			].join("\n");

			const blocks = collectCodeBlocks(content);
			expect(blocks).toHaveLength(2);
			expect(blocks[0].attributes.name).toBe("setup");
			expect(blocks[0].attributes.cwd).toBe("/tmp");
			expect(blocks[1].attributes.excludeFromRunAll).toBe(true);
		});

		it("should handle empty content", () => {
			expect(collectCodeBlocks("")).toHaveLength(0);
			expect(collectCodeBlocks("# Just a header")).toHaveLength(0);
		});

		it("should skip unclosed code blocks", () => {
			const content = [
				"```bash",
				"echo hello",
				"# No closing fence",
			].join("\n");

			expect(collectCodeBlocks(content)).toHaveLength(0);
		});

		it("should handle multi-line code blocks", () => {
			const content = [
				"```bash",
				"echo line1",
				"echo line2",
				"echo line3",
				"```",
			].join("\n");

			const blocks = collectCodeBlocks(content);
			expect(blocks).toHaveLength(1);
			expect(blocks[0].content).toBe("echo line1\necho line2\necho line3");
		});

		it("should collect code blocks with different languages", () => {
			const content = [
				"```javascript",
				"console.log('js')",
				"```",
				"",
				"```typescript",
				"const x: string = 'ts'",
				"```",
				"",
				"```rust",
				"fn main() {}",
				"```",
			].join("\n");

			const blocks = collectCodeBlocks(content);
			expect(blocks).toHaveLength(3);
			expect(blocks[0].language).toBe("javascript");
			expect(blocks[1].language).toBe("typescript");
			expect(blocks[2].language).toBe("rust"); // Collected even if not supported
		});

		it("should set correct line numbers", () => {
			const content = [
				"# Header",          // 0
				"",                   // 1
				"```bash",           // 2
				"echo hello",        // 3
				"```",               // 4
				"",                   // 5
				"```python",         // 6
				"print('world')",    // 7
				"```",               // 8
			].join("\n");

			const blocks = collectCodeBlocks(content);
			expect(blocks[0].startLine).toBe(2);
			expect(blocks[0].endLine).toBe(4);
			expect(blocks[1].startLine).toBe(6);
			expect(blocks[1].endLine).toBe(8);
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
			expect(block?.attributes).toEqual({});
		});

		it("should include attributes from annotated code blocks", () => {
			const editor = createMockEditor([
				'```bash {"name":"deploy","cwd":"/tmp"}',
				"echo deploy",
				"```",
			]);

			const block = findCodeBlockAtLine(editor, 1);
			expect(block).not.toBeNull();
			expect(block?.language).toBe("bash");
			expect(block?.attributes.name).toBe("deploy");
			expect(block?.attributes.cwd).toBe("/tmp");
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

	describe("getInterpreterType", () => {
		it("should return python for python/py", () => {
			expect(getInterpreterType("python")).toBe("python");
			expect(getInterpreterType("py")).toBe("python");
		});

		it("should return javascript for javascript/js", () => {
			expect(getInterpreterType("javascript")).toBe("javascript");
			expect(getInterpreterType("js")).toBe("javascript");
		});

		it("should return typescript for typescript/ts", () => {
			expect(getInterpreterType("typescript")).toBe("typescript");
			expect(getInterpreterType("ts")).toBe("typescript");
		});

		it("should return null for shell languages", () => {
			expect(getInterpreterType("bash")).toBeNull();
			expect(getInterpreterType("sh")).toBeNull();
			expect(getInterpreterType("zsh")).toBeNull();
			expect(getInterpreterType("shell")).toBeNull();
		});

		it("should return null for unknown languages", () => {
			expect(getInterpreterType("rust")).toBeNull();
			expect(getInterpreterType("go")).toBeNull();
		});

		it("should be case-insensitive", () => {
			expect(getInterpreterType("Python")).toBe("python");
			expect(getInterpreterType("JAVASCRIPT")).toBe("javascript");
		});
	});

	describe("interactive/interpreter attributes", () => {
		it("should parse interactive attribute", () => {
			const result = parseCodeBlockAttributes('{"interactive": false}');
			expect(result.interactive).toBe(false);
		});

		it("should parse interactive: true", () => {
			const result = parseCodeBlockAttributes('{"interactive": true}');
			expect(result.interactive).toBe(true);
		});

		it("should parse interpreter attribute", () => {
			const result = parseCodeBlockAttributes('{"interpreter": "python3.11"}');
			expect(result.interpreter).toBe("python3.11");
		});

		it("should parse both interactive and interpreter together", () => {
			const result = parseCodeBlockAttributes('{"interactive": false, "interpreter": "/usr/bin/python3"}');
			expect(result.interactive).toBe(false);
			expect(result.interpreter).toBe("/usr/bin/python3");
		});

		it("should parse from fence line with language", () => {
			const result = getOpeningFenceInfo('```python {"interactive": false, "interpreter": "python3.11"}');
			expect(result).not.toBeNull();
			expect(result!.language).toBe("python");
			expect(result!.attributes.interactive).toBe(false);
			expect(result!.attributes.interpreter).toBe("python3.11");
		});

		it("should default interactive to undefined (treated as true)", () => {
			const result = parseCodeBlockAttributes('{"name": "test"}');
			expect(result.interactive).toBeUndefined();
		});

		it("should parse interactive with other attributes", () => {
			const result = parseCodeBlockAttributes('{"name":"setup","cwd":"/tmp","interactive":false}');
			expect(result.name).toBe("setup");
			expect(result.cwd).toBe("/tmp");
			expect(result.interactive).toBe(false);
		});

		it("should collect blocks with interactive attribute", () => {
			const content = [
				'```python {"interactive": false}',
				"print('one-shot')",
				"```",
				"",
				"```python",
				"print('interactive')",
				"```",
			].join("\n");

			const blocks = collectCodeBlocks(content);
			expect(blocks).toHaveLength(2);
			expect(blocks[0].attributes.interactive).toBe(false);
			expect(blocks[1].attributes.interactive).toBeUndefined();
		});
	});
});
