import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupSourceFingerprint,
  extractCleanupDeleteRecords,
  parseCleanupCliOptions,
} from "./cleanup-public-media.ts";
import {
  applyCleanupDeleteRecord,
  cleanupRecordKey,
  inspectCleanupDeleteRecord,
  validateCleanupDeleteRecord,
  type CleanupDeleteRecord,
  type CleanupDeleteRepository,
} from "./public-media-cleanup-core.ts";
import type {
  ExistingReference,
  PublicMediaBucket,
  StorageObjectInfo,
} from "./public-media-backfill-core.ts";

function record(overrides: Partial<CleanupDeleteRecord> = {}): CleanupDeleteRecord {
  return {
    bucket: "site-media",
    oldPath: "service-options/original.jpg",
    newPath: "service-options/1800000000000-abcdef123456-legacy-gallery.webp",
    originalBytes: 3_000_000,
    optimizedBytes: 600_000,
    ...overrides,
  };
}

class FakeCleanupRepository implements CleanupDeleteRepository {
  readonly objects = new Map<string, StorageObjectInfo>();
  readonly events: string[] = [];
  findReferenceCalls = 0;
  deleteCalls = 0;
  references: readonly ExistingReference[] = [];
  referencesAfterFirstCheck: readonly ExistingReference[] | null = null;

  constructor(current: CleanupDeleteRecord) {
    this.objects.set(`${current.bucket}/${current.oldPath}`, {
      size: current.originalBytes,
      mimeType: "image/jpeg",
    });
    this.objects.set(`${current.bucket}/${current.newPath}`, {
      size: current.optimizedBytes,
      mimeType: "image/webp",
    });
  }

  async findReferences(bucket: PublicMediaBucket, path: string) {
    this.findReferenceCalls += 1;
    this.events.push(`find:${bucket}/${path}`);
    if (this.findReferenceCalls > 1 && this.referencesAfterFirstCheck) {
      return this.referencesAfterFirstCheck;
    }
    return this.references;
  }

  async getStorageObjectInfo(bucket: PublicMediaBucket, path: string) {
    this.events.push(`info:${bucket}/${path}`);
    return this.objects.get(`${bucket}/${path}`) ?? null;
  }

  async deleteObject(bucket: PublicMediaBucket, path: string) {
    this.deleteCalls += 1;
    this.events.push(`delete:${bucket}/${path}`);
    this.objects.delete(`${bucket}/${path}`);
  }
}

function manifestEntry(overrides: Record<string, unknown> = {}) {
  const table = "site_media_items";
  const rowId = "row-1";
  const column = "image_path";
  const oldPath = "service-options/original.jpg";
  return {
    attemptId: "attempt-1",
    candidateKey: JSON.stringify([table, rowId, column, oldPath]),
    table,
    rowId,
    column,
    bucket: "site-media",
    oldPath,
    newPath: "service-options/1800000000000-abcdef123456-legacy-gallery.webp",
    originalBytes: 3_000_000,
    optimizedBytes: 600_000,
    status: "migrated",
    message: "done",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

function manifest(entries: unknown[]) {
  return {
    version: 1 as const,
    projectUrl: "https://example.supabase.co",
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    entries,
  };
}

test("cleanup CLI defaults to dry-run and requires a source manifest", () => {
  assert.deepEqual(parseCleanupCliOptions(["--manifest", "backfill.json"]), {
    mode: "dry-run",
    manifestPath: "backfill.json",
    journalPath: null,
  });
  assert.throws(() => parseCleanupCliOptions([]), /requires --manifest/);
  assert.throws(
    () => parseCleanupCliOptions(["--apply", "--manifest", "backfill.json"]),
    /requires --journal/,
  );
  assert.deepEqual(
    parseCleanupCliOptions([
      "--apply",
      "--manifest",
      "backfill.json",
      "--journal",
      "cleanup.json",
    ]),
    {
      mode: "apply",
      manifestPath: "backfill.json",
      journalPath: "cleanup.json",
    },
  );
});

test("cleanup source only accepts migrated public records with consistent audit fields", () => {
  const records = extractCleanupDeleteRecords(
    manifest([
      manifestEntry(),
      manifestEntry({ status: "failed", attemptId: "ignored" }),
    ]),
  );
  assert.deepEqual(records, [record()]);
  assert.throws(
    () =>
      extractCleanupDeleteRecords(
        manifest([manifestEntry({ candidateKey: "tampered" })]),
      ),
    /candidate key does not match/,
  );
  assert.throws(
    () =>
      extractCleanupDeleteRecords(
        manifest([manifestEntry({ bucket: "order-files" })]),
      ),
    /private bucket/,
  );
});

test("cleanup source fingerprint is stable across record order", () => {
  const a = record();
  const b = record({
    bucket: "portfolio",
    oldPath: "day-to-dusk/original.jpg",
    newPath: "day-to-dusk/1800000000001-fedcba654321-legacy-gallery.webp",
  });
  assert.equal(
    cleanupSourceFingerprint([a, b]),
    cleanupSourceFingerprint([b, a]),
  );
});

test("cleanup record validation refuses replacement paths as deletion targets", () => {
  assert.throws(
    () =>
      validateCleanupDeleteRecord(
        record({
          oldPath: "service-options/1800000000000-abcdef123456-legacy-gallery.webp",
        }),
      ),
    /refuses to delete generated replacement/,
  );
});

test("cleanup inspection marks a matching unreferenced old object safe", async () => {
  const current = record();
  const repository = new FakeCleanupRepository(current);
  const inspected = await inspectCleanupDeleteRecord(repository, current);
  assert.equal(inspected.status, "safe");
  assert.equal(inspected.reason, "safe-to-delete");
  assert.equal(inspected.sourceInfo?.size, current.originalBytes);
});

test("cleanup inspection retains an old object referenced by Property Showcase", async () => {
  const current = record();
  const repository = new FakeCleanupRepository(current);
  repository.references = [
    { table: "property_showcases", rowId: "showcase-1", column: "content" },
  ];
  const inspected = await inspectCleanupDeleteRecord(repository, current);
  assert.equal(inspected.status, "retained");
  assert.equal(inspected.reason, "still-referenced");
});

test("cleanup inspection retains when replacement bytes or source bytes changed", async () => {
  const current = record();
  const replacementMismatch = new FakeCleanupRepository(current);
  replacementMismatch.objects.set(`${current.bucket}/${current.newPath}`, {
    size: current.optimizedBytes + 1,
    mimeType: "image/webp",
  });
  assert.equal(
    (await inspectCleanupDeleteRecord(replacementMismatch, current)).reason,
    "replacement-size-mismatch",
  );

  const sourceMismatch = new FakeCleanupRepository(current);
  sourceMismatch.objects.set(`${current.bucket}/${current.oldPath}`, {
    size: current.originalBytes + 1,
    mimeType: "image/jpeg",
  });
  assert.equal(
    (await inspectCleanupDeleteRecord(sourceMismatch, current)).reason,
    "source-object-changed",
  );
});

test("delete journals intent, repeats guards, deletes, verifies, then journals completion", async () => {
  const current = record();
  const repository = new FakeCleanupRepository(current);
  const journalEvents: string[] = [];
  const applied = await applyCleanupDeleteRecord(
    repository,
    current,
    "none",
    {
      recordDeleting: async () => {
        journalEvents.push("deleting");
        repository.events.push("journal:deleting");
      },
      recordDeleted: async () => {
        journalEvents.push("deleted");
        repository.events.push("journal:deleted");
      },
    },
  );

  assert.equal(applied.status, "deleted");
  assert.equal(applied.stage, "complete");
  assert.equal(repository.deleteCalls, 1);
  assert.equal(
    repository.objects.has(`${current.bucket}/${current.oldPath}`),
    false,
  );
  assert.deepEqual(journalEvents, ["deleting", "deleted"]);
  assert.equal(repository.findReferenceCalls, 2);
  assert.ok(
    repository.events.indexOf("journal:deleting") <
      repository.events.indexOf(`delete:${current.bucket}/${current.oldPath}`),
  );
  assert.ok(
    repository.events.lastIndexOf(`find:${current.bucket}/${current.oldPath}`) <
      repository.events.indexOf(`delete:${current.bucket}/${current.oldPath}`),
  );
});

test("a new reference appearing at the final guard stops cleanup without delete", async () => {
  const current = record();
  const repository = new FakeCleanupRepository(current);
  repository.referencesAfterFirstCheck = [
    { table: "site_media_items", rowId: "new-row", column: "image_path" },
  ];

  const applied = await applyCleanupDeleteRecord(repository, current, "none", {
    recordDeleting: async () => undefined,
  });
  assert.equal(applied.status, "fatal");
  assert.equal(applied.stop, true);
  assert.equal(repository.deleteCalls, 0);
  assert.match(applied.message, /became referenced again/);
});

test("resume after delete intent safely journals an already absent old object", async () => {
  const current = record();
  const repository = new FakeCleanupRepository(current);
  repository.objects.delete(`${current.bucket}/${current.oldPath}`);
  let completed = 0;

  const applied = await applyCleanupDeleteRecord(
    repository,
    current,
    "deleting",
    {
      recordDeleted: async () => {
        completed += 1;
      },
    },
  );

  assert.equal(applied.status, "deleted");
  assert.equal(repository.deleteCalls, 0);
  assert.equal(completed, 1);
});

test("journal-deleted state fails closed if the old object reappears", async () => {
  const current = record();
  const repository = new FakeCleanupRepository(current);
  const applied = await applyCleanupDeleteRecord(
    repository,
    current,
    "deleted",
  );
  assert.equal(applied.status, "fatal");
  assert.equal(applied.stop, true);
  assert.equal(repository.deleteCalls, 0);
  assert.match(applied.message, /journal-says-deleted-but-source-exists/);
});

test("cleanup record key distinguishes bucket and both paths", () => {
  const current = record();
  assert.notEqual(
    cleanupRecordKey(current),
    cleanupRecordKey(
      record({
        bucket: "portfolio",
        oldPath: "service-options/original.jpg",
        newPath: current.newPath,
      }),
    ),
  );
});
