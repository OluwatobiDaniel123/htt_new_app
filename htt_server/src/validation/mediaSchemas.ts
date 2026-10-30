import { z } from "zod";

export const mediaSignatureBody = z.object({
  resourceType: z.enum(["image", "video"]),
  byteSize: z.number().int().positive().max(20 * 1024 * 1024),
  mimeType: z.string().max(120).refine((value) => value.startsWith("image/") || value.startsWith("video/")),
}).strict();

export const mediaAssetBody = z.object({
  publicId: z.string().min(1).max(255),
  secureUrl: z.string().url().max(2048),
  resourceType: z.enum(["image", "video"]),
  mimeType: z.string().max(120),
  byteSize: z.number().int().positive().max(20 * 1024 * 1024),
  originalName: z.string().min(1).max(255),
}).strict();

export const storyMediaBody = z.object({ mediaAssetId: z.string().uuid(), caption: z.string().max(1000).nullable().optional() }).strict();
