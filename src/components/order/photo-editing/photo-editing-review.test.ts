import assert from "node:assert/strict";
import test from "node:test";
import type { OrderDraftUploadedFileSummary } from "../../../lib/order-drafts/files.ts";
import { calculateOrderQuote } from "../../../lib/pricing/calculate.ts";
import {
  buildPhotoEditingReviewRows,
  calculatePhotoEditingReviewQuote,
  findPhotoEditingReviewFileDisplay,
} from "./photo-editing-review.ts";

const firstItem = {
  selectedOptions: [
    "image-enhancement-re",
    "shadow-removal",
    "turn-on-lights-pe",
  ],
  fileSizeLimit: "Under 10 MB",
  disclaimerText: "Virtual furniture shown for scale.",
  additionalInfo: "Keep the window view natural.",
};

test("review rows render every selected operation with canonical labels", () => {
  const rows = buildPhotoEditingReviewRows({
    ...firstItem,
    selectedOptions: [...firstItem.selectedOptions, "internal-raw-option-id"],
  });
  const values = Object.fromEntries(rows.map((row) => [row.label, row.value]));

  assert.equal(
    values["Editing Operations"],
    "Image Enhancement - Real Estate, Shadow Removal, Turn On Lights",
  );
  assert.doesNotMatch(values["Editing Operations"] ?? "", /-re|-pe|raw-option/);
  assert.equal(values["File Size Limit"], "Under 10 MB");
  assert.equal(
    values["Disclaimer Text"],
    "Virtual furniture shown for scale.",
  );
  assert.equal(
    values["Additional Information"],
    "Keep the window view natural.",
  );
});

test("review rows use explicit display values for optional empty fields", () => {
  const rows = buildPhotoEditingReviewRows({
    selectedOptions: ["background-removal"],
    fileSizeLimit: "",
    disclaimerText: "",
    additionalInfo: "",
  });
  const values = Object.fromEntries(rows.map((row) => [row.label, row.value]));

  assert.equal(values["Editing Operations"], "Background Removal");
  assert.equal(values["File Size Limit"], "Not specified");
  assert.equal(values["Disclaimer Text"], "None");
  assert.equal(values["Additional Information"], "None");
});

test("review quote and per-item subtotals come from canonical pricing", () => {
  const items = [
    firstItem,
    {
      ...firstItem,
      selectedOptions: ["day-to-dusk-pe", "water-effect"],
    },
  ];
  const reviewQuote = calculatePhotoEditingReviewQuote(items, "USD");
  const canonicalQuote = calculateOrderQuote({
    serviceType: "photo-editing",
    currency: "USD",
    items: items.map((item) => ({
      selectedOptions: item.selectedOptions,
    })),
  });

  assert.deepEqual(reviewQuote, canonicalQuote);
  assert.equal(
    reviewQuote.items[1]?.lineSubtotalCents,
    canonicalQuote.items[1]?.lineSubtotalCents,
  );
});

test("persisted original display survives without a browser File", () => {
  const clientItemId = "55555555-5555-4555-8555-555555555555";
  const display = findPhotoEditingReviewFileDisplay(clientItemId, [
    {
      itemClientId: "66666666-6666-4666-8666-666666666666",
      kind: "original",
      originalFilename: "other.jpg",
      fileSize: 10,
      previewUrl: "https://example.test/other-preview",
    },
    {
      itemClientId: clientItemId,
      kind: "original",
      originalFilename: "durable-original.jpg",
      fileSize: 4_321_000,
      previewUrl: "https://example.test/authorized-preview",
    },
  ]);

  assert.deepEqual(display, {
    filename: "durable-original.jpg",
    fileSize: 4_321_000,
    previewUrl: "https://example.test/authorized-preview",
  });
  assert.deepEqual(Object.keys(display ?? {}).sort(), [
    "fileSize",
    "filename",
    "previewUrl",
  ]);
});

test("immediate review consumes the completed durable-upload summary without a browser File", () => {
  const clientItemId = "77777777-7777-4777-8777-777777777777";
  const completedUpload: OrderDraftUploadedFileSummary = {
    id: "88888888-8888-4888-8888-888888888888",
    itemClientId: clientItemId,
    itemIndex: 0,
    kind: "original",
    originalFilename: "immediate-review.png",
    fileSize: 768,
    mimeType: "image/png",
    uploadStatus: "uploaded",
    createdAt: "2026-08-27T10:00:00.000Z",
    updatedAt: "2026-08-27T10:00:01.000Z",
    previewUrl: "https://example.test/immediate-preview",
    previewExpiresAt: "2026-08-27T10:10:01.000Z",
  };

  assert.deepEqual(
    findPhotoEditingReviewFileDisplay(clientItemId, [completedUpload]),
    {
      filename: "immediate-review.png",
      fileSize: 768,
      previewUrl: "https://example.test/immediate-preview",
    },
  );
});
