import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SQL = readFileSync(
  "supabase/20260909191236_add_deliverable_review_file_upload_status.sql",
  "utf8",
);
const MANIFEST = readFileSync("supabase/MIGRATION_MANIFEST.md", "utf8");

test("F-001 migration is manual, additive, and re-runnable", () => {
  assert.match(SQL, /MANUAL MIGRATION ONLY/);
  assert.match(SQL, /^BEGIN;/m);
  assert.match(SQL, /^COMMIT;/m);
  assert.match(
    SQL,
    /ADD COLUMN IF NOT EXISTS upload_status TEXT/,
  );
  assert.match(
    SQL,
    /IF NOT EXISTS \([\s\S]*deliverable_review_files_upload_status_allowed/,
  );
  assert.doesNotMatch(SQL, /\b(?:DROP|DELETE|TRUNCATE)\b/i);
  assert.doesNotMatch(SQL, /storage\.(?:objects|buckets)/i);
  assert.doesNotMatch(SQL, /\b(?:CREATE|ALTER|DROP) POLICY\b/i);
});

test("F-001 migration allows exactly pending and uploaded lifecycle values", () => {
  assert.match(
    SQL,
    /CHECK \(upload_status IN \('pending', 'uploaded'\)\) NOT VALID/,
  );
  assert.match(
    SQL,
    /VALIDATE CONSTRAINT deliverable_review_files_upload_status_allowed/,
  );
  assert.match(SQL, /ALTER COLUMN upload_status SET NOT NULL/);
});

test("historical rows and the Phase 1 compatibility default remain uploaded", () => {
  assert.match(
    SQL,
    /UPDATE public\.deliverable_review_files\s+SET upload_status = 'uploaded'\s+WHERE upload_status IS NULL/,
  );
  assert.match(SQL, /ALTER COLUMN upload_status SET DEFAULT 'uploaded'/);
});

test("the future Phase 2 contract is documented", () => {
  assert.match(MANIFEST, /new rework-file rows explicitly use `pending`/);
  assert.match(MANIFEST, /server-side Storage verification/);
  assert.match(MANIFEST, /list\/read paths expose only `uploaded` rows/);
  assert.match(MANIFEST, /historical `uploaded` rows visible/i);
  assert.match(MANIFEST, /stale-pending cleanup as separate future work/i);
  assert.match(MANIFEST, /not the desired long-term fail-safe default/i);
  assert.match(MANIFEST, /change the default to `pending` or remove the default/i);
});
