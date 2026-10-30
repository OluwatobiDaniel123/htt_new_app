import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(128, "Password must be no longer than 128 characters.")
  .refine(
    (value) => /[a-z]/.test(value),
    "Password must include a lowercase letter.",
  )
  .refine(
    (value) => /[A-Z]/.test(value),
    "Password must include an uppercase letter.",
  )
  .refine((value) => /\d/.test(value), "Password must include a number.")
  .refine(
    (value) => /[^A-Za-z0-9]/.test(value),
    "Password must include a symbol.",
  );

export const hashPassword = (password: string) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

export const verifyPassword = (hash: string, password: string) =>
  argon2.verify(hash, password);

let fallbackHash: Promise<string> | undefined;

export const getDummyPasswordHash = () => {
  fallbackHash ??= hashPassword(randomBytes(32).toString("base64url"));
  return fallbackHash;
};
