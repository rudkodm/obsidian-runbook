import { BaseInterpreterSession, InterpreterSessionOptions } from "../interpreter-base";
import { InterpreterType } from "../types";

/**
 * Python interactive interpreter session.
 * Spawns a persistent python3 REPL in a PTY.
 *
 * Code wrapping sends raw lines to the REPL with smart blank line insertion
 * after indented blocks. Python's REPL requires a blank line to terminate
 * compound statements (def, if, for, while, class, with, try, etc.).
 */
export class PythonInterpreterSession extends BaseInterpreterSession {
	constructor(options: InterpreterSessionOptions = {}) {
		super(options);
	}

	get interpreterType(): InterpreterType {
		return "python";
	}

	get displayName(): string {
		return "Python";
	}

	protected getCommand(): { command: string; args: string[] } {
		return { command: "python3", args: [] };
	}

	/**
	 * Wrap code for Python REPL execution.
	 * Sends raw lines with smart blank line insertion after indented blocks.
	 *
	 * Python's REPL requires a blank line after compound statements to execute them.
	 * This method detects transitions from indented to non-indented lines and inserts
	 * the necessary blank lines automatically.
	 *
	 * Example:
	 *   "for i in range(3):\n    print(i)\nprint('done')"
	 *   becomes: "for i in range(3):\n    print(i)\n\nprint('done')\n"
	 */
	wrapCode(code: string): string {
		const lines = code.split("\n");
		let result = "";
		let wasIndented = false;

		for (const line of lines) {
			// Skip completely blank lines within the code
			if (line.trim() === "") {
				continue;
			}

			const isIndented = /^\s/.test(line);

			if (!isIndented && wasIndented) {
				// Transition from indented to non-indented: insert blank line
				// to terminate the compound statement in the REPL
				result += "\n";
			}

			result += line + "\n";
			wasIndented = isIndented;
		}

		// If the last line was indented, add blank line to terminate the block
		if (wasIndented) {
			result += "\n";
		}

		return result;
	}
}
