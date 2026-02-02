/** Common session state for all terminal session types */
export type SessionState = "idle" | "alive" | "dead";

/** Supported interactive interpreter types */
export type InterpreterType = "python" | "javascript" | "typescript";

/**
 * Common interface for all terminal session types.
 * Implemented by shell sessions and interpreter REPL sessions.
 */
export interface ITerminalSession {
	readonly state: SessionState;
	readonly pid: number | undefined;
	readonly isAlive: boolean;
	spawn(): void;
	write(data: string): void;
	kill(): void;
}

/**
 * Extended interface for PTY-backed sessions that support resize.
 */
export interface IResizableSession extends ITerminalSession {
	resize(cols: number, rows: number): void;
}

/**
 * Extended interface for interpreter REPL sessions.
 * Each language implements this to provide language-specific behavior.
 */
export interface IInterpreterSession extends IResizableSession {
	readonly interpreterType: InterpreterType;
	/** Human-readable name for UI display (e.g. "Python", "Node.js") */
	readonly displayName: string;
	/** Wrap code for execution in this interpreter's REPL */
	wrapCode(code: string): string;
}
