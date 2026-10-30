import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessClaims extends JwtPayload {
  sub: string;
  sid: string;
}

export const createAccessToken = (staffId: string, sessionId: string) =>
  jwt.sign({ sid: sessionId }, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    subject: staffId,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    jwtid: randomUUID(),
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

export const verifyAccessToken = (token: string): AccessClaims => {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  if (
    typeof payload === "string" ||
    !payload.sub ||
    typeof payload.sid !== "string" ||
    !payload.jti
  ) {
    throw new Error("Invalid access token claims.");
  }
  return payload as AccessClaims;
};

export const createRefreshToken = () => randomBytes(48).toString("base64url");

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const refreshExpiry = () => {
  const match = env.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([smhd])$/);
  if (!match)
    throw new Error("JWT_REFRESH_EXPIRES_IN must use a duration such as 7d.");
  const amount = Number(match[1]);
  const unit = match[2];
  const factor =
    unit === "s"
      ? 1000
      : unit === "m"
        ? 60_000
        : unit === "h"
          ? 3_600_000
          : 86_400_000;
  return new Date(Date.now() + amount * factor);
};

export const resetTokenExpiry = () => new Date(Date.now() + 30 * 60_000);
