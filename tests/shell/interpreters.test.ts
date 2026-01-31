import { describe, it, expect } from "vitest";
import { PythonInterpreterSession } from "../../src/shell/interpreters/python-interpreter";
import { NodeInterpreterSession } from "../../src/shell/interpreters/node-interpreter";
import { TypeScriptInterpreterSession } from "../../src/shell/interpreters/typescript-interpreter";
import { createInterpreterSession } from "../../src/shell/interpreters";

describe("PythonInterpreterSession", () => {
	const session = new PythonInterpreterSession();

	describe("properties", () => {
		it("should have correct interpreterType", () => {
			expect(session.interpreterType).toBe("python");
		});

		it("should have correct displayName", () => {
			expect(session.displayName).toBe("Python");
		});
	});

	describe("wrapCode", () => {
		it("should send single-line code with newline", () => {
			const result = session.wrapCode("print('hello')");
			expect(result).toBe("print('hello')\n");
		});

		it("should send multiple simple statements as raw lines", () => {
			const result = session.wrapCode("x = 42\nprint(x)");
			expect(result).toBe("x = 42\nprint(x)\n");
		});

		it("should NOT wrap code in exec()", () => {
			const result = session.wrapCode("x = 42\nprint(x)");
			expect(result).not.toContain("exec(");
		});

		it("should add blank line after indented block followed by non-indented code", () => {
			const code = "for i in range(3):\n    print(i)\nprint('done')";
			const result = session.wrapCode(code);
			expect(result).toBe("for i in range(3):\n    print(i)\n\nprint('done')\n");
		});

		it("should add blank line at end when last line is indented", () => {
			const code = "for i in range(3):\n    print(i)";
			const result = session.wrapCode(code);
			expect(result).toBe("for i in range(3):\n    print(i)\n\n");
		});

		it("should handle nested indentation", () => {
			const code = "for i in range(3):\n    for j in range(2):\n        print(i, j)";
			const result = session.wrapCode(code);
			expect(result).toBe("for i in range(3):\n    for j in range(2):\n        print(i, j)\n\n");
		});

		it("should handle multiple compound statements with code between", () => {
			const code = "def add(a, b):\n    return a + b\nresult = add(1, 2)\nfor i in range(result):\n    print(i)";
			const result = session.wrapCode(code);
			expect(result).toBe(
				"def add(a, b):\n    return a + b\n\nresult = add(1, 2)\nfor i in range(result):\n    print(i)\n\n"
			);
		});

		it("should skip blank lines in source code", () => {
			const code = "x = 1\n\ny = 2\n\nprint(x + y)";
			const result = session.wrapCode(code);
			expect(result).toBe("x = 1\ny = 2\nprint(x + y)\n");
		});

		it("should handle class definitions", () => {
			const code = "class Foo:\n    def bar(self):\n        return 42\nf = Foo()";
			const result = session.wrapCode(code);
			expect(result).toBe("class Foo:\n    def bar(self):\n        return 42\n\nf = Foo()\n");
		});

		it("should handle if/elif/else blocks", () => {
			const code = "x = 5\nif x > 3:\n    print('big')\nelse:\n    print('small')\nprint('done')";
			const result = session.wrapCode(code);
			// After "print('big')", there's a transition from indented to non-indented (else:)
			// After "print('small')", there's a transition from indented to non-indented (print('done'))
			expect(result).toBe("x = 5\nif x > 3:\n    print('big')\n\nelse:\n    print('small')\n\nprint('done')\n");
		});

		it("should handle try/except blocks", () => {
			const code = "try:\n    result = 1/0\nexcept ZeroDivisionError:\n    print('error')";
			const result = session.wrapCode(code);
			expect(result).toBe("try:\n    result = 1/0\n\nexcept ZeroDivisionError:\n    print('error')\n\n");
		});

		it("should preserve backslashes in code", () => {
			const result = session.wrapCode("print('a\\nb')");
			expect(result).toContain("print('a\\nb')");
		});

		it("should preserve triple quotes in code", () => {
			const result = session.wrapCode('x = """hello"""');
			expect(result).toContain('"""hello"""');
		});
	});
});

describe("NodeInterpreterSession", () => {
	const session = new NodeInterpreterSession();

	describe("properties", () => {
		it("should have correct interpreterType", () => {
			expect(session.interpreterType).toBe("javascript");
		});

		it("should have correct displayName", () => {
			expect(session.displayName).toBe("Node.js");
		});
	});

	describe("wrapCode", () => {
		it("should send raw lines", () => {
			const result = session.wrapCode("const x = 42;\nconsole.log(x);");
			expect(result).toBe("const x = 42;\nconsole.log(x);\n");
		});

		it("should not use .editor mode", () => {
			const result = session.wrapCode("console.log('hi')");
			expect(result).not.toContain(".editor");
			expect(result).not.toContain("\x04");
		});

		it("should skip blank lines", () => {
			const result = session.wrapCode("const x = 1;\n\nconst y = 2;");
			expect(result).toBe("const x = 1;\nconst y = 2;\n");
		});

		it("should handle multiline with braces", () => {
			const code = "items.forEach((item, i) => {\n    console.log(item);\n});";
			const result = session.wrapCode(code);
			expect(result).toBe("items.forEach((item, i) => {\n    console.log(item);\n});\n");
		});
	});
});

describe("TypeScriptInterpreterSession", () => {
	const session = new TypeScriptInterpreterSession();

	describe("properties", () => {
		it("should have correct interpreterType", () => {
			expect(session.interpreterType).toBe("typescript");
		});

		it("should have correct displayName", () => {
			expect(session.displayName).toBe("TypeScript");
		});
	});

	describe("wrapCode", () => {
		it("should send raw lines", () => {
			const result = session.wrapCode("const x: number = 42;");
			expect(result).toBe("const x: number = 42;\n");
		});

		it("should not use .editor mode", () => {
			const result = session.wrapCode("let y: string = 'hi'");
			expect(result).not.toContain(".editor");
			expect(result).not.toContain("\x04");
		});
	});
});

describe("createInterpreterSession", () => {
	it("should create PythonInterpreterSession for python", () => {
		const session = createInterpreterSession("python");
		expect(session.interpreterType).toBe("python");
		expect(session.displayName).toBe("Python");
	});

	it("should create NodeInterpreterSession for javascript", () => {
		const session = createInterpreterSession("javascript");
		expect(session.interpreterType).toBe("javascript");
		expect(session.displayName).toBe("Node.js");
	});

	it("should create TypeScriptInterpreterSession for typescript", () => {
		const session = createInterpreterSession("typescript");
		expect(session.interpreterType).toBe("typescript");
		expect(session.displayName).toBe("TypeScript");
	});

	it("should pass options to the session", () => {
		const session = createInterpreterSession("python", {
			cwd: "/tmp",
			cols: 80,
			rows: 24,
		});
		expect(session.interpreterType).toBe("python");
		// Options are stored internally, just verify no error on creation
	});
});
