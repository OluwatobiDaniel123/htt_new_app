import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/AppError.js";

export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "Request body is invalid.",
          result.error.flatten(),
        ),
      );
      return;
    }
    req.body = result.data;
    req.validatedBody = result.data;
    next();
  };

export const validateParams =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "Request parameters are invalid.",
          result.error.flatten(),
        ),
      );
      return;
    }
    req.params = result.data;
    next();
  };

export const validateQuery =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "Query parameters are invalid.",
          result.error.flatten(),
        ),
      );
      return;
    }
    req.validatedQuery = result.data as Record<string, unknown>;
    next();
  };
