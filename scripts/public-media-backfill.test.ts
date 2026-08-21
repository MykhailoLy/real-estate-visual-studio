import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  IMAGE_PROFILE_SETTINGS,
  STANDARD_PUBLIC_IMAGE_PROFILE,
} from "../src/lib/image-profile-settings.ts";
import { parseCliOptions } from "./backfill-public-images.ts";
import { optimizeLegacyGalleryImage } from "./optimize-legacy-gallery-image.ts";
import {
  applyBackfillCandidates,
  applyBackfillCandidate,
  buildCleanupReport,
  buildLegacyGalleryObjectPath,
  candidateSkipReason,
  discoverBackfillCandidates,
  type ApplyRepository,
  type BackfillCandidate,
  type CleanupReportRepository,
  type DiscoveryRepository,
  type ExistingReference,
  type OptimizedGalleryImage,
  type PublicImageReference,
  type PublicMediaBucket,
  type StorageObjectInfo,
  type StorageUploadOptions,
} from "./public-media-backfill-core.ts";
import { guardedReplaceExactReference } from "./supabase-public-media-backfill-adapter.ts";

const TARGET_BYTES = IMAGE_PROFILE_SETTINGS.gallery.targetBytes;

function siteMediaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "site-row",
    section: "service-options",
    media_type: "image",
    title: "Site image",
    service_slug: "image-enhancement",
    before_image_path: null,
    after_image_path: null,
    image_path: null,
    poster_image_path: null,
    panorama_image_path: null,
    ...overrides,
  };
}

function portfolioRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "portfolio-row",
    service_slug: "day-to-dusk",
    title: "Portfolio image",
    before_image_path: null,
    after_image_path: null,
    ...overrides,
  };
}

class FakeDiscoveryRepository implements DiscoveryRepository {
  writes = 0;
  inspected: string[] = [];
  readonly siteRows: readonly unknown[];
  readonly portfolioRows: readonly unknown[];
  readonly objects: ReadonlyMap<string, StorageObjectInfo | null>;

  constructor(
    siteRows: readonly unknown[],
    portfolioRows: readonly unknown[],
    objects: ReadonlyMap<string, StorageObjectInfo | null>,
  ) {
    this.siteRows = siteRows;
    this.portfolioRows = portfolioRows;
    this.objects = objects;
  }

  async listSiteMediaRows(): Promise<readonly unknown[]> {
    return this.siteRows;
  }

  async listPortfolioRows(): Promise<readonly unknown[]> {
    return this.portfolioRows;
  }

  async getStorageObjectInfo(
    bucket: PublicMediaBucket,
    path: string,
  ): Promise<StorageObjectInfo | null> {
    this.inspected.push(`${bucket}/${path}`);
    return this.objects.get(`${bucket}/${path}`) ?? null;
  }
}

function candidate(
  overrides: Partial<BackfillCandidate> = {},
): BackfillCandidate {
  return {
    table: "site_media_items",
    rowId: "row-1",
    column: "image_path",
    bucket: "site-media",
    path: "service-options/original.jpg",
    section: "service-options",
    serviceSlug: "image-enhancement",
    title: "Original",
    currentBytes: TARGET_BYTES + 1,
    mimeType: "image/jpeg",
    intendedNewPath:
      "service-options/1800000000000-abcdef123456-legacy-gallery.webp",
    reason: "referenced public image exceeds the gallery target",
    ...overrides,
  };
}

const optimizedImage: OptimizedGalleryImage = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  width: 1800,
  height: 1200,
  quality: 0.68,
  targetMet: true,
};

class FakeApplyRepository implements ApplyRepository {
  referenceValue: string | null;
  rowExists = true;
  events: string[] = [];
  deleteCalls = 0;
  conflict = false;
  dbFailure = false;
  failPostUpdateVerification = false;
  referenceReadCount = 0;
  uploadedOptions: StorageUploadOptions | null = null;
  readonly sourceBytes = new Uint8Array(TARGET_BYTES + 1);
  readonly objects = new Map<string, StorageObjectInfo>();
  readonly currentCandidate: BackfillCandidate;

  constructor(currentCandidate: BackfillCandidate) {
    this.currentCandidate = currentCandidate;
    this.referenceValue = currentCandidate.path;
    this.objects.set(`${currentCandidate.bucket}/${currentCandidate.path}`, {
      size: this.sourceBytes.byteLength,
      mimeType: currentCandidate.mimeType,
    });
  }

  async readReference() {
    this.referenceReadCount += 1;
    this.events.push("read-reference");
    if (this.failPostUpdateVerification && this.referenceReadCount > 1) {
      return { rowExists: true, value: "service-options/unexpected.webp" };
    }
    return { rowExists: this.rowExists, value: this.referenceValue };
  }

  async getStorageObjectInfo(bucket: PublicMediaBucket, path: string) {
    this.events.push(`info:${path}`);
    return this.objects.get(`${bucket}/${path}`) ?? null;
  }

  async downloadObject() {
    this.events.push("download");
    return this.sourceBytes;
  }

  async uploadObject(
    bucket: PublicMediaBucket,
    path: string,
    bytes: Uint8Array,
    options: StorageUploadOptions,
  ) {
    this.events.push("upload");
    this.uploadedOptions = options;
    assert.equal(this.objects.has(`${bucket}/${path}`), false);
    this.objects.set(`${bucket}/${path}`, {
      size: bytes.byteLength,
      mimeType: options.contentType,
    });
  }

  async guardedReplaceReference(
    reference: PublicImageReference,
    newPath: string,
  ) {
    this.events.push("guarded-update");
    if (this.dbFailure) throw new Error("simulated DB failure");
    if (this.conflict || this.referenceValue !== reference.path) {
      return "conflict" as const;
    }
    this.referenceValue = newPath;
    return "updated" as const;
  }

  async deleteObject() {
    this.deleteCalls += 1;
  }
}

test("shared gallery profile is the single established configuration", () => {
  assert.equal(STANDARD_PUBLIC_IMAGE_PROFILE, "gallery");
  assert.deepEqual(IMAGE_PROFILE_SETTINGS.gallery, {
    maxLongSide: 2800,
    minLongSide: 1800,
    targetBytes: 1_600_000,
    initialQuality: 0.84,
    minimumQuality: 0.68,
  });
  assert.notDeepEqual(
    IMAGE_PROFILE_SETTINGS.gallery,
    IMAGE_PROFILE_SETTINGS["floor-plan"],
  );
});

test("candidate discovery filters by live references and excludes panorama", async () => {
  const repository = new FakeDiscoveryRepository(
    [
      siteMediaRow({
        id: "heavy-site",
        image_path: "service-options/heavy.jpg",
      }),
      siteMediaRow({
        id: "panorama",
        media_type: "panorama-360",
        panorama_image_path: "service-hero/panorama.jpg",
        poster_image_path: "service-hero/panorama-poster.jpg",
      }),
      siteMediaRow({
        id: "embed-only",
        media_type: "embed",
      }),
      siteMediaRow({
        id: "small-webp",
        image_path: "service-options/small.webp",
      }),
    ],
    [
      portfolioRow({
        before_image_path: "day-to-dusk/heavy.png",
      }),
    ],
    new Map([
      [
        "site-media/service-options/heavy.jpg",
        { size: 3_000_000, mimeType: "image/jpeg" },
      ],
      [
        "site-media/service-options/small.webp",
        { size: 400_000, mimeType: "image/webp" },
      ],
      [
        "portfolio/day-to-dusk/heavy.png",
        { size: 2_000_000, mimeType: "image/png" },
      ],
    ]),
  );

  const discovery = await discoverBackfillCandidates(repository, () => ({
    timestamp: 1_800_000_000_000,
    nonce: "abcdef123456",
  }));

  assert.deepEqual(
    discovery.candidates.map((item) => [item.table, item.rowId, item.column]),
    [
      ["site_media_items", "heavy-site", "image_path"],
      ["portfolio_items", "portfolio-row", "before_image_path"],
    ],
  );
  assert.equal(
    repository.inspected.some((path) => path.includes("panorama")),
    false,
  );
  assert.equal(
    discovery.skipped.some(
      (item) =>
        item.rowId === "small-webp" &&
        item.reason === "at-or-below-gallery-target",
    ),
    true,
  );
  assert.equal(discovery.originalTotalBytes, 5_000_000);
  assert.equal(discovery.theoreticalTargetCeiling, 3_200_000);
  assert.equal(discovery.potentialMaximumSavings, 1_800_000);
  assert.equal(repository.writes, 0);
});

test("candidate filtering rejects private buckets and small WebP objects", () => {
  assert.equal(
    candidateSkipReason(
      { bucket: "order-files", path: "orders/private.jpg" },
      { size: 9_000_000, mimeType: "image/jpeg" },
    ),
    "private-bucket",
  );
  assert.equal(
    candidateSkipReason(
      { bucket: "deliverables", path: "orders/private.jpg" },
      { size: 9_000_000, mimeType: "image/jpeg" },
    ),
    "private-bucket",
  );
  assert.equal(
    candidateSkipReason(
      { bucket: "portfolio", path: "day-to-dusk/small.webp" },
      { size: TARGET_BYTES, mimeType: "image/webp" },
    ),
    "at-or-below-gallery-target",
  );
});

test("discovery fails closed for ambiguous database paths", async () => {
  const repository = new FakeDiscoveryRepository(
    [siteMediaRow({ image_path: "site-media/service-options/image.jpg" })],
    [],
    new Map(),
  );
  await assert.rejects(
    discoverBackfillCandidates(repository),
    /Ambiguous site-media object path/,
  );
  assert.deepEqual(repository.inspected, []);
});

test("path generation preserves the folder and creates an auditable WebP name", () => {
  assert.equal(
    buildLegacyGalleryObjectPath("service-options/legacy photo.jpg", {
      timestamp: 1_800_000_000_123,
      nonce: "ABC-def-123",
    }),
    "service-options/1800000000123-abcdef123-legacy-gallery.webp",
  );
});

test("guarded DB replacement targets one table, id, column, and exact old path", async () => {
  const calls: Array<readonly unknown[]> = [];
  const query = {
    update(payload: Record<string, string>) {
      calls.push(["update", payload]);
      return query;
    },
    eq(column: string, value: unknown) {
      calls.push(["eq", column, value]);
      return query;
    },
    select(columns: string) {
      calls.push(["select", columns]);
      return query;
    },
    async maybeSingle() {
      calls.push(["maybeSingle"]);
      return { data: { id: "row-1", image_path: "new.webp" }, error: null };
    },
  };
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      return query;
    },
  } as unknown as SupabaseClient;
  const source = candidate();

  assert.equal(
    await guardedReplaceExactReference(client, source, "service-options/new.webp"),
    "updated",
  );
  assert.deepEqual(calls, [
    ["from", "site_media_items"],
    ["update", { image_path: "service-options/new.webp" }],
    ["eq", "id", "row-1"],
    ["eq", "image_path", "service-options/original.jpg"],
    ["select", "id,image_path"],
    ["maybeSingle"],
  ]);
});

test("guarded DB replacement reports a concurrency conflict", async () => {
  const query = {
    update() {
      return query;
    },
    eq() {
      return query;
    },
    select() {
      return query;
    },
    async maybeSingle() {
      return { data: null, error: null };
    },
  };
  const client = {
    from() {
      return query;
    },
  } as unknown as SupabaseClient;
  assert.equal(
    await guardedReplaceExactReference(
      client,
      candidate(),
      "service-options/new.webp",
    ),
    "conflict",
  );
});

test("apply uploads and verifies before the guarded DB update and never deletes", async () => {
  const currentCandidate = candidate();
  const repository = new FakeApplyRepository(currentCandidate);
  const journalEvents: string[] = [];

  const applied = await applyBackfillCandidate(
    currentCandidate,
    repository,
    async () => optimizedImage,
    {
      recordVerifiedUpload: async () => {
        journalEvents.push("journal-upload");
        repository.events.push("journal-upload");
      },
      recordCommittedMigration: async () => {
        journalEvents.push("journal-commit");
        repository.events.push("journal-commit");
      },
    },
  );

  assert.equal(applied.status, "migrated");
  assert.equal(repository.referenceValue, currentCandidate.intendedNewPath);
  assert.deepEqual(repository.uploadedOptions, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  assert.ok(
    repository.events.indexOf("upload") <
      repository.events.indexOf("guarded-update"),
  );
  assert.ok(
    repository.events.indexOf("journal-upload") <
      repository.events.indexOf("guarded-update"),
  );
  assert.deepEqual(journalEvents, ["journal-upload", "journal-commit"]);
  assert.equal(repository.deleteCalls, 0);
  assert.equal(
    repository.objects.has(
      `${currentCandidate.bucket}/${currentCandidate.path}`,
    ),
    true,
  );
});

test("DB failure leaves the old reference and reports the uploaded cleanup candidate", async () => {
  const currentCandidate = candidate();
  const repository = new FakeApplyRepository(currentCandidate);
  repository.dbFailure = true;

  const applied = await applyBackfillCandidate(
    currentCandidate,
    repository,
    async () => optimizedImage,
  );

  assert.equal(applied.status, "failed");
  assert.equal(applied.stage, "guarded-db-update");
  assert.equal(repository.referenceValue, currentCandidate.path);
  assert.equal(applied.cleanupCandidatePath, currentCandidate.intendedNewPath);
  assert.equal(repository.deleteCalls, 0);
});

test("concurrent DB change is reported without overwriting either reference", async () => {
  const currentCandidate = candidate();
  const repository = new FakeApplyRepository(currentCandidate);
  repository.conflict = true;

  const applied = await applyBackfillCandidate(
    currentCandidate,
    repository,
    async () => optimizedImage,
  );

  assert.equal(applied.status, "conflict");
  assert.equal(repository.referenceValue, currentCandidate.path);
  assert.equal(applied.cleanupCandidatePath, currentCandidate.intendedNewPath);
  assert.equal(repository.deleteCalls, 0);
});

test("failed post-update verification is fatal and stops the remaining run", async () => {
  const firstCandidate = candidate();
  const repository = new FakeApplyRepository(firstCandidate);
  repository.failPostUpdateVerification = true;
  let optimizeCalls = 0;

  const applied = await applyBackfillCandidates(
    [firstCandidate, candidate({ rowId: "row-2" })],
    repository,
    async () => {
      optimizeCalls += 1;
      return optimizedImage;
    },
  );

  assert.equal(applied.stopped, true);
  assert.equal(applied.results.length, 1);
  assert.equal(applied.results[0]?.status, "fatal");
  assert.equal(applied.results[0]?.stage, "verify-db-update");
  assert.equal(optimizeCalls, 1);
  assert.equal(repository.deleteCalls, 0);
});

test("idempotent discovery skips paths created by a prior backfill", async () => {
  const migratedPath =
    "service-options/1800000000000-abcdef123456-legacy-gallery.webp";
  const repository = new FakeDiscoveryRepository(
    [siteMediaRow({ id: "migrated", image_path: migratedPath })],
    [],
    new Map([
      [
        `site-media/${migratedPath}`,
        { size: TARGET_BYTES + 500_000, mimeType: "image/webp" },
      ],
    ]),
  );

  const discovery = await discoverBackfillCandidates(repository);
  assert.equal(discovery.candidates.length, 0);
  assert.equal(discovery.skipped[0]?.reason, "already-backfilled");
  assert.equal(repository.writes, 0);
});

test("cleanup report is read-only and checks all relevant references", async () => {
  const writes: string[] = [];
  const oldPath = "service-options/original.jpg";
  const panoramaReference: ExistingReference = {
    table: "site_media_items",
    rowId: "panorama-row",
    column: "panorama_image_path",
  };
  const repository: CleanupReportRepository = {
    async findReferences(_bucket, path) {
      return path === oldPath ? [panoramaReference] : [];
    },
    async getStorageObjectInfo() {
      return { size: TARGET_BYTES + 1, mimeType: "image/jpeg" };
    },
  };

  const report = await buildCleanupReport(repository, [
    {
      bucket: "site-media",
      oldPath,
      newPath:
        "service-options/1800000000000-abcdef123456-legacy-gallery.webp",
    },
  ]);

  assert.equal(report.safeCandidates.length, 0);
  assert.equal(report.retained[0]?.reason, "still-referenced");
  assert.equal(report.retained[0]?.references[0]?.column, "panorama_image_path");
  assert.deepEqual(writes, []);
});

test("Sharp optimizer produces WebP, never upscales, and honors max long side", async () => {
  const largeSource = await sharp({
    create: {
      width: 3000,
      height: 1000,
      channels: 3,
      background: { r: 40, g: 90, b: 130 },
    },
  })
    .png()
    .toBuffer();
  const optimizedLarge = await optimizeLegacyGalleryImage(
    largeSource,
    "image/png",
  );
  const largeMetadata = await sharp(optimizedLarge.bytes).metadata();
  assert.equal(largeMetadata.format, "webp");
  assert.equal(Math.max(largeMetadata.width ?? 0, largeMetadata.height ?? 0), 2800);

  const smallSource = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 120, g: 80, b: 60 },
    },
  })
    .jpeg()
    .toBuffer();
  const optimizedSmall = await optimizeLegacyGalleryImage(
    smallSource,
    "image/jpeg",
  );
  const smallMetadata = await sharp(optimizedSmall.bytes).metadata();
  assert.equal(smallMetadata.width, 800);
  assert.equal(smallMetadata.height, 600);
});

test("CLI defaults to dry-run and apply requires an explicit manifest", () => {
  assert.deepEqual(parseCliOptions([]), { mode: "dry-run", manifestPath: null });
  assert.deepEqual(parseCliOptions(["--dry-run"]), {
    mode: "dry-run",
    manifestPath: null,
  });
  assert.throws(() => parseCliOptions(["--apply"]), /requires --manifest/);
  assert.deepEqual(
    parseCliOptions(["--apply", "--manifest", "audit.json"]),
    { mode: "apply", manifestPath: "audit.json" },
  );
});
