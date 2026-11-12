import test from "node:test";
import assert from "node:assert/strict";
import { parsePublicRegistrationMultipart } from "./publicRegistrationUpload.js";
import { publicRegistration } from "../validation/publicIntakeSchemas.js";

const payload = {
  agreeTerms: true,
  centre: { name: "Centre", uuid: "123e4567-e89b-42d3-a456-426614174000" },
  programme: { title: "Academy", uuid: "123e4567-e89b-42d3-a456-426614174001", baseFee: 5000 },
  payment: { frequency: "registration", fee: 40000 },
  player: { name: "Player Name", gender: "female", dob: "2012-03-04", school: "School", className: "Year 8", positionUuid: "123e4567-e89b-42d3-a456-426614174002" },
  guardian: { name: "Guardian", relationship: "mother", phone: "+2348012345678", email: "guardian@example.test", address: "Address", alternativePhone: "08010000000" },
  emergencyContact: { name: "Emergency", phone: "+2348098765432" },
};

const multipart = (fields: Array<[string, string, string?]>, boundary = "htt-test-boundary") => {
  const chunks: Buffer[] = [];
  for (const [name, value, filename] of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"${filename ? `; filename="${filename}"` : ""}\r\n${filename ? "Content-Type: image/jpeg\r\n" : ""}\r\n`));
    chunks.push(Buffer.from(value, filename ? "latin1" : "utf8"));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), boundary };
};

test("accepts exact public multipart registration field and a JPEG file", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
  const { body, boundary } = multipart([["registration", JSON.stringify(payload)], ["file", jpeg.toString("latin1"), "player.jpg"]]);
  const parsed = parsePublicRegistrationMultipart(body, boundary);
  assert.deepEqual(publicRegistration.parse(parsed.registration), payload);
  assert.equal(parsed.file.mimeType, "image/jpeg");
  assert.equal(parsed.file.buffer.toString("hex"), jpeg.toString("hex"));
});

test("rejects incomplete multipart data, non-image bytes and unexpected fields", () => {
  const noFile = multipart([["registration", JSON.stringify(payload)]]);
  assert.throws(() => parsePublicRegistrationMultipart(noFile.body, noFile.boundary), /profile picture/i);
  const wrongFile = multipart([["registration", JSON.stringify(payload)], ["file", "plain text", "bad.jpg"]]);
  assert.throws(() => parsePublicRegistrationMultipart(wrongFile.body, wrongFile.boundary), /valid JPEG/i);
  const unexpected = multipart([["registration", JSON.stringify(payload)], ["file", Buffer.from([0xff, 0xd8, 0xff]).toString("latin1"), "x.jpg"], ["other", "x"]]);
  assert.throws(() => parsePublicRegistrationMultipart(unexpected.body, unexpected.boundary), /Only registration and file/i);
});

test("rejects missing or malformed public registration fields", () => {
  assert.equal(publicRegistration.safeParse({ ...payload, extra: true }).success, false);
  const withoutTerms = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "agreeTerms"));
  assert.equal(publicRegistration.safeParse(withoutTerms).success, false);
  assert.equal(publicRegistration.safeParse({ ...payload, agreeTerms: false }).success, false);
  assert.equal(publicRegistration.safeParse({ ...payload, payment: { ...payload.payment, fee: 40001 } }).success, false);
  assert.equal(publicRegistration.safeParse({ ...payload, centre: { ...payload.centre, uuid: "bad/value" } }).success, false);
  assert.equal(publicRegistration.safeParse({ ...payload, player: { ...payload.player, dob: "2012-02-31" } }).success, false);
});

test("accepts the public site centre/programme slugs and an unselected position", () => {
  const publicSitePayload = {
    ...payload,
    centre: { ...payload.centre, uuid: "magodo" },
    programme: { ...payload.programme, uuid: "ogudu-programme-1" },
    player: { ...payload.player, positionUuid: "" },
    consentMedical: true,
  };
  assert.deepEqual(publicRegistration.parse(publicSitePayload), publicSitePayload);
});
