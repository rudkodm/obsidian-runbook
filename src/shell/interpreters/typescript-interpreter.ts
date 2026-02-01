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
		super({
			...options,
			env: {
				...options.env,
				// TS_NODE_SKIP_PROJECT: ignore the project's tsconfig.json which
				// may have incompatible settings (e.g. module: "NodeNext" without
				// matching moduleResolution), crashing ts-node on startup.
				TS_NODE_SKIP_PROJECT: "true",
				// TS_NODE_TRANSPILE_ONLY: skip type-checker setup which generates
				// broken `declare import` statements for newer Node.js built-ins
				// (node:sea, node:sqlite, node:test).
				TS_NODE_TRANSPILE_ONLY: "true",
				// TS_NODE_COMPILER_OPTIONS: force safe compiler settings so the
				// REPL works even if TS_NODE_SKIP_PROJECT is ignored. Overrides
				// any conflicting tsconfig.json settings picked up from cwd.
				TS_NODE_COMPILER_OPTIONS: JSON.stringify({
					module: "commonjs",
					moduleResolution: "node",
				}),
			},
		});
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
