import { BaseInterpreterSession, InterpreterSessionOptions } from "../interpreter-base";
import { InterpreterType } from "../types";

/**
 * Node.js interactive interpreter session.
 * Spawns a persistent node REPL in a PTY.
 *
 * Code is sent line by line. Node's REPL automatically detects incomplete
 * statements (open braces, parens, brackets) and waits for completion.
 */
export class NodeInterpreterSession extends BaseInterpreterSession {
	constructor(options: InterpreterSessionOptions = {}) {
		super(options);
	}

	get interpreterType(): InterpreterType {
		return "javascript";
	}

	get displayName(): string {
		return "Node.js";
	}

	protected getCommand(): { command: string; args: string[] } {
		return { command: "node", args: [] };
	}

	/**
	 * Wrap code for Node REPL execution.
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
