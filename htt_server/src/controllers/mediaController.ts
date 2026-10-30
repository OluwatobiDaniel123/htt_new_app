/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestHandler } from "express";
import { models } from "../models/index.js";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { writeAudit } from "../services/auditService.js";
import { createUploadSignature, verifyAssetOwnership } from "../services/mediaService.js";

const staffId = (req: any) => req.auth!.staffId as string;

export const signature: RequestHandler = asyncHandler(async (req, res) => {
  const data = createUploadSignature(staffId(req), req.body.resourceType);
  res.json({ success: true, data });
});

export const createAsset: RequestHandler = asyncHandler(async (req, res) => {
  const userId = staffId(req);
  verifyAssetOwnership(userId, req.body.publicId, req.body.secureUrl);
  const existing = await models.MediaAsset.findOne({ where: { providerAssetId: req.body.publicId } }) as any;
  if (existing) {
    if (existing.ownerId !== userId) throw new AppError(409, "MEDIA_ALREADY_CLAIMED", "This uploaded asset is already registered.");
    res.status(200).json({ success: true, data: existing });
    return;
  }
  const asset = await models.MediaAsset.create({
    ownerId: userId,
    storageProvider: "cloudinary",
    providerAssetId: req.body.publicId,
    secureUrl: req.body.secureUrl,
    resourceType: req.body.resourceType,
    mimeType: req.body.mimeType,
    byteSize: req.body.byteSize,
    originalName: req.body.originalName,
    access: "private",
  }) as any;
  await writeAudit({ actorId: userId, action: "media.uploaded", entityName: "MediaAsset", recordId: asset.id, ipAddress: req.ip, userAgent: req.get("user-agent") });
  res.status(201).json({ success: true, data: asset });
});

export const attachStoryMedia: RequestHandler = asyncHandler(async (req, res) => {
  const story = await models.Story.findByPk(req.params.id as string) as any;
  if (!story) throw new AppError(404, "NOT_FOUND", "Story was not found.");
  const asset = await models.MediaAsset.findByPk(req.body.mediaAssetId) as any;
  if (!asset || (asset.ownerId !== staffId(req) && req.auth?.permissions["content"] !== "full")) throw new AppError(404, "NOT_FOUND", "Media asset was not found.");
  const [link, created] = await models.StoryMedia.findOrCreate({
    where: { storyId: story.id, mediaAssetId: asset.id },
    defaults: { storyId: story.id, mediaAssetId: asset.id, sortOrder: 0, caption: req.body.caption || null },
  });
  await writeAudit({ actorId: staffId(req), action: created ? "story.media_attached" : "story.media_already_attached", entityName: "Story", recordId: story.id, ipAddress: req.ip, userAgent: req.get("user-agent") });
  res.status(created ? 201 : 200).json({ success: true, data: link });
});
