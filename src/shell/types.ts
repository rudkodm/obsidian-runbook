// ============================================================================
// Session States
// ============================================================================

/** Common session state for all terminal session types */
export type SessionState = "idle" | "alive" | "dead";

/** Discriminated union for session state with metadata */
export type SessionStateData =
	| { state: "idle" }
	| { state: "alive"; pid: number; startTime: number }
	| { state: "dead"; exitCode: number | null; endTime: number };

// ============================================================================
// Interpreter Types
// ============================================================================

/** Supported interactive interpreter types */
export type InterpreterType = "python" | "javascript" | "typescript";

/** Language information for syntax highlighting and execution */
export interface LanguageInfo {
	readonly name: string;
	readonly aliases: readonly string[];
	readonly interpreterType?: InterpreterType;
	readonly fileExtensions: readonly string[];
}

// ============================================================================
// Session Interfaces
// ============================================================================

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

// ============================================================================
// Event Types
// ============================================================================

/** Session event types for EventEmitter */
export interface SessionEvents {
	data: (data: string) => void;
	output: (data: string) => void;
	error: (error: Error) => void;
	exit: (code: number | null) => void;
	stateChange: (state: SessionState) => void;
}

// ============================================================================
// Result Types (for functional error handling)
// ============================================================================

/** Success result */
export interface Success<T> {
	readonly success: true;
	readonly value: T;
}

/** Failure result */
export interface Failure {
	readonly success: false;
	readonly error: string;
	readonly code?: string;
}

/** Result type for operations that can fail */
export type Result<T> = Success<T> | Failure;

/** Helper to create success result */
export const success = <T>(value: T): Success<T> => ({
	success: true,
	value,
});

/** Helper to create failure result */
export const failure = (error: string, code?: string): Failure => ({
	success: false,
	error,
	code,
});

/** Check if result is success */
export const isSuccess = <T>(result: Result<T>): result is Success<T> =>
	result.success;

/** Check if result is failure */
export const isFailure = <T>(result: Result<T>): result is Failure =>
	!result.success;

// ============================================================================
// Configuration Types
// ============================================================================

/** Common session options */
export interface SessionOptions {
	readonly cwd?: string;
	readonly env?: Readonly<Record<string, string>>;
}

/** PTY session options */
export interface PtyOptions extends SessionOptions {
	readonly cols?: number;
	readonly rows?: number;
	readonly pythonPath?: string;
}

/** Shell session options */
export interface ShellOptions extends SessionOptions {
	readonly shell?: string;
}

/** Interpreter session options */
export interface InterpreterOptions extends PtyOptions {
	/** Override the default interpreter command */
	readonly interpreterPath?: string;
}

// ============================================================================
// Terminal Size
// ============================================================================

/** Terminal dimensions */
export interface TerminalSize {
	readonly cols: number;
	readonly rows: number;
}

/** Helper to create terminal size */
export const terminalSize = (cols: number, rows: number): TerminalSize => ({
	cols,
	rows,
});

// ============================================================================
// Type Guards
// ============================================================================

/** Check if a value is an interpreter type */
export const isInterpreterType = (value: unknown): value is InterpreterType =>
	typeof value === "string" &&
	["python", "javascript", "typescript"].includes(value);

/** Check if a session is resizable */
export const isResizableSession = (
	session: ITerminalSession
): session is IResizableSession =>
	"resize" in session && typeof session.resize === "function";

/** Check if a session is an interpreter session */
export const isInterpreterSession = (
	session: ITerminalSession
): session is IInterpreterSession =>
	"interpreterType" in session && "wrapCode" in session;
