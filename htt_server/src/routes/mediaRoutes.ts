import { Router } from "express";
import { authenticate, requirePermission, uuidParam } from "../auth/middleware.js";
import * as media from "../controllers/mediaController.js";
import { validateBody } from "../validation/request.js";
import { mediaAssetBody, mediaSignatureBody, storyMediaBody } from "../validation/mediaSchemas.js";

export const mediaRoutes = Router();
mediaRoutes.use(authenticate);
mediaRoutes.post("/signature", requirePermission("content", "full"), validateBody(mediaSignatureBody), media.signature);
mediaRoutes.post("/assets", requirePermission("content", "full"), validateBody(mediaAssetBody), media.createAsset);
mediaRoutes.post("/stories/:id/media", uuidParam(), requirePermission("content", "full"), validateBody(storyMediaBody), media.attachStoryMedia);
