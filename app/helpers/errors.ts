export type AiErrorCode = "RESPONSE_NOT_JSON" | "SCHEMA_VALIDATION_FAILED";

export class AiError extends Error {
  code: AiErrorCode;
  payload?: unknown;
  constructor(code: AiErrorCode, payload?: unknown) {
    super(code);
    this.name = "AiError";
    this.code = code;
    this.payload = payload;
  }
}
