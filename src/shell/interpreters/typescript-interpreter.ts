import { BaseInterpreterSession, InterpreterSessionOptions } from "../interpreter-base";
import { InterpreterType } from "../types";

/**
 * TypeScript interactive interpreter session.
 * Spawns a persistent ts-node REPL in a PTY.
 *
 * Code is sent line by line, same as Node.js. ts-node's REPL is built on
 * Node's REPL infrastructure and handles multiline via brace/paren matching.
 */
export class TypeScriptInterpreterSession extends BaseInterpreterSession {
	constructor(options: InterpreterSessionOptions = {}) {
		super(options);
	}

	get interpreterType(): InterpreterType {
		return "typescript";
	}

	get displayName(): string {
		return "TypeScript";
	}

	protected getCommand(): { command: string; args: string[] } {
		return { command: "npx", args: ["ts-node"] };
	}

	/**
	 * Wrap code for ts-node REPL execution.
	 * Sends raw lines — the REPL handles multiline via brace/paren matching.
	 */
	wrapCode(code: string): string {
		const lines = code.split("\n");
		let result = "";
		for (const line of lines) {
			if (line.trim() === "") continue;
			result += line + "\n";
		}
		return result;
	}
}
