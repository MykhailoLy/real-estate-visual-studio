import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getCurrentDeliverableRows } from "./client-deliverable-display.ts";
import {
  buildClientJobImageGalleries,
  getAdjacentViewerIndex,
} from "./client-job-image-navigation.ts";
import type { ClientDeliverable } from "./client-deliverables.ts";
import type { DeliverableReview } from "./client-reviews.ts";

function deliverable(
  id: string,
  itemIndex: number | null,
  filename = `${id}.jpg`,
): ClientDeliverable {
  return {
    id,
    order_id: "order-1",
    order_number: "PS-1",
    item_index: itemIndex,
    filename,
    file_size: 100,
    mime_type: filename.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
    uploaded_at: "2026-09-10T10:00:00.000Z",
  };
}

function replacementReview(
  deliverableId: string,
  replacementDeliverableId: string,
): DeliverableReview {
  return {
    id: "review-1",
    deliverable_id: deliverableId,
    order_id: "order-1",
    order_number: "PS-1",
    item_index: 0,
    client_email: "client@example.com",
    status: "rework_delivered",
    comment: "Use the replacement",
    created_at: "2026-09-10T10:00:00.000Z",
    updated_at: "2026-09-10T10:00:00.000Z",
    replacement_deliverable_id: replacementDeliverableId,
  };
}

test("viewer navigation stops at the first and last image and moves from the middle", () => {
  assert.equal(getAdjacentViewerIndex(0, 3, -1), null);
  assert.equal(getAdjacentViewerIndex(1, 3, -1), 0);
  assert.equal(getAdjacentViewerIndex(1, 3, 1), 2);
  assert.equal(getAdjacentViewerIndex(2, 3, 1), null);
});

test("job galleries preserve visible order while keeping originals and deliveries separate", () => {
  const galleries = buildClientJobImageGalleries({
    orderId: "order-1",
    itemIndexes: [2, 0, 1],
    sourceFiles: [
      { id: "original-0", itemIndex: 0, kind: "original", filename: "zero.jpg", mimeType: "image/jpeg" },
      { id: "reference-0", itemIndex: 0, kind: "reference", filename: "mood.jpg", mimeType: "image/jpeg" },
      { id: "original-1", itemIndex: 1, kind: "original", filename: "one.webp", mimeType: "image/webp" },
      { id: "original-2", itemIndex: 2, kind: "original", filename: "brief.pdf", mimeType: "application/pdf" },
    ],
    currentDeliverables: [
      { deliverable: deliverable("delivered-0b", 0) },
      { deliverable: deliverable("delivered-2", 2) },
      { deliverable: deliverable("delivered-0a", 0) },
      { deliverable: deliverable("order-image", null) },
      { deliverable: deliverable("order-pdf", null, "documents.pdf") },
    ],
  });

  assert.deepEqual(galleries.originals.map((item) => item.id), [
    "source:original-0",
    "source:original-1",
  ]);
  assert.deepEqual(galleries.delivered.map((item) => item.id), [
    "deliverable:delivered-2",
    "deliverable:delivered-0b",
    "deliverable:delivered-0a",
  ]);
  const middleIndex = 1;
  assert.equal(
    galleries.delivered[getAdjacentViewerIndex(middleIndex, galleries.delivered.length, -1)!]?.id,
    "deliverable:delivered-2",
  );
  assert.equal(
    galleries.delivered[getAdjacentViewerIndex(middleIndex, galleries.delivered.length, 1)!]?.id,
    "deliverable:delivered-0a",
  );
  assert.deepEqual(galleries.orderFiles.map((item) => item.id), [
    "deliverable:order-image",
  ]);
  assert.ok(!galleries.originals.some((item) => item.id.includes("reference")));
});

test("replacement filtering keeps stale deliverables out of viewer navigation", () => {
  const stale = deliverable("stale", 0);
  const replacement = deliverable("replacement", 0);
  const currentRows = getCurrentDeliverableRows(
    [stale, replacement],
    [replacementReview(stale.id, replacement.id)],
  );
  const galleries = buildClientJobImageGalleries({
    orderId: "order-1",
    itemIndexes: [0],
    sourceFiles: [],
    currentDeliverables: currentRows,
  });

  assert.deepEqual(galleries.delivered.map((item) => item.id), [
    "deliverable:replacement",
  ]);
});

test("job image viewer retains keyboard navigation and normal close behavior", () => {
  const source = readFileSync("src/components/FilePreviewCard.tsx", "utf8");
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /aria-label="Previous image"/);
  assert.match(source, /aria-label="Next image"/);
  assert.match(source, /aria-label="Close viewer"/);
  assert.match(source, /setModalOpen\(false\)/);
});
