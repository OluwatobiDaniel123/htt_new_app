import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

export const ACCESS_COOKIE = "htt_access";
export const REFRESH_COOKIE = "htt_refresh";

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production" || env.AUTH_COOKIE_SAME_SITE === "none",
  sameSite: env.AUTH_COOKIE_SAME_SITE,
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions,
    path: "/api/v1",
    maxAge: 15 * 60_000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions,
    path: "/api/v1/auth",
    maxAge: refreshExpiryMs(),
  });
};

const refreshExpiryMs = () => {
  const match = env.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 86_400_000;
  const factor =
    match[2] === "s"
      ? 1000
      : match[2] === "m"
        ? 60_000
        : match[2] === "h"
          ? 3_600_000
          : 86_400_000;
  return Number(match[1]) * factor;
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions, path: "/api/v1" });
  res.clearCookie(REFRESH_COOKIE, {
    ...baseCookieOptions,
    path: "/api/v1/auth",
  });
};

export const readRefreshCookie = (
  cookies: Record<string, string | undefined> | undefined,
) => cookies?.[REFRESH_COOKIE];
