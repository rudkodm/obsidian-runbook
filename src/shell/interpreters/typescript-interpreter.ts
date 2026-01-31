import { BaseInterpreterSession, InterpreterSessionOptions } from "../interpreter-base";
import { InterpreterType } from "../types";

/**
 * TypeScript interactive interpreter session.
 * Spawns a persistent ts-node REPL in a PTY.
 *
 * Unlike Node's REPL, ts-node buffers all input and never evaluates individual
 * lines — it keeps showing `...` continuations. The `.editor` mode is required
 * to delimit code blocks: paste code, then Ctrl-D to compile and execute.
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
	 * Uses .editor mode: paste code, then Ctrl-D (EOT) to compile and execute.
	 * Required because ts-node's REPL buffers all line-by-line input without
	 * evaluating, unlike Node's REPL which evaluates complete statements.
	 */
	wrapCode(code: string): string {
		return `.editor\n${code}\n\x04`;
	}
}
