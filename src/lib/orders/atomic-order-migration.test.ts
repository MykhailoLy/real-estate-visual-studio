import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SQL = readFileSync("supabase/add-atomic-order-submissions.sql", "utf8");
const EMAIL_WORKER = readFileSync("src/lib/email/send-order-emails.ts", "utf8");
const WORKER_ROUTE = readFileSync("src/app/api/internal/order-email-outbox/route.ts", "utf8");
const CLIENT_SUBMIT = readFileSync("src/lib/submit-order.ts", "utf8");
const ORDER_ROUTE = readFileSync("src/app/(public)/api/order/route.ts", "utf8");
const RECOVERY_ROUTE = readFileSync(
  "src/app/(public)/api/order/submissions/[submissionId]/route.ts",
  "utf8",
);

test("migration is additive and creates a durable submission ledger", () => {
  assert.match(SQL, /CREATE TABLE IF NOT EXISTS public\.order_submissions/);
  assert.match(SQL, /submission_id UUID PRIMARY KEY/);
  assert.match(SQL, /request_hash TEXT NOT NULL/);
  assert.match(SQL, /pricing_version TEXT NOT NULL/);
  assert.match(SQL, /quote_hash TEXT NOT NULL/);
  assert.match(SQL, /reserved_order_id UUID NOT NULL UNIQUE/);
  assert.match(SQL, /order_id UUID NULL UNIQUE/);
  assert.doesNotMatch(SQL, /UPDATE public\.orders[\s\S]*SET submission_id/);
});

test("all integrity RPCs are invoker-only and service-role-only", () => {
  for (const name of [
    "claim_order_submission",
    "release_order_submission",
    "commit_order_submission",
    "claim_order_email_deliveries",
    "complete_order_email_delivery",
  ]) {
    const start = SQL.indexOf(`FUNCTION public.${name}`);
    assert.notEqual(start, -1, `${name} must exist`);
    const body = SQL.slice(start, SQL.indexOf("$$;", start) + 3);
    assert.match(body, /SECURITY INVOKER/);
    assert.doesNotMatch(body, /SECURITY DEFINER/);
  }
  assert.match(SQL, /REVOKE EXECUTE ON FUNCTION public\.commit_order_submission[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(SQL, /GRANT EXECUTE ON FUNCTION public\.commit_order_submission[\s\S]*TO service_role/);
  assert.match(SQL, /ALTER TABLE public\.order_submissions ENABLE ROW LEVEL SECURITY/);
});

test("claim covers replay, concurrency, payload conflicts and quote changes", () => {
  assert.match(SQL, /pg_advisory_xact_lock/);
  assert.match(SQL, /v_submission\.status = 'committed'[\s\S]*'committed'::TEXT/);
  assert.match(SQL, /request_hash IS DISTINCT FROM p_request_hash[\s\S]*'payload_conflict'::TEXT/);
  assert.match(SQL, /quote_hash IS DISTINCT FROM p_quote_hash[\s\S]*'pricing_changed'::TEXT/);
  assert.match(SQL, /lease_expires_at > pg_catalog\.now\(\)[\s\S]*'in_progress'::TEXT/);
  assert.match(SQL, /user_id IS DISTINCT FROM p_user_id[\s\S]*'not_found'::TEXT/);
});

test("one RPC owns order, item, reference, snapshot and draft persistence", () => {
  const start = SQL.indexOf("FUNCTION public.commit_order_submission");
  const body = SQL.slice(start, SQL.indexOf("$$;", start));
  assert.match(body, /INSERT INTO public\.orders/);
  assert.match(body, /v_submission\.pricing_snapshot/);
  assert.match(body, /INSERT INTO public\.order_items/);
  assert.match(body, /INSERT INTO public\.order_item_reference_files/);
  assert.match(body, /order item subtotal does not match authoritative pricing snapshot/);
  assert.match(body, /UPDATE public\.order_draft_files/);
  assert.match(body, /UPDATE public\.order_drafts/);
  assert.match(body, /SET status = 'converted'/);
});

test("first commit creates exactly two minimal durable email deliveries", () => {
  assert.match(SQL, /CREATE TABLE IF NOT EXISTS public\.order_email_deliveries/);
  assert.match(SQL, /UNIQUE \(order_id, delivery_kind\)/);
  assert.match(SQL, /'client_confirmation'[\s\S]*'admin_notification'/);
  assert.match(SQL, /order-created-' \|\| v_submission\.reserved_order_id::TEXT \|\| '-client-v1'/);
  assert.match(SQL, /idempotency_expires_at[\s\S]*interval '24 hours'/);
  const table = SQL.slice(
    SQL.indexOf("CREATE TABLE IF NOT EXISTS public.order_email_deliveries"),
    SQL.indexOf(");", SQL.indexOf("CREATE TABLE IF NOT EXISTS public.order_email_deliveries")) + 2,
  );
  assert.doesNotMatch(table, /html|body|signed_url|secret/i);
});

test("unknown email outcomes are reclaimable only inside the key window", () => {
  const start = SQL.indexOf("FUNCTION public.claim_order_email_deliveries");
  const body = SQL.slice(start, SQL.indexOf("$$;", start));
  assert.match(body, /status IN \('unknown', 'sending'\)/);
  assert.match(body, /idempotency_expires_at > pg_catalog\.now\(\)/);
  assert.match(body, /attempt_count < 3/);
  assert.match(body, /p_order_id IS NULL OR deliveries\.order_id = p_order_id/);
  assert.match(SQL, /deliveries\.payload_hash IS NULL[\s\S]*deliveries\.payload_hash IS NOT DISTINCT FROM p_payload_hash/);
});

test("email sends use deterministic provider keys and exact payload hashes", () => {
  assert.match(EMAIL_WORKER, /sha256Canonical\(payload\.value\)/);
  assert.match(EMAIL_WORKER, /idempotencyKey: delivery\.idempotency_key/);
  assert.match(EMAIL_WORKER, /delivery\.payload_hash !== payloadHash/);
  assert.match(EMAIL_WORKER, /status: "unknown"|"unknown", payloadHash/);
  assert.doesNotMatch(EMAIL_WORKER, /createSignedUrl/);
});

test("future outbox worker is secret-protected and has no schedule side effect", () => {
  assert.match(WORKER_ROUTE, /process\.env\.CRON_SECRET/);
  assert.match(WORKER_ROUTE, /timingSafeEqual/);
  assert.match(WORKER_ROUTE, /export async function POST/);
});

test("client preserves one UUID and upload namespace across ambiguous retries", () => {
  assert.match(CLIENT_SUBMIT, /submissionId: crypto\.randomUUID\(\)/);
  assert.match(CLIENT_SUBMIT, /pendingTokenForSubmissionId\(record\.submissionId\)/);
  assert.match(CLIENT_SUBMIT, /previous\?\.intentHash === intentHash/);
  assert.match(CLIENT_SUBMIT, /record\.stage = "ambiguous"/);
  assert.match(CLIENT_SUBMIT, /previous\.stage === "ambiguous"/);
  assert.match(CLIENT_SUBMIT, /submissionId: record\.submissionId/);
  assert.match(CLIENT_SUBMIT, /result\.code === "pricing_changed"[\s\S]*removeSubmissionRecord/);
});

test("API has explicit create, replay, conflict, upgrade and owned recovery contracts", () => {
  assert.match(ORDER_ROUTE, /client_upgrade_required/);
  assert.match(ORDER_ROUTE, /status: result\.replayed \? 200 : 201/);
  assert.match(ORDER_ROUTE, /submission_in_progress/);
  assert.match(ORDER_ROUTE, /submission_payload_conflict/);
  assert.match(ORDER_ROUTE, /submission_unavailable/);
  assert.match(ORDER_ROUTE, /recoveryPath/);
  assert.match(ORDER_ROUTE, /newSubmissionIdRequired: true/);
  assert.match(ORDER_ROUTE, /currentPricingSnapshot/);
  assert.match(RECOVERY_ROUTE, /\.eq\("user_id", user\.id\)/);
  assert.match(RECOVERY_ROUTE, /status: "unavailable"/);
  assert.match(RECOVERY_ROUTE, /status: 404/);
  assert.doesNotMatch(RECOVERY_ROUTE, /storage_path|original_photo_path|reference_image_path/);
});
