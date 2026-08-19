import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLegacySingleExposureDraftState } from "./single-exposure.ts";
import { normalizeLegacyVirtualStagingDraftState } from "./virtual-staging.ts";

function itemState(result: unknown): Record<string, unknown> {
  const root = result as { items: Array<{ state: Record<string, unknown> }> };
  return root.items[0].state;
}

test("Virtual Staging migrates a singular referenceImage into referenceFiles", () => {
  const migrated = itemState(
    normalizeLegacyVirtualStagingDraftState({
      items: [
        {
          clientItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          state: {
            referenceImage: {
              name: "old-style.jpg",
              size: 123,
              type: "image/jpeg",
            },
          },
        },
      ],
    }),
  );
  assert.equal("referenceImage" in migrated, false);
  assert.deepEqual(
    (migrated.referenceFiles as Array<Record<string, unknown>>).map((file) => file.filename),
    ["old-style.jpg"],
  );
});

test("Single Exposure migrates aerialReferenceImage into universal references", () => {
  const migrated = itemState(
    normalizeLegacySingleExposureDraftState({
      items: [
        {
          clientItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          state: {
            aerialReferenceImage: {
              name: "lot-boundary.png",
              size: 456,
              type: "image/png",
            },
          },
        },
      ],
    }),
  );
  assert.equal("aerialReferenceImage" in migrated, false);
  assert.deepEqual(
    (migrated.referenceFiles as Array<Record<string, unknown>>).map((file) => file.filename),
    ["lot-boundary.png"],
  );
});

test("legacy shape migration does not duplicate an existing normalized file", () => {
  const existing = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    filename: "kept.pdf",
    fileSize: 100,
    mimeType: "application/pdf",
    lastModified: null,
  };
  const migrated = itemState(
    normalizeLegacySingleExposureDraftState({
      items: [
        {
          clientItemId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          state: {
            referenceFiles: [existing],
            aerialReferenceImage: {
              name: "legacy.png",
              size: 456,
              type: "image/png",
            },
          },
        },
      ],
    }),
  );
  assert.deepEqual(migrated.referenceFiles, [existing]);
});
