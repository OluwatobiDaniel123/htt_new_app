import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;

export interface RegistrationImage {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  originalName: string;
}

const detectImageType = (buffer: Buffer): RegistrationImage["mimeType"] | null => {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
};

export const parsePublicRegistrationMultipart = (body: Buffer, boundary: string) => {
  const marker = Buffer.from(`--${boundary}`);
  const separator = Buffer.from("\r\n\r\n");
  const fields = new Map<string, Buffer>();
  let file: RegistrationImage | undefined;
  let cursor = body.indexOf(marker);
  while (cursor >= 0) {
    cursor += marker.length;
    if (body.subarray(cursor, cursor + 2).toString() === "--") break;
    if (body.subarray(cursor, cursor + 2).toString() === "\r\n") cursor += 2;
    const headerEnd = body.indexOf(separator, cursor);
    if (headerEnd < 0) throw new AppError(400, "INVALID_MULTIPART", "Multipart section headers are incomplete.");
    const headers = body.subarray(cursor, headerEnd).toString("latin1");
    const disposition = headers.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] ?? "";
    const fieldName = disposition.match(/(?:^|;)\s*name="([^"\r\n]+)"/i)?.[1];
    const filename = disposition.match(/(?:^|;)\s*filename="([^"\r\n]*)"/i)?.[1];
    if (!fieldName) throw new AppError(400, "INVALID_MULTIPART", "Multipart field name is missing.");
    const contentStart = headerEnd + separator.length;
    const next = body.indexOf(Buffer.concat([Buffer.from("\r\n"), marker]), contentStart);
    if (next < 0) throw new AppError(400, "INVALID_MULTIPART", "Multipart section is not terminated.");
    const content = body.subarray(contentStart, next);
    if (filename !== undefined) {
      if (fieldName !== "file" || file) throw new AppError(400, "INVALID_MULTIPART", "Exactly one profile picture field named file is allowed.");
      if (!content.length || content.length > MAX_FILE_BYTES) throw new AppError(413, "FILE_SIZE_INVALID", "The profile picture must be between 1 byte and 5 MB.");
      const mimeType = detectImageType(content);
      if (!mimeType) throw new AppError(400, "INVALID_IMAGE", "The uploaded file must be a valid JPEG, PNG or WebP image.");
      file = { buffer: content, mimeType, originalName: filename.replace(/[\\/\0]/g, "_").slice(0, 255) || "profile-picture" };
    } else {
      if (fields.has(fieldName)) throw new AppError(400, "DUPLICATE_MULTIPART_FIELD", `Multipart field ${fieldName} must appear only once.`);
      fields.set(fieldName, content);
    }
    cursor = next + 2;
  }
  if (!file) throw new AppError(400, "PROFILE_IMAGE_REQUIRED", "A profile picture is required in the file field.");
  const registrationPart = fields.get("registration");
  if (!registrationPart) throw new AppError(400, "REGISTRATION_REQUIRED", "A registration JSON field is required.");
  let registration: unknown;
  try { registration = JSON.parse(registrationPart.toString("utf8")); }
  catch { throw new AppError(400, "INVALID_REGISTRATION_JSON", "The registration field must contain valid JSON."); }
  if (fields.size !== 1) throw new AppError(400, "INVALID_MULTIPART_FIELD", "Only registration and file fields are accepted.");
  return { registration, file };
};

export const publicRegistrationUpload: RequestHandler = async (req, _res, next) => {
  if (!req.is("multipart/form-data")) return next();
  const contentType = req.header("content-type") ?? "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.[1] ?? contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.[2];
  if (!boundary || boundary.length > 200) throw new AppError(400, "INVALID_MULTIPART", "A valid multipart boundary is required.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > MAX_REQUEST_BYTES) throw new AppError(413, "REQUEST_TOO_LARGE", "The multipart registration request exceeds the allowed size.");
    chunks.push(part);
  }
  const { registration, file } = parsePublicRegistrationMultipart(Buffer.concat(chunks), boundary);
  req.body = { action: "submit_registration", registration };
  req.registrationImage = file;
  next();
};
