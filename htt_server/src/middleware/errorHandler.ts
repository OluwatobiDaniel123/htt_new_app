import type { ErrorRequestHandler } from "express";
import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError,
} from "sequelize";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  const known = error instanceof AppError;
  const message = known ? error.message : "An unexpected error occurred.";
  const conflict =
    error instanceof UniqueConstraintError ||
    error instanceof ForeignKeyConstraintError;
  const invalid = error instanceof ValidationError;
  const status = known
    ? error.statusCode
    : conflict
      ? 409
      : invalid
        ? 400
        : 500;
  if (!known && env.NODE_ENV !== "test")
    console.error("Unhandled request error");
  res.status(status).json({
    success: false,
    error: {
      code: known
        ? error.code
        : conflict
          ? "RESOURCE_CONFLICT"
          : invalid
            ? "VALIDATION_ERROR"
            : "INTERNAL_SERVER_ERROR",
      message: known
        ? message
        : conflict
          ? "The operation conflicts with existing records."
          : invalid
            ? "The request does not meet a data constraint."
            : "An unexpected error occurred.",
      ...(known && error.details ? { details: error.details } : {}),
    },
  });
};
