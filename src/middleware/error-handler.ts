import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, ApiErrorCode } from "../lib/app-error.js";
import { AppHttpError } from "../lib/app-http-error.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppHttpError) {
    res.status(err.status).json({
      data: null,
      error: {
        message: err.message,
        code: err.code,
        ...(err.details ?? {}),
      },
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      data: null,
      error: {
        message: "Validation failed",
        code: ApiErrorCode.VALIDATION,
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      data: null,
      error: {
        message: err.message,
        code: err.code,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  const tooLarge =
    err &&
    typeof err === "object" &&
    "type" in err &&
    (err as { type?: string }).type === "entity.too.large";
  if (tooLarge) {
    res.status(413).json({
      data: null,
      error: {
        message:
          "Invoice PDF is too large for the server. Retry after refreshing, or use Print and email the PDF manually.",
        code: ApiErrorCode.PAYLOAD_TOO_LARGE,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  if (message === "Not found") {
    res.status(404).json({
      data: null,
      error: { message, code: ApiErrorCode.NOT_FOUND },
    });
    return;
  }

  res.status(500).json({
    data: null,
    error: { message, code: ApiErrorCode.INTERNAL },
  });
}
