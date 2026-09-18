export type SynthesisFailureCode =
  | "TIMEOUT"
  | "CONTEXT_LIMIT"
  | "OUTPUT_LIMIT"
  | "TURN_LIMIT"
  | "TOOL_LIMIT"
  | "PROVIDER_ERROR"
  | "INVALID_PROPOSAL"
  | "NO_SUBMISSION"
  | "ABORTED";
export class SynthesisError extends Error {
  constructor(
    public readonly code: SynthesisFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "SynthesisError";
  }
}
