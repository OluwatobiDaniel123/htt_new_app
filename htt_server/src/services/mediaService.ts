import { createHash, randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

const requireCloudinary = () => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)
    throw new AppError(503, "MEDIA_NOT_CONFIGURED", "Private media storage is not configured.");
};

export const cloudinarySignature = (params: Record<string, string>, secret: string) => {
  const canonical = Object.entries(params).filter(([, value]) => value !== "").sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
  return createHash("sha1").update(`${canonical}${secret}`).digest("hex");
};

export const createUploadSignature = (staffId: string, resourceType: "image" | "video") => {
  requireCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `htt-academy-private/staff-${staffId}`;
  const publicId = randomUUID();
  const params = { folder, public_id: publicId, timestamp: String(timestamp), type: "authenticated" };
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    resourceType,
    timestamp,
    folder,
    publicId,
    type: "authenticated",
    signature: cloudinarySignature(params, env.CLOUDINARY_API_SECRET),
  };
};

export const verifyAssetOwnership = (staffId: string, publicId: string, secureUrl: string) => {
  requireCloudinary();
  const prefix = `htt-academy-private/staff-${staffId}/`;
  let host = "";
  try { host = new URL(secureUrl).hostname; } catch { /* invalid URL */ }
  if (!publicId.startsWith(prefix) || host !== "res.cloudinary.com")
    throw new AppError(400, "INVALID_MEDIA_ASSET", "The uploaded media reference is invalid.");
};
