import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SQL = readFileSync("supabase/add-atomic-order-submissions.sql", "utf8");
const PHOTO_EDITING_COMPATIBILITY_SQL = readFileSync(
  "supabase/allow-photo-editing-draft-finalization.sql",
  "utf8",
);
const VIRTUAL_RENOVATION_COMPATIBILITY_SQL = readFileSync(
  "supabase/allow-virtual-renovation-draft-finalization.sql",
  "utf8",
);
const EMAIL_WORKER = readFileSync("src/lib/email/send-order-emails.ts", "utf8");
const WORKER_ROUTE = readFileSync("src/app/api/internal/order-email-outbox/route.ts", "utf8");
const CLIENT_SUBMIT = readFileSync("src/lib/submit-order.ts", "utf8");
const ORDER_ROUTE = readFileSync("src/app/(public)/api/order/route.ts", "utf8");
const RECOVERY_ROUTE = readFileSync(
  "src/app/(public)/api/order/submissions/[submissionId]/route.ts",
  "utf8",
);

function sqlSegment(
  sql: string,
  startMarker: string,
  endMarker: string,
): string {
  const normalized = sql.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(startMarker);
  assert.ok(start >= 0, `Missing SQL marker: ${startMarker}`);
  const end = normalized.indexOf(endMarker, start);
  assert.ok(end > start, `Missing SQL marker: ${endMarker}`);
  return normalized.slice(start, end);
}

function parsedDraftServiceRoutePairs(sql: string): Array<{
  serviceType: string;
  route: string;
}> {
  return Array.from(
    sql.matchAll(
      /v_draft\.service_type = '([^']+)'\s+AND v_draft\.route = '([^']+)'/g,
    ),
    (match) => ({ serviceType: match[1], route: match[2] }),
  );
}

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
  assert.match(body, /AS draft_references/);
  assert.doesNotMatch(body, /\bAS references\b/i);
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
  const pricingRejection = CLIENT_SUBMIT.slice(
    CLIENT_SUBMIT.indexOf('if (result.code === "pricing_changed")'),
    CLIENT_SUBMIT.indexOf('if (result.code === "submission_in_progress")'),
  );
  assert.match(pricingRejection, /errorCode: "pricing-changed"/);
  // A concurrent original request may still commit: pricing rejection of its
  // retry must not discard the logical ID. Executable recovery tests cover it.
  assert.doesNotMatch(pricingRejection, /clearOrderSubmissionRecord|clearRecordIfCurrent/);
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

test("draft compatibility commit guard binds source draft service to submission service", () => {
  const commitSql = sqlSegment(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  assert.match(
    commitSql,
    /v_draft\.service_type IS DISTINCT FROM v_submission\.service_type/,
  );
  const pairs = parsedDraftServiceRoutePairs(commitSql);
  assert.deepEqual(pairs, [
    {
      serviceType: "virtual-staging",
      route: "/dashboard/orders/new/virtual-staging",
    },
    {
      serviceType: "photo-editing",
      route: "/dashboard/orders/new/photo-editing",
    },
  ]);

  const compatible = (
    draftService: string,
    draftRoute: string,
    submissionService: string,
  ) =>
    draftService === submissionService &&
    pairs.some(
      (pair) =>
        pair.serviceType === draftService && pair.route === draftRoute,
    );
  assert.equal(
    compatible(
      "virtual-staging",
      "/dashboard/orders/new/virtual-staging",
      "virtual-staging",
    ),
    true,
  );
  assert.equal(
    compatible(
      "photo-editing",
      "/dashboard/orders/new/photo-editing",
      "photo-editing",
    ),
    true,
  );
  assert.equal(
    compatible(
      "photo-editing",
      "/dashboard/orders/new/photo-editing",
      "virtual-staging",
    ),
    false,
  );
  assert.equal(
    compatible(
      "photo-editing",
      "/dashboard/orders/new/virtual-staging",
      "photo-editing",
    ),
    false,
  );
});

test("draft compatibility migration preserves the existing atomic commit implementation", () => {
  const historical = sqlSegment(
    SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "CREATE OR REPLACE FUNCTION public.claim_order_email_deliveries(",
  ).trim();
  const migrated = sqlSegment(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  ).trim();
  const widenedGuard = `    IF NOT FOUND
       OR v_draft.user_id IS DISTINCT FROM p_user_id
       OR v_draft.service_type IS DISTINCT FROM v_submission.service_type
       OR NOT (
         (
           v_draft.service_type = 'virtual-staging'
           AND v_draft.route = '/dashboard/orders/new/virtual-staging'
         )
         OR
         (
           v_draft.service_type = 'photo-editing'
           AND v_draft.route = '/dashboard/orders/new/photo-editing'
         )
       )
       OR v_draft.version IS DISTINCT FROM p_draft_expected_version`;
  const historicalGuard = `    IF NOT FOUND
       OR v_draft.user_id IS DISTINCT FROM p_user_id
       OR v_draft.service_type IS DISTINCT FROM 'virtual-staging'
       OR v_draft.route IS DISTINCT FROM '/dashboard/orders/new/virtual-staging'
       OR v_draft.version IS DISTINCT FROM p_draft_expected_version`;
  assert.equal(migrated.replace(widenedGuard, historicalGuard), historical);
});

test("draft compatibility commit keeps invoker security and service-role-only grants", () => {
  const commitSql = sqlSegment(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  assert.match(
    commitSql,
    /LANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = pg_catalog, public/,
  );
  assert.doesNotMatch(commitSql, /SECURITY DEFINER/);
  assert.match(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    /REVOKE EXECUTE ON FUNCTION public\.commit_order_submission\([\s\S]+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    /GRANT EXECUTE ON FUNCTION public\.commit_order_submission\([\s\S]+TO service_role/,
  );
  assert.doesNotMatch(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    /GRANT EXECUTE ON FUNCTION public\.commit_order_submission\([\s\S]+TO (?:PUBLIC|anon|authenticated)/,
  );
});

test("draft compatibility commit leaves replay, moved files, email outbox and uniqueness contracts untouched", () => {
  const commitSql = sqlSegment(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  assert.match(commitSql, /v_submission\.status = 'committed'[\s\S]*'replayed'::TEXT/);
  assert.match(commitSql, /UPDATE public\.order_draft_files AS files[\s\S]*upload_status = 'moved'/);
  assert.match(commitSql, /INSERT INTO public\.order_email_deliveries/);
  assert.match(commitSql, /'client_confirmation'[\s\S]*'admin_notification'/);
  assert.doesNotMatch(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    /\b(CREATE|DROP)\s+(UNIQUE\s+)?INDEX\b/i,
  );
  assert.doesNotMatch(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    /orders_source_draft_id_unique/,
  );
});

test("Virtual Renovation commit guard binds the draft service to exactly three canonical routes", () => {
  const commitSql = sqlSegment(
    VIRTUAL_RENOVATION_COMPATIBILITY_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  assert.match(
    commitSql,
    /v_draft\.service_type IS DISTINCT FROM v_submission\.service_type/,
  );
  const pairs = parsedDraftServiceRoutePairs(commitSql);
  assert.deepEqual(pairs, [
    {
      serviceType: "virtual-staging",
      route: "/dashboard/orders/new/virtual-staging",
    },
    {
      serviceType: "photo-editing",
      route: "/dashboard/orders/new/photo-editing",
    },
    {
      serviceType: "virtual-renovation",
      route: "/dashboard/orders/new/virtual-renovation",
    },
  ]);

  const compatible = (
    draftService: string,
    draftRoute: string,
    submissionService: string,
  ) =>
    draftService === submissionService &&
    pairs.some(
      (pair) =>
        pair.serviceType === draftService && pair.route === draftRoute,
    );
  assert.equal(
    compatible(
      "virtual-staging",
      "/dashboard/orders/new/virtual-staging",
      "virtual-staging",
    ),
    true,
  );
  assert.equal(
    compatible(
      "photo-editing",
      "/dashboard/orders/new/photo-editing",
      "photo-editing",
    ),
    true,
  );
  assert.equal(
    compatible(
      "virtual-renovation",
      "/dashboard/orders/new/virtual-renovation",
      "virtual-renovation",
    ),
    true,
  );
  assert.equal(
    compatible(
      "virtual-renovation",
      "/dashboard/orders/new/virtual-renovation",
      "photo-editing",
    ),
    false,
  );
  assert.equal(
    compatible(
      "virtual-renovation",
      "/dashboard/orders/new/photo-editing",
      "virtual-renovation",
    ),
    false,
  );
  assert.equal(
    compatible(
      "photo-editing",
      "/dashboard/orders/new/virtual-renovation",
      "photo-editing",
    ),
    false,
  );
  assert.equal(
    compatible(
      "virtual-staging",
      "/dashboard/orders/new/virtual-renovation",
      "virtual-staging",
    ),
    false,
  );
});

test("Virtual Renovation commit migration changes only the additional allowlist branch", () => {
  const previousCommit = sqlSegment(
    PHOTO_EDITING_COMPATIBILITY_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  const migratedCommit = sqlSegment(
    VIRTUAL_RENOVATION_COMPATIBILITY_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  const virtualRenovationBranch = `
         OR
         (
           v_draft.service_type = 'virtual-renovation'
           AND v_draft.route = '/dashboard/orders/new/virtual-renovation'
         )`;
  assert.equal(migratedCommit.replace(virtualRenovationBranch, ""), previousCommit);
});

test("Virtual Renovation commit preserves security and atomic submission invariants", () => {
  const commitSql = sqlSegment(
    VIRTUAL_RENOVATION_COMPATIBILITY_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  assert.match(
    commitSql,
    /LANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = pg_catalog, public/,
  );
  assert.doesNotMatch(commitSql, /SECURITY DEFINER/);
  assert.match(
    VIRTUAL_RENOVATION_COMPATIBILITY_SQL,
    /REVOKE EXECUTE ON FUNCTION public\.commit_order_submission\([\s\S]+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    VIRTUAL_RENOVATION_COMPATIBILITY_SQL,
    /GRANT EXECUTE ON FUNCTION public\.commit_order_submission\([\s\S]+TO service_role/,
  );
  assert.doesNotMatch(
    VIRTUAL_RENOVATION_COMPATIBILITY_SQL,
    /GRANT EXECUTE ON FUNCTION public\.commit_order_submission\([\s\S]+TO (?:PUBLIC|anon|authenticated)/,
  );
  assert.match(
    commitSql,
    /stored authoritative pricing snapshot is inconsistent/,
  );
  assert.match(
    commitSql,
    /v_submission\.status = 'committed'[\s\S]*'replayed'::TEXT/,
  );
  assert.match(commitSql, /v_draft\.finalization_key IS DISTINCT FROM p_draft_finalization_key/);
  assert.match(
    commitSql,
    /UPDATE public\.order_draft_files AS files[\s\S]*upload_status = 'moved'/,
  );
  assert.match(commitSql, /UPDATE public\.order_draft_item_reference_files AS draft_references/);
  assert.match(commitSql, /SET status = 'converted'/);
  assert.match(commitSql, /source_draft_id/);
  assert.match(commitSql, /INSERT INTO public\.order_email_deliveries/);
  assert.match(commitSql, /'client_confirmation'[\s\S]*'admin_notification'/);
  assert.doesNotMatch(
    VIRTUAL_RENOVATION_COMPATIBILITY_SQL,
    /\b(CREATE|DROP)\s+(UNIQUE\s+)?INDEX\b/i,
  );
});
