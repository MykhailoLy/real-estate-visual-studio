import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const uploader = readFileSync(
  "src/components/order/ReferenceFilesUploader.tsx",
  "utf8",
);
const review = readFileSync(
  "src/components/order/ReferenceFilesReview.tsx",
  "utf8",
);
const thumbnail = readFileSync(
  "src/components/order/ReferenceFileThumbnail.tsx",
  "utf8",
);
const virtualCard = readFileSync(
  "src/components/order/virtual-staging/StagingItemCard.tsx",
  "utf8",
);
const singleCard = readFileSync(
  "src/components/order/image-enhancement/SingleExposureItemCard.tsx",
  "utf8",
);
const dayCard = readFileSync(
  "src/components/order/day-to-dusk/DayToDuskItemCard.tsx",
  "utf8",
);
const dayForm = readFileSync(
  "src/components/order/day-to-dusk/DayToDuskOrderForm.tsx",
  "utf8",
);

test("the universal uploader supports multi-select, multi-drop and appending", () => {
  assert.match(uploader, /type="file"[\s\S]+multiple/);
  assert.match(uploader, /onDrop=[\s\S]+event\.dataTransfer\.files/);
  assert.match(uploader, /appendReferenceFiles\(files,/);
  assert.match(uploader, /files\.filter\(\(file\) => file\.id !== id\)/);
});

test("the uploader exposes required copy, status and accessible removal", () => {
  assert.match(uploader, /Reference Files \(optional\)/);
  assert.match(uploader, /Up to 10 files\./);
  assert.match(uploader, /If a reference applies to every photo in this order/);
  assert.match(uploader, /of \{MAX_REFERENCE_FILES\} files/);
  assert.match(uploader, /aria-label=\{`Remove reference/);
  assert.match(uploader, /aria-live="polite"/);
});

test("image references use thumbnails and PDFs use a file icon", () => {
  assert.match(uploader, /ReferenceFileThumbnail/);
  assert.match(review, /ReferenceFileThumbnail/);
  assert.match(thumbnail, /isImageReference\(reference\) && previewUrl/);
  assert.match(thumbnail, /<FileText/);
  assert.match(thumbnail, /URL\.revokeObjectURL\(objectUrl\)/);
});

test("all three photo cards use one shared reference section", () => {
  for (const card of [virtualCard, singleCard, dayCard]) {
    assert.match(card, /ReferenceFilesUploader/);
    assert.match(card, /Reference Link \(optional\)/);
  }
  assert.doesNotMatch(singleCard, /Aerial Reference Image/);
  assert.doesNotMatch(singleCard, /Brand Assets/);
});

test("Day to Dusk only submits from Review and persists draft references", () => {
  assert.match(dayForm, /if \(submittingRef\.current \|\| step !== "review"\) return/);
  assert.match(dayForm, /listDraftReferenceFiles/);
  assert.match(dayForm, /handleReferenceFilesChange/);
  assert.match(dayForm, /enqueueDraftSave/);
  assert.match(dayForm, /submitLabel="Review Order"/);
});
