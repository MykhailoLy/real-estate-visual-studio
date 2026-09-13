import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import {
  PRIVATE_IMAGE_PREVIEW_CACHE_CONTROL,
  PRIVATE_IMAGE_PREVIEW_MAX_DIMENSION,
  PRIVATE_IMAGE_PREVIEW_MAX_ORIGINAL_BYTES,
  PRIVATE_IMAGE_PREVIEW_WEBP_QUALITY,
  generatePrivateImagePreview,
  getOrCreatePrivateImagePreview,
  isPrivateImagePreviewEligible,
  type PrivateImagePreviewCandidate,
  type PrivatePreviewStorageClient,
} from "./private-image-preview.ts";
import { getPrivateImagePreviewPath } from "./private-image-preview-path.ts";

interface StoredObject {
  bytes: Buffer;
  contentType: string;
}

class FakeBucket {
  readonly objects = new Map<string, StoredObject>();
  readonly calls = { exists: 0, info: 0, download: 0, upload: 0 };
  failDownload = false;
  loseUploadRace = false;
  lastUploadOptions: Record<string, unknown> | null = null;

  async exists(path: string) {
    this.calls.exists += 1;
    return { data: this.objects.has(path), error: null };
  }

  async info(path: string) {
    this.calls.info += 1;
    const object = this.objects.get(path);
    return object
      ? {
          data: { size: object.bytes.byteLength, contentType: object.contentType },
          error: null,
        }
      : { data: null, error: new Error("not found") };
  }

  async download(path: string) {
    this.calls.download += 1;
    const object = this.objects.get(path);
    if (this.failDownload || !object) {
      return { data: null, error: new Error("download failed") };
    }
    const bytes = new Uint8Array(object.bytes.byteLength);
    bytes.set(object.bytes);
    return { data: new Blob([bytes]), error: null };
  }

  async upload(
    path: string,
    body: Uint8Array,
    options: { cacheControl: string; contentType: string; upsert: boolean },
  ) {
    this.calls.upload += 1;
    this.lastUploadOptions = options;
    if (this.loseUploadRace) {
      this.objects.set(path, {
        bytes: Buffer.from(body),
        contentType: options.contentType,
      });
      return { data: null, error: new Error("already exists") };
    }
    this.objects.set(path, {
      bytes: Buffer.from(body),
      contentType: options.contentType,
    });
    return { data: { path }, error: null };
  }
}

function storageClient(bucket: FakeBucket): PrivatePreviewStorageClient {
  return { storage: { from: () => bucket } };
}

function candidate(
  overrides: Partial<PrivateImagePreviewCandidate> = {},
): PrivateImagePreviewCandidate {
  return {
    storagePath: "PS-0042/0-original.jpg",
    filename: "living-room.jpg",
    mimeType: "image/jpeg",
    fileSize: 1024,
    ...overrides,
  };
}

test("preview paths are deterministic, opaque SHA-256 keys and remain path-safe", () => {
  const originalPath = "PS-0042/private-user/living-room.jpg";
  const originalFilename = "living-room.jpg";
  const first = getPrivateImagePreviewPath(originalPath);
  const repeated = getPrivateImagePreviewPath(originalPath);
  const distinct = getPrivateImagePreviewPath("PS-0042/a_b.jpg");
  const digest = first?.split("/").at(-1)?.replace(/\.webp$/, "") ?? "";

  assert.equal(first, repeated);
  assert.notEqual(first, distinct);
  assert.match(first ?? "", /^_previews\/v1\/[A-Za-z0-9_-]{43}\.webp$/);
  assert.equal(
    digest,
    createHash("sha256").update(originalPath, "utf8").digest("base64url"),
  );
  assert.equal(first?.includes(originalPath), false);
  for (const privateFragment of ["PS-0042", "private-user", originalFilename]) {
    assert.equal(first?.includes(privateFragment), false);
  }
  assert.notEqual(Buffer.from(digest, "base64url").toString("utf8"), originalPath);
  assert.notDeepEqual(Buffer.from(digest, "base64url"), Buffer.from(originalPath));
  assert.equal(getPrivateImagePreviewPath("../outside.jpg"), null);
  assert.equal(getPrivateImagePreviewPath("/absolute.jpg"), null);
  assert.equal(getPrivateImagePreviewPath("_previews/v1/already.webp"), null);
});

test("only safe JPEG, PNG, and WebP candidates within 25 MiB are eligible", () => {
  assert.equal(isPrivateImagePreviewEligible(candidate()), true);
  assert.equal(
    isPrivateImagePreviewEligible(
      candidate({ storagePath: "PS-0042/image.png", filename: "image.png", mimeType: "image/png" }),
    ),
    true,
  );
  assert.equal(
    isPrivateImagePreviewEligible(
      candidate({ storagePath: "PS-0042/image.webp", filename: "image.webp", mimeType: "image/webp" }),
    ),
    true,
  );
  assert.equal(
    isPrivateImagePreviewEligible(
      candidate({ storagePath: "PS-0042/plan.pdf", filename: "plan.pdf", mimeType: "application/pdf" }),
    ),
    false,
  );
  assert.equal(
    isPrivateImagePreviewEligible(
      candidate({ storagePath: "PS-0042/files.zip", filename: "files.zip", mimeType: "application/zip" }),
    ),
    false,
  );
  assert.equal(
    isPrivateImagePreviewEligible(candidate({ fileSize: PRIVATE_IMAGE_PREVIEW_MAX_ORIGINAL_BYTES + 1 })),
    false,
  );
  assert.equal(
    isPrivateImagePreviewEligible(candidate({ storagePath: "PS-0042/../image.jpg" })),
    false,
  );
});

test("Sharp emits contained WebP previews at quality 82 without enlargement", async () => {
  assert.equal(PRIVATE_IMAGE_PREVIEW_MAX_DIMENSION, 2048);
  assert.equal(PRIVATE_IMAGE_PREVIEW_WEBP_QUALITY, 82);
  const sourceText = readFileSync("src/lib/private-image-preview.ts", "utf8");
  assert.match(sourceText, /\.rotate\(\)/);
  assert.match(sourceText, /fit: "inside"/);
  assert.match(sourceText, /withoutEnlargement: true/);
  assert.match(sourceText, /\.webp\(\{ quality: PRIVATE_IMAGE_PREVIEW_WEBP_QUALITY \}\)/);

  const large = await sharp({
    create: {
      width: 3000,
      height: 1000,
      channels: 3,
      background: { r: 34, g: 95, b: 140 },
    },
  }).png().toBuffer();
  const largePreview = await generatePrivateImagePreview(large);
  const largeMetadata = await sharp(largePreview).metadata();
  assert.equal(largeMetadata.format, "webp");
  assert.equal(largeMetadata.width, 2048);
  assert.equal(largeMetadata.height, 683);

  const small = await sharp({
    create: {
      width: 320,
      height: 180,
      channels: 3,
      background: { r: 190, g: 170, b: 120 },
    },
  }).jpeg().toBuffer();
  const smallMetadata = await sharp(await generatePrivateImagePreview(small)).metadata();
  assert.equal(smallMetadata.width, 320);
  assert.equal(smallMetadata.height, 180);
});

test("Sharp respects EXIF orientation and strips source metadata", async () => {
  const oriented = await sharp({
    create: {
      width: 100,
      height: 200,
      channels: 3,
      background: { r: 20, g: 40, b: 60 },
    },
  }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const metadata = await sharp(await generatePrivateImagePreview(oriented)).metadata();
  assert.equal(metadata.width, 200);
  assert.equal(metadata.height, 100);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
});

test("an existing preview is reused without reading or downloading the original", async () => {
  const bucket = new FakeBucket();
  const previewPath = getPrivateImagePreviewPath("PS-0042/0-original.jpg")!;
  bucket.objects.set(previewPath, {
    bytes: Buffer.from("preview"),
    contentType: "image/webp",
  });

  assert.equal(
    await getOrCreatePrivateImagePreview(storageClient(bucket), "order-files", candidate()),
    previewPath,
  );
  assert.deepEqual(bucket.calls, { exists: 1, info: 0, download: 0, upload: 0 });
});

test("a missing preview is generated once with immutable cache metadata", async () => {
  const bucket = new FakeBucket();
  const original = await sharp({
    create: {
      width: 2400,
      height: 1600,
      channels: 3,
      background: { r: 80, g: 120, b: 160 },
    },
  }).jpeg({ quality: 95 }).toBuffer();
  bucket.objects.set("PS-0042/0-original.jpg", {
    bytes: original,
    contentType: "image/jpeg",
  });

  const previewPath = await getOrCreatePrivateImagePreview(
    storageClient(bucket),
    "order-files",
    candidate({ fileSize: original.byteLength }),
  );
  assert.equal(previewPath, getPrivateImagePreviewPath("PS-0042/0-original.jpg"));
  assert.equal(bucket.calls.download, 1);
  assert.equal(bucket.calls.upload, 1);
  assert.deepEqual(bucket.lastUploadOptions, {
    cacheControl: PRIVATE_IMAGE_PREVIEW_CACHE_CONTROL,
    contentType: "image/webp",
    upsert: false,
  });

  const stored = bucket.objects.get(previewPath!);
  assert.ok(stored);
  const metadata = await sharp(stored.bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok((metadata.width ?? Infinity) <= PRIVATE_IMAGE_PREVIEW_MAX_DIMENSION);
  assert.ok((metadata.height ?? Infinity) <= PRIVATE_IMAGE_PREVIEW_MAX_DIMENSION);
});

test("historical candidates with missing DB metadata use Storage info", async () => {
  const bucket = new FakeBucket();
  const original = await sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  }).png().toBuffer();
  bucket.objects.set("PS-0042/0-original.jpg", {
    bytes: original,
    contentType: "image/jpeg",
  });

  const previewPath = await getOrCreatePrivateImagePreview(
    storageClient(bucket),
    "order-files",
    candidate({ fileSize: null, mimeType: null }),
  );
  assert.ok(previewPath);
  assert.ok(bucket.calls.info >= 1);
  assert.equal(bucket.calls.upload, 1);
});

test("generation failure returns null so routes can fall back to the original", async () => {
  const bucket = new FakeBucket();
  bucket.objects.set("PS-0042/0-original.jpg", {
    bytes: Buffer.from("not needed"),
    contentType: "image/jpeg",
  });
  bucket.failDownload = true;

  assert.equal(
    await getOrCreatePrivateImagePreview(storageClient(bucket), "order-files", candidate()),
    null,
  );
});

test("a simultaneous create loser reuses the deterministic winning preview", async () => {
  const bucket = new FakeBucket();
  const original = await sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  }).jpeg().toBuffer();
  bucket.objects.set("PS-0042/0-original.jpg", {
    bytes: original,
    contentType: "image/jpeg",
  });
  bucket.loseUploadRace = true;

  const previewPath = await getOrCreatePrivateImagePreview(
    storageClient(bucket),
    "order-files",
    candidate({ fileSize: original.byteLength }),
  );
  assert.equal(previewPath, getPrivateImagePreviewPath("PS-0042/0-original.jpg"));
  assert.equal(bucket.calls.exists, 2);
});
