import assert from "node:assert/strict";
import test from "node:test";
import {
  PROPERTY_CUSTOM_FLYER_FORMATS,
  customFlyerFormatFromUploadKind,
  validatePropertyCustomFlyerBinary,
} from "./custom-flyer.ts";

test("custom flyer formats have strict independent MIME types and limits", () => {
  assert.equal(PROPERTY_CUSTOM_FLYER_FORMATS.pdf.mime, "application/pdf");
  assert.equal(PROPERTY_CUSTOM_FLYER_FORMATS.pdf.maxBytes, 25 * 1024 * 1024);
  assert.equal(PROPERTY_CUSTOM_FLYER_FORMATS.jpg.mime, "image/jpeg");
  assert.equal(PROPERTY_CUSTOM_FLYER_FORMATS.jpg.maxBytes, 15 * 1024 * 1024);
  assert.equal(PROPERTY_CUSTOM_FLYER_FORMATS.png.mime, "image/png");
  assert.equal(PROPERTY_CUSTOM_FLYER_FORMATS.png.maxBytes, 20 * 1024 * 1024);
  assert.equal(customFlyerFormatFromUploadKind("flyer-jpg"), "jpg");
  assert.equal(customFlyerFormatFromUploadKind("gallery"), null);
});

test("custom flyer magic-byte validation rejects mismatched or oversized payloads", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\nfinished brochure");
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(validatePropertyCustomFlyerBinary({ format: "pdf", contentType: "application/pdf", bytes: pdf }), null);
  assert.equal(validatePropertyCustomFlyerBinary({ format: "jpg", contentType: "image/jpeg", bytes: jpg }), null);
  assert.equal(validatePropertyCustomFlyerBinary({ format: "png", contentType: "image/png", bytes: png }), null);
  assert.match(
    validatePropertyCustomFlyerBinary({ format: "jpg", contentType: "image/jpeg", bytes: png }) ?? "",
    /content does not match/,
  );
  assert.match(
    validatePropertyCustomFlyerBinary({ format: "pdf", contentType: "image/png", bytes: pdf }) ?? "",
    /Expected application\/pdf/,
  );
  assert.match(
    validatePropertyCustomFlyerBinary({
      format: "jpg",
      contentType: "image/jpeg",
      bytes: new Uint8Array(PROPERTY_CUSTOM_FLYER_FORMATS.jpg.maxBytes + 1),
    }) ?? "",
    /15 MB/,
  );
});
