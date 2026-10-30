import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export const originGuard: RequestHandler = (req, _res, next) => {
  if (safeMethods.has(req.method) || req.path === '/api/v1/payments/webhook/paystack') return next();
  const origin = req.get('origin');
  if (origin && ![...env.FRONTEND_URL, ...env.PUBLIC_SITE_URL].includes(origin)) {
    return next(new AppError(403, 'UNTRUSTED_ORIGIN', 'This request origin is not allowed.'));
  }
  if (env.AUTH_COOKIE_SAME_SITE === 'none' && !origin) {
    return next(new AppError(403, 'ORIGIN_REQUIRED', 'An allowed request origin is required for cross-site cookie authentication.'));
  }
  return next();
};
