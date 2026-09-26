import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "./rework-submission.test.ts";
import "../components/dashboard/deliverable-rework-submit.test.ts";
import { REWORK_REFERENCES_MAX_FILES } from "./rework-references-config.ts";

const F7_SQL = readFileSync("supabase/migrations/20260926134104_f7_atomic_rework_submission.sql", "utf8");

test("F7 manual migration changes only the two required invoker functions and their grants", () => {
  assert.match(F7_SQL, /MANUAL MIGRATION ONLY/);
  assert.match(F7_SQL, /^BEGIN;/m); assert.match(F7_SQL, /^COMMIT;/m);
  assert.equal((F7_SQL.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length, 2);
  assert.equal((F7_SQL.match(/LANGUAGE plpgsql SECURITY INVOKER/g) ?? []).length, 2);
  assert.equal((F7_SQL.match(/SET search_path = pg_catalog, public/g) ?? []).length, 2);
  assert.doesNotMatch(F7_SQL, /(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|POLICY|TRIGGER)|storage\.(?:objects|buckets)/i);
  for (const signature of ["prepare_rework_reference_file_upload(uuid, uuid, text, text, bigint, text)", "finalize_rework_review_submission(uuid, integer)"]) {
    assert.ok(F7_SQL.includes(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`));
    assert.ok(F7_SQL.includes(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`));
  }
});

test("F7 SQL limits match the application and both functions lock the same strict parent state", () => {
  assert.ok(F7_SQL.includes(`>= ${REWORK_REFERENCES_MAX_FILES} THEN`));
  assert.ok(F7_SQL.includes(`NOT BETWEEN 1 AND ${REWORK_REFERENCES_MAX_FILES} THEN`));
  assert.equal((F7_SQL.match(/WHERE id = p_review_id FOR UPDATE/g) ?? []).length, 2);
  assert.equal((F7_SQL.match(/v_review.status <> 'pending_review'/g) ?? []).length, 2);
  assert.match(F7_SQL, /v_total <> p_expected_file_count OR v_uploaded <> p_expected_file_count OR v_pending <> 0/);
  assert.match(F7_SQL, /deliverable_reviews_one_active_rework/);
});

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
