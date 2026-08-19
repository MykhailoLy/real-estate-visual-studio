import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SQL = readFileSync("supabase/add-multi-reference-files.sql", "utf8");
const RUNBOOK = readFileSync(
  "docs/MULTI_REFERENCE_FILES_MIGRATION_RUNBOOK.md",
  "utf8",
);
const DRAFT_REFERENCE_SERVER = readFileSync(
  "src/lib/order-drafts/draft-reference-files-server.ts",
  "utf8",
);
const CLIENT_SOURCE_FILES = readFileSync("src/lib/client-source-files.ts", "utf8");

test("migration is additive and idempotent", () => {
  assert.match(SQL, /BEGIN;[\s\S]+COMMIT;/);
  assert.match(SQL, /CREATE TABLE IF NOT EXISTS public\.order_draft_item_reference_files/);
  assert.match(SQL, /CREATE TABLE IF NOT EXISTS public\.order_item_reference_files/);
  assert.equal(/DROP TABLE|DROP COLUMN|DROP CONSTRAINT/i.test(SQL), false);
  assert.match(SQL, /ON CONFLICT DO NOTHING/g);
  assert.match(SQL, /CREATE UNIQUE INDEX IF NOT EXISTS/g);
});

test("legacy draft and finalized references are backfilled at position zero", () => {
  assert.match(SQL, /FROM public\.order_draft_files AS files[\s\S]+files\.kind = 'reference'/);
  assert.match(SQL, /FROM public\.order_items AS items[\s\S]+items\.reference_image_path IS NOT NULL/);
  assert.match(SQL, /files\.id,[\s\S]+files\.id,[\s\S]+0,/);
});

test("positions, identities, storage paths and cascades are constrained", () => {
  assert.match(SQL, /CHECK \(position BETWEEN 0 AND 9\)/g);
  assert.match(SQL, /ON DELETE CASCADE/g);
  assert.match(SQL, /UNIQUE \(draft_id, item_client_id, reference_id\)/);
  assert.match(SQL, /UNIQUE \(order_item_id, reference_id\)/);
  assert.match(SQL, /UNIQUE \(order_item_id, position\)/);
  assert.match(SQL, /UNIQUE \(storage_path\)/g);
});

test("RLS mirrors existing authenticated ownership and service-role writes", () => {
  assert.match(SQL, /ALTER TABLE public\.order_draft_item_reference_files ENABLE ROW LEVEL SECURITY/);
  assert.match(SQL, /ALTER TABLE public\.order_item_reference_files ENABLE ROW LEVEL SECURITY/);
  assert.match(SQL, /order_drafts\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(SQL, /orders\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(SQL, /REVOKE ALL[\s\S]+FROM PUBLIC, anon, authenticated/g);
  assert.match(SQL, /GRANT SELECT, INSERT, UPDATE, DELETE[\s\S]+TO service_role/g);
});

test("legacy schema remains available to the pre-migration application", () => {
  assert.equal(SQL.includes("DROP INDEX IF EXISTS public.order_draft_files"), false);
  assert.equal(SQL.includes("DROP COLUMN reference_image_path"), false);
  assert.equal(SQL.includes("storage.buckets"), false);
  assert.match(SQL, /legacy order_draft_files\(kind = 'reference'\) rows remain valid/i);
  assert.match(SQL, /legacy order_items\.reference_image_path remains valid/i);
});

test("application dual-read falls back to legacy data without duplicating normalized references", () => {
  assert.match(CLIENT_SOURCE_FILES, /normalizedItemIds/);
  assert.match(
    CLIENT_SOURCE_FILES,
    /file\.kind === "original" \|\| !normalizedItemIds\.has\(file\.orderItemId\)/,
  );
});

test("first-reference legacy mirroring follows the next active position", () => {
  assert.match(DRAFT_REFERENCE_SERVER, /syncLegacyDraftReferenceMirror/);
  assert.match(DRAFT_REFERENCE_SERVER, /\.order\("position"\)[\s\S]+\.limit\(1\)/);
  assert.match(DRAFT_REFERENCE_SERVER, /kind: "reference"/);
  assert.match(DRAFT_REFERENCE_SERVER, /storage_path: next\.storage_path/);
});

test("removing the first reference compacts positions and refreshes the mirror", () => {
  assert.match(
    DRAFT_REFERENCE_SERVER,
    /upload_status: "deleted"[\s\S]+\.order\("position"\)[\s\S]+\.update\(\{ position \}\)[\s\S]+syncLegacyDraftReferenceMirror/,
  );
});

test("runbook defines manual rollout and read-only verification", () => {
  assert.match(RUNBOOK, /Apply `supabase\/add-multi-reference-files\.sql` manually/);
  assert.match(RUNBOOK, /Verify the existing production site still/);
  assert.match(RUNBOOK, /Backfill counts/);
  assert.match(RUNBOOK, /Duplicate detection/);
  assert.match(RUNBOOK, /Invalid positions/);
  assert.match(RUNBOOK, /Orphans/);
  assert.equal(/DROP TABLE|DELETE FROM|TRUNCATE/i.test(RUNBOOK), false);
});
