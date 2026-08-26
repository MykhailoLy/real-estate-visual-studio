import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const PREVIOUS_SQL = readFileSync(
  "supabase/allow-virtual-renovation-draft-finalization.sql",
  "utf8",
);
const FLOOR_PLAN_SQL = readFileSync(
  "supabase/allow-floor-plan-draft-finalization.sql",
  "utf8",
);
const FLOOR_PLAN_PAGE = readFileSync(
  "src/app/(dashboard)/dashboard/orders/new/3d-floor-plans/page.tsx",
  "utf8",
);

function sourceSlice(source: string, startMarker: string, endMarker: string): string {
  const normalized = source.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = normalized.indexOf(endMarker, start);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
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

const EXPECTED_PAIRS = [
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
  {
    serviceType: "3d-floor-plans",
    route: "/dashboard/orders/new/3d-floor-plans",
  },
];

test("Floor Plans compatibility migration replaces only the two approved RPCs", () => {
  const replacedFunctions = Array.from(
    FLOOR_PLAN_SQL.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_]+)\(/g),
    (match) => match[1],
  );
  assert.deepEqual(replacedFunctions, [
    "claim_order_draft_finalization",
    "commit_order_submission",
  ]);

  let outsideFunctions = FLOOR_PLAN_SQL.replace(/\r\n/g, "\n");
  for (const functionName of replacedFunctions) {
    const start = outsideFunctions.indexOf(
      `CREATE OR REPLACE FUNCTION public.${functionName}`,
    );
    assert.ok(start >= 0, `${functionName} must exist`);
    const end = outsideFunctions.indexOf("$$;", start);
    assert.ok(end > start, `${functionName} must terminate`);
    outsideFunctions =
      outsideFunctions.slice(0, start) + outsideFunctions.slice(end + 3);
  }

  assert.doesNotMatch(
    outsideFunctions,
    /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|TRIGGER|POLICY|SCHEMA)\b/i,
  );
  assert.doesNotMatch(outsideFunctions, /\bENABLE ROW LEVEL SECURITY\b/i);
  assert.doesNotMatch(
    outsideFunctions,
    /\b(INSERT INTO|UPDATE|DELETE FROM)\s+public\./i,
  );
});

test("Floor Plans canonical route is proven by the current dashboard page", () => {
  assert.match(
    FLOOR_PLAN_PAGE,
    /const ORDER_ROUTE = "\/dashboard\/orders\/new\/3d-floor-plans"/,
  );
  assert.match(
    FLOOR_PLAN_PAGE,
    /<FloorPlansOrderForm clientEmail=\{email\} orderRoute=\{ORDER_ROUTE\} \/>/,
  );
});

test("Floor Plans claim allowlist accepts exactly four canonical service-route pairs", () => {
  const claimSql = sourceSlice(
    FLOOR_PLAN_SQL,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  );
  assert.deepEqual(parsedDraftServiceRoutePairs(claimSql), EXPECTED_PAIRS);
  assert.match(
    claimSql,
    /LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = pg_catalog, public/,
  );
  assert.match(
    claimSql,
    /REVOKE ALL ON FUNCTION public\.claim_order_draft_finalization\([\s\S]+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    claimSql,
    /GRANT EXECUTE ON FUNCTION public\.claim_order_draft_finalization\([\s\S]+TO service_role/,
  );
  assert.doesNotMatch(
    claimSql,
    /GRANT EXECUTE[\s\S]+TO (?:PUBLIC|anon|authenticated)/,
  );
});

test("Floor Plans claim migration changes only the additional allowlist branch", () => {
  const previousClaim = sourceSlice(
    PREVIOUS_SQL,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  );
  const migratedClaim = sourceSlice(
    FLOOR_PLAN_SQL,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  );
  const floorPlanBranch = `
    OR
    (
      v_draft.service_type = '3d-floor-plans'
      AND v_draft.route = '/dashboard/orders/new/3d-floor-plans'
    )`;
  assert.equal(migratedClaim.replace(floorPlanBranch, ""), previousClaim);
});

test("Floor Plans commit guard accepts exactly four canonical service-route pairs", () => {
  const commitSql = sourceSlice(
    FLOOR_PLAN_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  assert.match(
    commitSql,
    /v_draft\.service_type IS DISTINCT FROM v_submission\.service_type/,
  );
  assert.deepEqual(parsedDraftServiceRoutePairs(commitSql), EXPECTED_PAIRS);
});

test("Floor Plans commit migration changes only the additional allowlist branch", () => {
  const previousCommit = sourceSlice(
    PREVIOUS_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  const migratedCommit = sourceSlice(
    FLOOR_PLAN_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  const floorPlanBranch = `
         OR
         (
           v_draft.service_type = '3d-floor-plans'
           AND v_draft.route = '/dashboard/orders/new/3d-floor-plans'
         )`;
  assert.equal(migratedCommit.replace(floorPlanBranch, ""), previousCommit);
});

test("Floor Plans commit preserves security and atomic submission invariants", () => {
  const commitSql = sourceSlice(
    FLOOR_PLAN_SQL,
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
    "REVOKE EXECUTE ON FUNCTION public.commit_order_submission(",
  );
  assert.match(
    commitSql,
    /LANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = pg_catalog, public/,
  );
  assert.doesNotMatch(commitSql, /SECURITY DEFINER/);
  assert.match(
    FLOOR_PLAN_SQL,
    /REVOKE EXECUTE ON FUNCTION public\.commit_order_submission\([\s\S]+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    FLOOR_PLAN_SQL,
    /GRANT EXECUTE ON FUNCTION public\.commit_order_submission\([\s\S]+TO service_role/,
  );
  assert.doesNotMatch(
    FLOOR_PLAN_SQL,
    /GRANT EXECUTE ON FUNCTION public\.commit_order_submission\([\s\S]+TO (?:PUBLIC|anon|authenticated)/,
  );
  assert.match(commitSql, /stored authoritative pricing snapshot is inconsistent/);
  assert.match(commitSql, /v_submission\.status = 'committed'[\s\S]*'replayed'::TEXT/);
  assert.match(
    commitSql,
    /v_draft\.finalization_key IS DISTINCT FROM p_draft_finalization_key/,
  );
  assert.match(
    commitSql,
    /UPDATE public\.order_draft_files AS files[\s\S]*upload_status = 'moved'/,
  );
  assert.match(
    commitSql,
    /UPDATE public\.order_draft_item_reference_files AS draft_references/,
  );
  assert.match(commitSql, /SET status = 'converted'/);
  assert.match(commitSql, /source_draft_id/);
  assert.match(commitSql, /INSERT INTO public\.order_email_deliveries/);
  assert.match(commitSql, /'client_confirmation'[\s\S]*'admin_notification'/);
  assert.doesNotMatch(
    FLOOR_PLAN_SQL,
    /\b(CREATE|DROP)\s+(UNIQUE\s+)?INDEX\b/i,
  );
});
