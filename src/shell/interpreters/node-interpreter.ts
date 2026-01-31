import { BaseInterpreterSession, InterpreterSessionOptions } from "../interpreter-base";
import { InterpreterType } from "../types";

/**
 * Node.js interactive interpreter session.
 * Spawns a persistent node REPL in a PTY.
 *
 * Code wrapping uses Node's .editor mode which accepts multiline input
 * terminated by Ctrl-D (EOT character).
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
	 * Uses .editor mode: paste code, then Ctrl-D to execute.
	 */
	wrapCode(code: string): string {
		return `.editor\n${code}\n\x04`;
	}
}
