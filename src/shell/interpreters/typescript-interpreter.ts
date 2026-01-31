import { BaseInterpreterSession, InterpreterSessionOptions } from "../interpreter-base";
import { InterpreterType } from "../types";

/**
 * TypeScript interactive interpreter session.
 * Spawns a persistent ts-node REPL in a PTY.
 *
 * Code wrapping uses the same .editor mode as Node.js since ts-node's REPL
 * is built on top of Node's REPL infrastructure.
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
	 * Uses .editor mode: paste code, then Ctrl-D to execute.
	 */
	wrapCode(code: string): string {
		return `.editor\n${code}\n\x04`;
	}
}
