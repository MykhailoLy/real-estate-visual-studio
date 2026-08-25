import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_REFERENCE_FILE_SIZE_BYTES,
  MAX_REFERENCE_TOTAL_SIZE_BYTES,
  REFERENCE_FILE_ERRORS,
  appendReferenceFiles,
  mergeReferenceFiles,
  normalizeReferenceLink,
  resolveReferenceFileSelection,
  validateReferenceFiles,
  type ReferenceFileValue,
} from "./reference-files.ts";
import { ItemFilesSchema } from "./server-validation.ts";
import { buildPendingPath } from "./upload-config.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function uploadedReference(position: number, size = 1024, mimeType = "image/jpeg") {
  const referenceId = `${String(position + 1).padStart(8, "0")}-1111-4111-8111-111111111111`;
  return {
    bucket: "order-files",
    path: buildPendingPath(
      USER_ID,
      TOKEN,
      0,
      "reference",
      mimeType === "application/pdf" ? "pdf" : "jpg",
      position,
      referenceId,
    ),
    originalFilename: mimeType === "application/pdf" ? `reference-${position}.pdf` : `reference-${position}.jpg`,
    size,
    mimeType,
    referenceId,
    position,
  };
}

function uploadedOriginal() {
  return {
    bucket: "order-files",
    path: buildPendingPath(USER_ID, TOKEN, 0, "original", "jpg"),
    originalFilename: "original.jpg",
    size: 1024,
    mimeType: "image/jpeg",
  };
}

function file(name: string, size = 1024, type = "image/jpeg", lastModified = 1) {
  return { name, size, type, lastModified } as File;
}

function value(id: string, overrides: Partial<ReferenceFileValue> = {}): ReferenceFileValue {
  return {
    id,
    file: null,
    filename: `${id}.jpg`,
    fileSize: 1024,
    mimeType: "image/jpeg",
    lastModified: null,
    ...overrides,
  };
}

test("multiple files append in selection order and one removal preserves others", () => {
  const first = appendReferenceFiles([], [file("one.jpg"), file("two.png", 2, "image/png")]);
  assert.deepEqual(first.accepted.map((item) => item.filename), ["one.jpg", "two.png"]);
  const appended = appendReferenceFiles(first.accepted, [file("three.pdf", 3, "application/pdf")]);
  const remaining = appended.accepted.filter((item) => item.filename !== "two.png");
  assert.deepEqual(remaining.map((item) => item.filename), ["one.jpg", "three.pdf"]);
});

test("duplicate accidental additions are rejected", () => {
  const selected = file("same.jpg", 42, "image/jpeg", 99);
  const first = appendReferenceFiles([], [selected]);
  const second = appendReferenceFiles(first.accepted, [selected]);
  assert.equal(second.accepted.length, 1);
  assert.deepEqual(second.errors, [REFERENCE_FILE_ERRORS.duplicate]);
});

test("different files with the same filename retain stable unique identities", () => {
  const selected = appendReferenceFiles([], [
    file("same.png", 1024, "image/png", 1),
    file("same.png", 2048, "image/png", 2),
  ]);

  assert.equal(selected.accepted.length, 2);
  assert.deepEqual(selected.accepted.map((reference) => reference.filename), [
    "same.png",
    "same.png",
  ]);
  assert.notEqual(selected.accepted[0].id, selected.accepted[1].id);
});

test("count, per-file, combined-size and supported-type limits are enforced", () => {
  const ten = Array.from({ length: 10 }, (_, index) => value(String(index)));
  assert.deepEqual(appendReferenceFiles(ten, [file("extra.jpg")]).errors, [REFERENCE_FILE_ERRORS.count]);
  assert.deepEqual(
    appendReferenceFiles([], [file("large.jpg", MAX_REFERENCE_FILE_SIZE_BYTES + 1)]).errors,
    [REFERENCE_FILE_ERRORS.size],
  );
  const nearTotal = Array.from({ length: 5 }, (_, index) =>
    value(String(index), { fileSize: MAX_REFERENCE_TOTAL_SIZE_BYTES / 5 }),
  );
  assert.deepEqual(appendReferenceFiles(nearTotal, [file("extra.jpg")]).errors, [REFERENCE_FILE_ERRORS.total]);
  assert.deepEqual(appendReferenceFiles([], [file("bad.gif", 1, "image/gif")]).errors, [REFERENCE_FILE_ERRORS.type]);
});

test("mixed invalid selection preserves valid existing files and accepts valid candidates", () => {
  const existing = [value("existing")];
  const result = appendReferenceFiles(existing, [
    file("bad.gif", 1, "image/gif"),
    file("valid.pdf", 2, "application/pdf"),
  ]);
  assert.deepEqual(result.accepted.map((item) => item.filename), ["existing.jpg", "valid.pdf"]);
  assert.deepEqual(result.errors, [REFERENCE_FILE_ERRORS.type]);
});

test("trusted validation mirrors client limits", () => {
  assert.deepEqual(validateReferenceFiles([value("pdf", { filename: "guide.pdf", mimeType: "application/pdf" })]), []);
  assert.deepEqual(validateReferenceFiles([value("gif", { filename: "bad.gif", mimeType: "image/gif" })]), [REFERENCE_FILE_ERRORS.type]);
});

test("trusted order schema accepts ordered image and PDF references", () => {
  const parsed = ItemFilesSchema.safeParse({
    original: uploadedOriginal(),
    references: [uploadedReference(0), uploadedReference(1, 1024, "application/pdf")],
  });
  assert.equal(parsed.success, true);
});

test("trusted order schema rejects per-file and combined reference overflow", () => {
  assert.equal(
    ItemFilesSchema.safeParse({
      original: uploadedOriginal(),
      references: [uploadedReference(0, MAX_REFERENCE_FILE_SIZE_BYTES + 1)],
    }).success,
    false,
  );
  assert.equal(
    ItemFilesSchema.safeParse({
      original: uploadedOriginal(),
      references: Array.from({ length: 6 }, (_, index) =>
        uploadedReference(index, 18 * 1024 * 1024),
      ),
    }).success,
    false,
  );
});

test("dual read de-duplicates the legacy fallback by storage path", () => {
  const primary = value("new", { storagePath: "order/reference.jpg" });
  const legacy = value("legacy", { storagePath: "order/reference.jpg" });
  assert.deepEqual(mergeReferenceFiles([primary], [legacy]), [primary]);
});

test("restored normalized references suppress their pathless legacy mirror", () => {
  const primary = value("normalized-id", {
    filename: "reference.png",
    fileSize: 2048,
    mimeType: "image/png",
    storagePath: null,
    previewUrl: "https://storage.example/object/sign/order-files/reference.png?token=one",
  });
  const legacyMirror = value("legacy-id", {
    filename: "reference.png",
    fileSize: 2048,
    mimeType: "image/png",
    previewUrl: "https://storage.example/object/sign/order-files/reference.png?token=two",
  });

  assert.deepEqual(mergeReferenceFiles([primary], [legacyMirror]), [primary]);
});

test("same-filename normalized uploads survive rehydration without a mirror row", () => {
  const first = value("first-id", { filename: "same.png", mimeType: "image/png" });
  const second = value("second-id", { filename: "same.png", mimeType: "image/png" });
  const legacyMirror = value("legacy-id", {
    filename: "same.png",
    mimeType: "image/png",
  });

  assert.deepEqual(mergeReferenceFiles([first, second], [legacyMirror]), [
    first,
    second,
  ]);
});

test("legacy references remain visible when normalized references are absent", () => {
  const legacy = value("legacy-id", { filename: "old-reference.png" });

  assert.deepEqual(mergeReferenceFiles([], [legacy]), [legacy]);
});

test("editing normalized references never removes the hidden legacy mirror", () => {
  const persisted = value("normalized-id", { filename: "saved.png" });
  const added = value("next-id", { filename: "new.png" });
  const legacy = value("legacy-id", { filename: "saved.png" });

  assert.deepEqual(
    resolveReferenceFileSelection([persisted, added], [persisted], legacy),
    { references: [persisted, added], removeLegacy: false },
  );
});

test("editing historical legacy-only references preserves explicit remove semantics", () => {
  const legacy = value("legacy-id", { filename: "historical.png" });
  const added = value("next-id", { filename: "new.png" });

  assert.deepEqual(resolveReferenceFileSelection([legacy, added], [], legacy), {
    references: [added],
    removeLegacy: false,
  });
  assert.deepEqual(resolveReferenceFileSelection([], [], legacy), {
    references: [],
    removeLegacy: true,
  });
});

test("reference links accept only credential-free HTTP and HTTPS URLs", () => {
  assert.equal(normalizeReferenceLink("https://example.com/guide"), "https://example.com/guide");
  assert.equal(normalizeReferenceLink("javascript:alert(1)"), null);
  assert.equal(normalizeReferenceLink("https://user:secret@example.com"), null);
  assert.equal(normalizeReferenceLink(""), "");
});
