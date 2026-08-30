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
const virtualForm = readFileSync(
  "src/components/order/virtual-staging/VirtualStagingOrderForm.tsx",
  "utf8",
);
const renovationCard = readFileSync(
  "src/components/order/virtual-renovation/RenovationItemCard.tsx",
  "utf8",
);
const renovationForm = readFileSync(
  "src/components/order/virtual-renovation/VirtualRenovationOrderForm.tsx",
  "utf8",
);
const renovationReview = readFileSync(
  "src/components/order/virtual-renovation/VirtualRenovationReview.tsx",
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

test("the uploader anchors its focusable file input to the local scroll context", () => {
  assert.match(uploader, /<section className="relative space-y-3"/);
  assert.match(uploader, /className="peer sr-only"/);
});

test("image references use thumbnails and PDFs use a file icon", () => {
  assert.match(uploader, /ReferenceFileThumbnail/);
  assert.match(review, /ReferenceFileThumbnail/);
  assert.match(thumbnail, /isImageReference\(reference\) && previewUrl/);
  assert.match(thumbnail, /<FileText/);
  assert.match(thumbnail, /URL\.revokeObjectURL\(objectUrl\)/);
});

test("runtime blob and private signed previews bypass next/image", () => {
  assert.match(thumbnail, /<img[\s\S]+src=\{previewUrl\}/);
  assert.doesNotMatch(thumbnail, /from ["']next\/image["']/);
});

test("reference rows use stable server IDs instead of duplicate filenames", () => {
  assert.match(uploader, /key=\{reference\.id\}/);
  assert.doesNotMatch(uploader, /key=\{reference\.filename\}/);
});

test("legacy mirrors are reconciled without deleting normalized references", () => {
  for (const card of [virtualCard, singleCard, renovationCard]) {
    assert.match(card, /resolveReferenceFileSelection/);
    assert.match(card, /selection\.removeLegacy/);
    assert.match(card, /selection\.references/);
  }
});

test("invalid signature remains inline and rejected references leave client state", () => {
  assert.match(virtualForm, /completed\.code === "invalid_upload"/);
  assert.match(
    virtualForm,
    /working = working\.filter\(\(candidate\) => candidate\.id !== reference\.id\)/,
  );
  assert.match(
    virtualForm,
    /The file contents do not match its file type\. Please upload a valid JPG, PNG, WebP, or PDF file\./,
  );
  assert.match(
    virtualForm,
    /El contenido del archivo no coincide con su tipo\. Sube un archivo JPG, PNG, WebP o PDF válido\./,
  );
  assert.match(
    virtualForm,
    /status: "error",[\s\S]+error: operationError \?\? copy\.fileOperationFailed/,
  );
});

test("reference completions guard stale sessions and await final draft persistence", () => {
  assert.match(virtualForm, /shouldApplyDraftFileOperation\(slotKey, session\)/);
  assert.match(
    virtualForm,
    /const persisted = await enqueueDraftSave\(buildDraftSourceSnapshot\(committed\)/,
  );
});

test("all four photo cards use one shared reference section", () => {
  for (const card of [virtualCard, singleCard, dayCard, renovationCard]) {
    assert.match(card, /ReferenceFilesUploader/);
    assert.match(card, /Reference Link \(optional\)/);
  }
  assert.doesNotMatch(singleCard, /Aerial Reference Image/);
  assert.doesNotMatch(singleCard, /Brand Assets/);
});

test("Virtual Renovation persists, restores and reviews normalized references", () => {
  assert.match(renovationForm, /listDraftReferenceFiles/);
  assert.match(renovationForm, /prepareDraftReferenceFile/);
  assert.match(renovationForm, /uploadPreparedDraftReferenceFile/);
  assert.match(renovationForm, /completeDraftReferenceFile/);
  assert.match(renovationForm, /deleteDraftReferenceFile/);
  assert.match(renovationForm, /handleReferenceFilesChange/);
  assert.match(renovationReview, /<ReferenceFilesReview/);
  assert.match(renovationReview, /mergeReferenceFiles/);
});

test("Day to Dusk only submits from Review and persists draft references", () => {
  assert.match(dayForm, /if \(submittingRef\.current \|\| step !== "review"\) return/);
  assert.match(dayForm, /listDraftReferenceFiles/);
  assert.match(dayForm, /handleReferenceFilesChange/);
  assert.match(dayForm, /enqueueDraftSave/);
  assert.match(
    dayForm,
    /<OrderReviewAction[\s\S]+disabled=\{!configureValid \|\| fileOperationActive\}/,
  );
});
