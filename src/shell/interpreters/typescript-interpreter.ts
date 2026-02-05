import { BaseInterpreterSession, InterpreterSessionOptions } from "../interpreter-base";
import { InterpreterType } from "../types";

/**
 * TypeScript interactive interpreter session.
 * Spawns a persistent ts-node REPL in a PTY.
 *
 * With --transpileOnly and safe compiler options, ts-node's REPL works
 * line-by-line like Node's — it evaluates complete statements and uses
 * brace/paren matching for multiline detection.
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
		// Try ts-node directly first (if installed globally)
		// If not found, the shell will handle it through PATH
		return { command: "ts-node", args: [] };
	}

	// Uses default wrapCode implementation from base class
}
