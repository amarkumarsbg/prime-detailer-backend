/**
 * Stable API error codes for clients.
 * Prefer throwing AppError from services/controllers; Zod still maps to VALIDATION.
 */
export const ApiErrorCode = {
  VALIDATION: "VALIDATION",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  INTERNAL: "INTERNAL",
} as const;

export type ApiErrorCodeName = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export class AppError extends Error {
  readonly status: number;
  readonly code: ApiErrorCodeName;
  readonly details?: unknown;

  constructor(
    message: string,
    opts: { status: number; code: ApiErrorCodeName; details?: unknown }
  ) {
    super(message);
    this.name = "AppError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }

  static validation(message: string, details?: unknown) {
    return new AppError(message, { status: 400, code: ApiErrorCode.VALIDATION, details });
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError(message, { status: 401, code: ApiErrorCode.UNAUTHORIZED });
  }

  static forbidden(message = "Forbidden") {
    return new AppError(message, { status: 403, code: ApiErrorCode.FORBIDDEN });
  }

  static notFound(message = "Not found") {
    return new AppError(message, { status: 404, code: ApiErrorCode.NOT_FOUND });
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(message, { status: 409, code: ApiErrorCode.CONFLICT, details });
  }
}
