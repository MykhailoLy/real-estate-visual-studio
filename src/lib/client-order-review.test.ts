import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  submitClientOrderReview,
  type ClientOrderReview,
  type ClientOrderReviewCreateOutcome,
  type ClientOrderReviewRepository,
} from "./client-order-review.ts";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OWNERSHIP = { userId: USER_ID, email: "owner@example.com" };

function savedReview(rating: number, comment: string | null): ClientOrderReview {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    order_id: ORDER_ID,
    user_id: USER_ID,
    rating,
    comment,
    created_at: "2026-09-12T11:00:00.000Z",
  };
}

function repository(
  outcome: ClientOrderReviewCreateOutcome,
  captured: Array<Record<string, unknown>> = [],
): ClientOrderReviewRepository {
  return {
    async createIfEligible(input) {
      captured.push(input);
      return outcome;
    },
  };
}

test("accepts every integer rating from 1 through 5", async () => {
  for (let rating = 1; rating <= 5; rating += 1) {
    const review = savedReview(rating, null);
    const result = await submitClientOrderReview(
      { orderId: ORDER_ID, rating },
      OWNERSHIP,
      repository({ outcome: "created", review }),
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.review.rating, rating);
  }
});

test("rejects missing, fractional, and out-of-range ratings before persistence", async () => {
  let calls = 0;
  const repo: ClientOrderReviewRepository = {
    async createIfEligible() {
      calls += 1;
      return { outcome: "duplicate" };
    },
  };

  for (const rating of [undefined, 0, 1.5, 6]) {
    const result = await submitClientOrderReview(
      { orderId: ORDER_ID, rating: rating as number },
      OWNERSHIP,
      repo,
    );
    assert.deepEqual(result, {
      ok: false,
      error: "Rating must be an integer between 1 and 5.",
      status: 400,
    });
  }
  assert.equal(calls, 0);
});

test("maps unauthorized or missing orders to the same 404 response", async () => {
  const result = await submitClientOrderReview(
    { orderId: ORDER_ID, rating: 5 },
    OWNERSHIP,
    repository({ outcome: "not_found" }),
  );
  assert.deepEqual(result, { ok: false, error: "Order not found.", status: 404 });
});

test("rejects reviews before delivery", async () => {
  const result = await submitClientOrderReview(
    { orderId: ORDER_ID, rating: 4 },
    OWNERSHIP,
    repository({ outcome: "not_delivered" }),
  );
  assert.deepEqual(result, {
    ok: false,
    error: "Reviews are available after delivery.",
    status: 409,
  });
});

for (const status of ["rework_requested", "rework_in_progress"] as const) {
  test(`rejects a delivered order while ${status} is active`, async () => {
    const result = await submitClientOrderReview(
      { orderId: ORDER_ID, rating: 4 },
      OWNERSHIP,
      repository({ outcome: "active_rework" }),
    );
    assert.deepEqual(result, {
      ok: false,
      error: "Complete the active rework before submitting a review.",
      status: 409,
    });
  });
}

for (const status of ["rework_delivered", "resolved", "approved"] as const) {
  test(`allows a delivered order after rework is ${status}`, async () => {
    const review = savedReview(5, null);
    const result = await submitClientOrderReview(
      { orderId: ORDER_ID, rating: 5 },
      OWNERSHIP,
      repository({ outcome: "created", review }),
    );
    assert.deepEqual(result, { ok: true, review });
  });
}

test("rejects a delivered order with zero valid deliverables", async () => {
  const result = await submitClientOrderReview(
    { orderId: ORDER_ID, rating: 4 },
    OWNERSHIP,
    repository({ outcome: "no_deliverables" }),
  );
  assert.deepEqual(result, {
    ok: false,
    error: "A review requires at least one delivered file.",
    status: 409,
  });
});

test("rejects a duplicate review", async () => {
  const result = await submitClientOrderReview(
    { orderId: ORDER_ID, rating: 4 },
    OWNERSHIP,
    repository({ outcome: "duplicate" }),
  );
  assert.deepEqual(result, {
    ok: false,
    error: "A review has already been submitted for this order.",
    status: 409,
  });
});

test("valid owner submission uses verified identity and normalizes the comment", async () => {
  const captured: Array<Record<string, unknown>> = [];
  const review = savedReview(5, "Excellent work.");
  const result = await submitClientOrderReview(
    { orderId: ORDER_ID, rating: 5, comment: "  Excellent work.  " },
    OWNERSHIP,
    repository({ outcome: "created", review }, captured),
  );

  assert.deepEqual(result, { ok: true, review });
  assert.deepEqual(captured, [
    {
      orderId: ORDER_ID,
      userId: USER_ID,
      userEmail: OWNERSHIP.email,
      rating: 5,
      comment: "Excellent work.",
    },
  ]);
});

test("comment is optional and blank feedback is stored as null", async () => {
  const captured: Array<Record<string, unknown>> = [];
  const result = await submitClientOrderReview(
    { orderId: ORDER_ID, rating: 3, comment: "   " },
    OWNERSHIP,
    repository(
      { outcome: "created", review: savedReview(3, null) },
      captured,
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(captured[0]?.comment, null);
});

test("migration enforces immutable server-only ownership, status, rating, and duplicate guards", () => {
  const sql = readFileSync(
    "supabase/20260912110000_add_client_order_reviews.sql",
    "utf8",
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.client_order_reviews/);
  assert.match(
    sql,
    /order_id UUID NOT NULL\s+REFERENCES public\.orders\(id\) ON DELETE CASCADE/,
  );
  assert.match(
    sql,
    /user_id UUID\s+REFERENCES auth\.users\(id\) ON DELETE SET NULL/,
  );
  assert.match(sql, /UNIQUE \(order_id\)/);
  assert.match(sql, /CHECK \(rating BETWEEN 1 AND 5\)/);
  assert.match(sql, /ALTER TABLE public\.client_order_reviews ENABLE ROW LEVEL SECURITY/);
  assert.match(
    sql,
    /REVOKE ALL ON TABLE public\.client_order_reviews FROM PUBLIC, anon, authenticated/,
  );
  assert.match(sql, /GRANT SELECT, INSERT ON TABLE public\.client_order_reviews TO service_role/);
  assert.doesNotMatch(sql, /GRANT[^;]*UPDATE|GRANT[^;]*DELETE/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_client_order_review/);
  assert.match(sql, /FROM public\.orders AS orders[\s\S]*FOR UPDATE/);
  assert.match(sql, /v_order_user_id IS DISTINCT FROM p_user_id/);
  assert.match(sql, /v_order_user_id IS NULL[\s\S]*v_order_client_email[\s\S]*p_user_email/);
  assert.match(sql, /v_order_status IS DISTINCT FROM 'delivered'/);
  const activeReworkGuard = sql.match(
    /IF EXISTS \(\s+SELECT 1\s+FROM public\.deliverable_reviews[\s\S]*?outcome := 'active_rework'/,
  )?.[0];
  assert.ok(activeReworkGuard);
  assert.match(activeReworkGuard, /'rework_requested'/);
  assert.match(activeReworkGuard, /'rework_in_progress'/);
  assert.doesNotMatch(
    activeReworkGuard,
    /'rework_delivered'|'resolved'|'approved'/,
  );
  const deliverableGuard = sql.match(
    /IF NOT EXISTS \(\s+SELECT 1\s+FROM public\.order_deliverables[\s\S]*?outcome := 'no_deliverables'/,
  )?.[0];
  assert.ok(deliverableGuard);
  assert.match(deliverableGuard, /deliverable\.order_id = p_order_id/);
  assert.match(deliverableGuard, /deliverable\.file_size > 0/);
  assert.match(deliverableGuard, /btrim\(deliverable\.storage_path\)/);
  assert.match(deliverableGuard, /deliverable\.expires_at IS NULL/);
  assert.match(deliverableGuard, /deliverable\.expires_at > pg_catalog\.now\(\)/);
  assert.match(
    sql,
    /ON CONFLICT ON CONSTRAINT client_order_reviews_order_id_key DO NOTHING/,
  );
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.create_client_order_review[\s\S]*FROM PUBLIC, anon, authenticated/,
  );
});

test("API accepts only rating/comment and derives identity from the authenticated session", () => {
  const route = readFileSync(
    "src/app/api/client/orders/[orderId]/review/route.ts",
    "utf8",
  );

  assert.match(route, /const user = await getClientUser\(\)/);
  assert.match(route, /if \(!user\)[\s\S]*status: 401/);
  assert.match(route, /rating: z\.number\(\)\.int\(\)\.min\(1\)\.max\(5\)/);
  assert.match(route, /comment: z\.string\(\)\.max\(CLIENT_ORDER_REVIEW_COMMENT_MAX\)\.optional\(\)/);
  assert.match(route, /\.strict\(\)/);
  assert.match(route, /toOrderOwnership\(user\)/);
  assert.doesNotMatch(route, /parsed\.data\.user_id|parsed\.data\.email/);
  assert.match(route, /\{ status: 201 \}/);

  const persistence = readFileSync(
    "src/lib/client-order-reviews.ts",
    "utf8",
  );
  assert.match(persistence, /\.rpc\("create_client_order_review"/);
  assert.match(persistence, /p_user_id: input\.userId/);
  assert.match(persistence, /p_user_email: input\.userEmail/);
  assert.match(persistence, /orders!inner\(user_id, client_email, account_deleted_at\)/);
  assert.match(persistence, /isOrderOwned\(row\.orders, ownership\)/);
  assert.match(persistence, /\.from\("deliverable_reviews"\)/);
  assert.match(persistence, /\.in\("status", ACTIVE_REWORK_STATUSES\)/);
  assert.match(persistence, /\.from\("order_deliverables"\)/);
  assert.match(persistence, /\.select\("file_size, storage_path, expires_at"\)/);
  assert.match(persistence, /deliverable\.file_size > 0/);
  assert.match(persistence, /deliverable\.storage_path\.trim\(\)\.length > 0/);
  assert.match(persistence, /Date\.parse\(deliverable\.expires_at\) > now/);
  assert.match(
    persistence,
    /available: !hasActiveRework && hasValidDeliverable/,
  );
  assert.ok(
    persistence.indexOf("if (data) {") <
      persistence.indexOf("const [activeReworkResult, deliverablesResult]"),
    "saved review lookup must return before current eligibility checks",
  );
  assert.doesNotMatch(persistence, /\.insert\(/);
});

test("saved review replaces the form and all review controls meet the 44px target", () => {
  const card = readFileSync(
    "src/components/dashboard/ClientOrderReviewCard.tsx",
    "utf8",
  );

  assert.match(card, /review \? \([\s\S]*data-review-saved[\s\S]*\) : \([\s\S]*data-review-form/);
  assert.match(card, /setReview\(payload\.review\)/);
  assert.match(card, /aria-label=\{`\$\{rating\} out of 5 stars`\}/);
  assert.match(card, /role="group"/);
  assert.match(card, /aria-pressed=\{rating === value\}/);
  assert.match(
    card,
    /const \[previewRating, setPreviewRating\] = useState<number \| null>\(null\)/,
  );
  assert.match(card, /const displayedRating = previewRating \?\? rating/);
  assert.match(card, /value <= displayedRating/);
  assert.match(card, /onMouseEnter=\{\(\) => setPreviewRating\(value\)\}/);
  assert.match(card, /onMouseLeave=\{\(\) => setPreviewRating\(null\)\}/);
  assert.match(card, /onFocus=\{\(\) => setPreviewRating\(value\)\}/);
  assert.match(card, /onBlur=\{\(\) => setPreviewRating\(null\)\}/);
  assert.match(
    card,
    /onClick=\{\(\) => \{[\s\S]*?setRating\(value\);[\s\S]*?setPreviewRating\(null\);[\s\S]*?setError\(null\)/,
  );
  assert.match(card, /min-h-11 min-w-11/);
  assert.match(card, /type="submit"[\s\S]*min-h-11/);
  assert.match(card, /rows=\{2\}/);
  assert.match(card, /min-h-18/);
  assert.doesNotMatch(card, /min-h-24/);
  assert.match(card, /\{error \? \([\s\S]*aria-live="polite"[\s\S]*\) : null\}/);
  assert.doesNotMatch(card, /className="min-h-5[^\n]*aria-live/);
  assert.match(card, /How was your order\?/);
  assert.match(card, /Rate your experience/);
  assert.match(card, /Share any additional feedback \(optional\)/);
  assert.match(card, /Submit review/);
});
