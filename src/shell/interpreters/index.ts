export { PythonInterpreterSession } from "./python-interpreter";
export { NodeInterpreterSession } from "./node-interpreter";
export { TypeScriptInterpreterSession } from "./typescript-interpreter";

import { InterpreterType } from "../types";
import { BaseInterpreterSession, InterpreterSessionOptions } from "../interpreter-base";
import { PythonInterpreterSession } from "./python-interpreter";
import { NodeInterpreterSession } from "./node-interpreter";
import { TypeScriptInterpreterSession } from "./typescript-interpreter";

/**
 * Factory function to create an interpreter session for a given language type.
 * Returns a concrete interpreter session with language-specific behavior.
 */
export function createInterpreterSession(
	type: InterpreterType,
	options: InterpreterSessionOptions = {},
): BaseInterpreterSession {
	switch (type) {
		case "python":
			return new PythonInterpreterSession(options);
		case "javascript":
			return new NodeInterpreterSession(options);
		case "typescript":
			return new TypeScriptInterpreterSession(options);
	}
}
