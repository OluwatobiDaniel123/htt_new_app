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

export const uploadRegistrationProfileImage = async (
  image: { buffer: Buffer; mimeType: string; originalName: string },
) => {
  requireCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "htt-academy-private/registration-profiles";
  const publicId = randomUUID();
  const params = { folder, public_id: publicId, timestamp: String(timestamp), type: "authenticated" };
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.append(key, value);
  form.append("api_key", env.CLOUDINARY_API_KEY);
  form.append("signature", cloudinarySignature(params, env.CLOUDINARY_API_SECRET));
  form.append("file", new Blob([new Uint8Array(image.buffer)], { type: image.mimeType }), image.originalName);
  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: form });
  } catch {
    throw new AppError(503, "MEDIA_UNAVAILABLE", "Private image storage could not be reached.");
  }
  const result = await response.json() as { public_id?: string; secure_url?: string; bytes?: number; resource_type?: string; type?: string; error?: { message?: string } };
  if (!response.ok || !result.public_id || !result.secure_url || result.type !== "authenticated")
    throw new AppError(502, "MEDIA_UPLOAD_FAILED", "The profile picture could not be stored privately.");
  return {
    providerAssetId: result.public_id,
    secureUrl: result.secure_url,
    byteSize: Number(result.bytes ?? image.buffer.length),
  };
};

export const deleteRegistrationProfileImage = async (publicId: string) => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp: String(timestamp), type: "authenticated", invalidate: "true" };
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.append(key, value);
  form.append("api_key", env.CLOUDINARY_API_KEY);
  form.append("signature", cloudinarySignature(params, env.CLOUDINARY_API_SECRET));
  try {
    await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, { method: "POST", body: form });
  } catch {
    // The registration transaction has already failed; provider cleanup is best effort.
  }
};



export const signedRegistrationImageUrl = (
  secureUrl: string,
  publicId: string,
) => {
  requireCloudinary();

  const url = new URL(secureUrl);

  if (
    url.hostname !== "res.cloudinary.com" ||
    !url.pathname.includes("/image/authenticated/")
  ) {
    throw new AppError(
      404,
      "PROFILE_IMAGE_NOT_FOUND",
      "The profile image is unavailable.",
    );
  }

  const prefix = "/image/authenticated/";
  const suffix = url.pathname.split(prefix)[1];

  if (!suffix || !decodeURIComponent(suffix).includes(publicId)) {
    throw new AppError(
      404,
      "PROFILE_IMAGE_NOT_FOUND",
      "The profile image reference is invalid.",
    );
  }

  // Reuse an existing Cloudinary signature instead of adding another.
  if (/^s--[A-Za-z0-9_-]+--\//.test(suffix)) {
    return url.toString();
  }

  const signature = createHash("sha1")
    .update(`${suffix}${env.CLOUDINARY_API_SECRET}`)
    .digest("base64url")
    .slice(0, 8);

  url.pathname = url.pathname.replace(prefix, `${prefix}s--${signature}--/`);

  return url.toString();
};
