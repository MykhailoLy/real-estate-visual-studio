import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parsePrivatePreviewBackfillMode } from "./backfill-private-image-previews.ts";

test("private preview backfill defaults to dry-run and requires an explicit apply flag", () => {
  assert.equal(parsePrivatePreviewBackfillMode([]), "dry-run");
  assert.equal(parsePrivatePreviewBackfillMode(["--dry-run"]), "dry-run");
  assert.equal(parsePrivatePreviewBackfillMode(["--apply"]), "apply");
  assert.throws(
    () => parsePrivatePreviewBackfillMode(["--dry-run", "--apply"]),
    /Choose exactly one mode/,
  );
});

test("apply mode is guarded and dry-run output is aggregate-only", () => {
  const source = readFileSync("scripts/backfill-private-image-previews.ts", "utf8");
  assert.match(source, /PRIVATE_IMAGE_PREVIEW_BACKFILL_CONFIRM/);
  assert.match(source, /eligible source images/);
  assert.match(source, /eligible deliverables/);
  assert.match(source, /existing previews/);
  assert.match(source, /missing previews/);
  assert.match(source, /skipped files/);
  assert.match(source, /failed candidates/);
  assert.doesNotMatch(source, /console\.(?:log|table)\([^\n]*(?:storagePath|filename|signedUrl)/);
  assert.doesNotMatch(source, /Buffer\.from\([^\n]*storagePath/);
});
