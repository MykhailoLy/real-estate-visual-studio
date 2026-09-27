import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test, { after, beforeEach } from "node:test";
import type { NextRequest } from "next/server";
import type { PersistedOrderPayment } from "./payments/payment-state.ts";
import { calculateOrderQuote } from "./pricing/calculate.ts";
import { createPricingSnapshot } from "./pricing/snapshot.ts";
import { ADMIN_DELIVERABLE_MAX_BYTES, ALLOWED_DELIVERABLE_MIME_TYPES, buildReplacementDeliverablePath } from "./deliverables-config.ts";

type Row = Record<string, unknown>;
const reviewId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const originalId = "33333333-3333-4333-8333-333333333333";
const candidateId = "44444444-4444-4444-8444-444444444444";
const metadata = { filename: "replacement.png", file_size: 8, mime_type: "image/png" };
const candidatePath = buildReplacementDeliverablePath("F8-SYNTHETIC", reviewId, candidateId, metadata.filename);
const state = {
  authenticated: true, review: null as Row | null, deliverable: null as Row | null,
  order: null as Row | null, payment: null as PersistedOrderPayment | null,
  lookupFailure: "", stripeFailure: false, expectedMode: false, modeCalls: 0,
  reads: [] as { table: string; columns: string; filters: Row }[], inserts: [] as Row[], deletes: 0,
  signedPaths: [] as string[], verifiedPaths: [] as string[], rpcCalls: [] as { name: string; args: Row }[],
  after: [] as (() => Promise<void>)[], emails: [] as Row[], size: 8, storageFailure: "", signingFailure: false,
  rpcError: false, rpcThrow: false, code: "committed", badResult: false,
};
beforeEach(() => {
  Object.assign(state, { authenticated: true, signedPaths: [], verifiedPaths: [], rpcCalls: [], after: [], emails: [],
    payment: null, lookupFailure: "", stripeFailure: false, expectedMode: false, modeCalls: 0,
    reads: [], inserts: [], deletes: 0,
    size: 8, storageFailure: "", signingFailure: false, rpcError: false, rpcThrow: false, code: "committed", badResult: false });
  state.review = { id: reviewId, order_id: orderId, order_number: "F8-SYNTHETIC", item_index: 0,
    deliverable_id: originalId, status: "rework_requested", replacement_deliverable_id: null };
  state.deliverable = { id: candidateId, order_id: orderId, order_number: "F8-SYNTHETIC", item_index: 0,
    ...metadata, uploaded_at: "2026-09-26T15:00:00Z", expires_at: null, storage_path: candidatePath };
  state.order = { id: orderId, order_number: "F8-SYNTHETIC", item_count: 1,
    service_type: "virtual-staging", estimated_total_cents: 1500, currency: "USD", pricing_snapshot: null };
});
const supabase = {
  from(table: string) {
    const read = { table, columns: "", filters: {} as Row };
    let inserted: Row | null = null;
    const result = async () => {
      if (state.lookupFailure === `${table}:throw`) throw new Error("PRIVATE lookup detail");
      if (state.lookupFailure === table) return { data: null, error: { message: "PRIVATE lookup detail" } };
      const source = inserted ?? (table === "orders" ? state.order : table === "order_payments" ? state.payment
        : table === "deliverable_reviews" ? state.review : state.deliverable);
      const row = source as Row | null;
      if (!row || Object.entries(read.filters).some(([key, value]) => row[key] !== value)) return { data: null, error: null };
      return { data: Object.fromEntries(read.columns.split(",").map(key => [key.trim(), row[key.trim()]])), error: null };
    };
    const query = {
      select(columns: string) { read.columns = columns; state.reads.push(read); return query; },
      eq(key: string, value: unknown) { read.filters[key] = value; return query; },
      insert(row: Row) { state.inserts.push(row); inserted = { id: candidateId, uploaded_at: "2026-09-26T15:00:00Z", ...row }; return query; },
      delete() { state.deletes++; return query; },
      maybeSingle: result, single: result,
    };
    return query;
  },
  storage: { from(bucket: string) {
    assert.equal(bucket, "deliverables");
    return {
      async createSignedUploadUrl(path: string, options?: { upsert: boolean }) {
        if (options) assert.equal(options.upsert, false); state.signedPaths.push(path);
        return { data: { signedUrl: "https://storage.invalid/upload?token=synthetic", token: "PRIVATE" }, error: state.signingFailure ? { message: "PRIVATE" } : null };
      },
      async info(path: string) {
        state.verifiedPaths.push(path);
        if (state.storageFailure === "throw") throw new Error("PRIVATE signed URL/token");
        return { data: state.storageFailure === "missing" ? null : { size: state.size }, error: state.storageFailure === "error" ? {} : null };
      },
      async remove() { return { error: null }; },
    };
  } },
  rpc(name: string, args: Row) {
    assert.equal(state.verifiedPaths.length > 0, true, "Storage verified before DB commit");
    state.rpcCalls.push({ name, args });
    return { async maybeSingle() {
      if (state.rpcThrow) throw new Error("PRIVATE DB detail");
      return { data: name === "attach_replacement_with_email" ? { id: reviewId } : {
        result_code: state.code, deliverable: { ...state.deliverable, ...(state.badResult ? { id: originalId } : {}), client_email: "PRIVATE" },
      }, error: state.rpcError ? { message: "PRIVATE DB detail" } : null };
    } };
  },
};
Object.assign(globalThis, { __f8Route: { state, supabase } });
const mock = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return mock("export {};");
  if (specifier === "next/server") return mock("export const NextResponse = Response; export const after = fn => globalThis.__f8Route.state.after.push(fn);");
  if (specifier === "@/lib/admin-auth") return mock("export const isAdminAuthenticated = async () => globalThis.__f8Route.state.authenticated;");
  if (specifier === "@/lib/supabase") return mock("export const createServerClient = () => globalThis.__f8Route.supabase;");
  if (specifier === "@/lib/payments/stripe-server") return mock("export const getExpectedStripeLivemode = () => { const s = globalThis.__f8Route.state; s.modeCalls++; if (s.stripeFailure) throw new Error('PRIVATE Stripe configuration'); return s.expectedMode; };");
  if (specifier === "@/lib/email/review-workflow-notifications") return mock("export const sendReviewWorkflowEmail = async args => globalThis.__f8Route.state.emails.push(args);");
  if (specifier.startsWith("@/")) return { url: new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
after(() => hooks.deregister());
const { POST, PATCH } = await import("../app/(public)/api/admin/reviews/[reviewId]/replacement/route.ts");
const ordinaryUrl = await import("../app/(public)/api/admin/orders/[orderId]/deliverables/upload-url/route.ts");
const ordinaryFiles = await import("../app/(public)/api/admin/orders/[orderId]/deliverables/route.ts");
const req = (body: Row) => new Request("https://synthetic.invalid/replacement", { method: "POST", body: JSON.stringify(body) }) as NextRequest;
const prepare = (body: Row = { filename: metadata.filename, file_size: 8, content_type: metadata.mime_type }, id = reviewId) => POST(req(body), { params: Promise.resolve({ reviewId: id }) });
const finalize = (body: Row = { mode: "atomic_upload", replacementDeliverableId: candidateId, ...metadata }, id = reviewId) => PATCH(req(body), { params: Promise.resolve({ reviewId: id }) });
const ordinaryPrepare = () => ordinaryUrl.POST(req({ filename: metadata.filename, file_size: 8, content_type: metadata.mime_type }), { params: Promise.resolve({ orderId }) });
const ordinaryRegister = () => ordinaryFiles.POST(req({ path: candidatePath, ...metadata, item_index: 0 }), { params: Promise.resolve({ orderId }) });

function fixedPriceOrder() {
  const quote = calculateOrderQuote({ serviceType: "virtual-staging", currency: "USD", items: [{ selectedAddons: [] }] });
  return { ...state.order!, estimated_total_cents: quote.totalCents!, pricing_snapshot: createPricingSnapshot(quote) };
}

// RED on main: each real handler returned 200 and crossed its side-effect boundary.
for (const [name, action, sideEffects] of [
  ["ordinary upload-url", ordinaryPrepare, () => state.signedPaths.length],
  ["ordinary registration", ordinaryRegister, () => state.inserts.length],
  ["replacement prepare", prepare, () => state.signedPaths.length],
  ["replacement atomic commit", finalize, () => state.rpcCalls.length],
] as const) test(`F11 unpaid ${name} rejects before fulfillment`, async () => {
  state.order = fixedPriceOrder();
  const response = await action();
  assert.equal(response.status, 409, `Unpaid request reached ${sideEffects()} forbidden side effect(s)`);
  assert.equal(sideEffects(), 0);
  assert.deepEqual(state.after, []);
});

function paidPayment(): PersistedOrderPayment {
  const total = state.order!.estimated_total_cents as number;
  return { order_id: orderId, provider: "stripe", payment_status: "paid", refund_status: "none",
    refunded_amount_cents: 0, subtotal_cents: total, total_cents: total, tax_cents: 0,
    currency: "usd", stripe_checkout_session_id: "cs_PRIVATE", stripe_payment_intent_id: "pi_PRIVATE",
    stripe_livemode: false, paid_at: "2026-09-26T15:00:00Z" };
}

function freeOrder() {
  const quote = calculateOrderQuote({ serviceType: "photo-editing", currency: "USD", items: [{
    selectedOptions: ["image-enhancement-re"], baseOptionId: "image-enhancement-re",
    dedicatedSubService: "image-enhancement-single-exposure",
  }] }, { welcomeOfferAvailability: { imageEnhancementAvailable: true, dayToDuskAvailable: true, virtualStagingAvailable: true } });
  return { ...state.order!, service_type: "photo-editing", estimated_total_cents: 0, pricing_snapshot: createPricingSnapshot(quote) };
}

const fulfillmentActions = [
  ["ordinary prepare", ordinaryPrepare], ["ordinary registration", ordinaryRegister],
  ["replacement prepare", prepare], ["replacement finalize", finalize],
  ["legacy replacement", () => finalize({ replacementDeliverableId: candidateId })],
] as const;
const paymentCases: { name: string; status: number; setup: () => void; message?: RegExp }[] = [
  { name: "paid", status: 200, setup: () => { state.payment = paidPayment(); } },
  { name: "paid live mode", status: 200, setup: () => { state.expectedMode = true; state.payment = { ...paidPayment(), stripe_livemode: true }; } },
  { name: "valid no_payment_required", status: 200, setup: () => { state.order = freeOrder(); state.stripeFailure = true; } },
  { name: "historical manual_review", status: 200, setup: () => { state.order!.pricing_snapshot = null; state.stripeFailure = true; } },
  { name: "legacy zero-total manual_review", status: 200, setup: () => { state.order!.pricing_snapshot = null; state.order!.estimated_total_cents = 0; state.stripeFailure = true; } },
  { name: "Checkout-ineligible manual_review", status: 200, setup: () => { state.order!.service_type = "local-photography"; state.stripeFailure = true; } },
  { name: "custom-quote manual_review", status: 200, setup: () => {
    const quote = calculateOrderQuote({ serviceType: "virtual-staging", currency: "USD", items: Array.from({ length: 50 }, () => ({ selectedAddons: [] })) });
    state.order!.pricing_snapshot = createPricingSnapshot(quote); state.stripeFailure = true;
  } },
  { name: "payment_required", status: 409, setup: () => {}, message: /matching Paid payment is required/ },
  { name: "processing", status: 409, setup: () => { state.payment = { ...paidPayment(), payment_status: "checkout_open", paid_at: null }; }, message: /still processing/ },
  { name: "partially_refunded", status: 409, setup: () => { state.payment = { ...paidPayment(), refund_status: "partial", refunded_amount_cents: 1 }; }, message: /Refunded payments/ },
  { name: "refunded", status: 409, setup: () => { state.payment = { ...paidPayment(), refund_status: "full", refunded_amount_cents: state.order!.estimated_total_cents as number }; }, message: /Refunded payments/ },
  { name: "malformed supported snapshot", status: 409, setup: () => { state.order!.pricing_snapshot = { ...state.order!.pricing_snapshot as Row, totalCents: 99 }; } },
  { name: "tampered zero-total", status: 409, setup: () => { state.order = freeOrder(); state.order.pricing_snapshot = { ...state.order.pricing_snapshot as Row, baseSubtotalCents: 99 }; } },
  { name: "Stripe mode mismatch", status: 409, setup: () => { state.payment = { ...paidPayment(), stripe_livemode: true }; } },
  { name: "non-matching Paid amount", status: 409, setup: () => { state.payment = { ...paidPayment(), subtotal_cents: 1 }; } },
];

for (const [actionName, action] of fulfillmentActions) {
  for (const scenario of paymentCases) test(`F11 ${actionName}: ${scenario.name}`, async () => {
    state.order = fixedPriceOrder(); scenario.setup();
    const response = await action();
    assert.equal(response.status, scenario.status);
    if (scenario.status === 409) {
      const body = await response.text();
      if (scenario.message) assert.match(body, scenario.message);
      assert.doesNotMatch(body, /PRIVATE|stripe_|storage_path|client_email|user_id/);
      assert.deepEqual(state.signedPaths, []); assert.deepEqual(state.inserts, []);
      assert.deepEqual(state.rpcCalls, []); assert.deepEqual(state.after, []);
      assert.deepEqual(state.verifiedPaths, []);
    } else {
      assert.equal(state.signedPaths.length + state.inserts.length + state.rpcCalls.length, 1);
    }
    const paymentReads = state.reads.filter(read => read.table === "order_payments");
    assert.equal(paymentReads.length, 1);
    assert.deepEqual(paymentReads[0].filters, { order_id: orderId });
  });

  for (const failure of ["order_payments", "order_payments:throw", "Stripe config"]) {
    test(`F11 ${actionName}: ${failure} fails closed without private details`, async () => {
      state.order = fixedPriceOrder(); state.payment = paidPayment();
      if (failure === "Stripe config") state.stripeFailure = true;
      else state.lookupFailure = failure;
      const response = await action(); assert.equal(response.status, 500);
      assert.doesNotMatch(await response.text(), /PRIVATE|cs_|pi_|stripe_|storage_path|client_email|user_id/);
      assert.deepEqual(state.signedPaths, []); assert.deepEqual(state.inserts, []);
      assert.deepEqual(state.rpcCalls, []); assert.deepEqual(state.after, []);
    });
  }

  test(`F11 ${actionName}: admin auth remains first`, async () => {
    state.authenticated = false;
    assert.equal((await action()).status, 401);
    assert.deepEqual(state.reads, []); assert.deepEqual(state.signedPaths, []);
    assert.deepEqual(state.inserts, []); assert.deepEqual(state.rpcCalls, []);
  });

  test(`F11 ${actionName}: missing order keeps its existing not-found response`, async () => {
    state.order = null;
    assert.equal((await action()).status, actionName.startsWith("ordinary") ? 400 : 404);
    assert.deepEqual(state.signedPaths, []); assert.deepEqual(state.inserts, []); assert.deepEqual(state.rpcCalls, []);
  });
}

for (const [name, first, second] of [
  ["ordinary registration", ordinaryPrepare, ordinaryRegister],
  ["replacement commit", prepare, finalize],
] as const) test(`F11 stale signed URL cannot authorize ${name} after refund`, async () => {
  state.order = fixedPriceOrder(); state.payment = paidPayment();
  assert.equal((await first()).status, 200);
  state.payment.refund_status = "full"; state.payment.refunded_amount_cents = state.payment.total_cents!;
  assert.equal((await second()).status, 409);
  assert.equal(state.signedPaths.length, 1); assert.deepEqual(state.inserts, []);
  assert.deepEqual(state.rpcCalls, []); assert.deepEqual(state.after, []);
  assert.equal(state.review!.status, "rework_requested");
  assert.equal(state.review!.replacement_deliverable_id, null);
  assert.equal(state.reads.filter(read => read.table === "order_payments").length, 2);
});

test("F11 same committed candidate reconciles after refund without new payment authorization", async () => {
  state.order = fixedPriceOrder(); state.payment = { ...paidPayment(), refund_status: "full", refunded_amount_cents: state.order.estimated_total_cents as number };
  state.review!.status = "rework_delivered"; state.review!.replacement_deliverable_id = candidateId;
  state.code = "already_committed"; state.stripeFailure = true; state.lookupFailure = "order_payments";
  assert.equal((await finalize()).status, 200);
  assert.equal(state.rpcCalls.length, 1); assert.equal(state.rpcCalls[0].args.p_replacement_deliverable_id, candidateId);
  assert.deepEqual(state.inserts, []); assert.deepEqual(state.signedPaths, []);
  assert.equal(state.modeCalls, 0);
  assert.equal(state.reads.some(read => read.table === "order_payments"), false);
  assert.equal(state.after.length, 1, "Existing outbox drain entry point is preserved");
});

test("F11 different candidate cannot use the reconciliation exemption", async () => {
  state.order = fixedPriceOrder(); state.review!.status = "rework_delivered";
  state.review!.replacement_deliverable_id = originalId;
  assert.equal((await finalize()).status, 409);
  assert.deepEqual(state.rpcCalls, []); assert.deepEqual(state.after, []);
});

test("F11 unpaid DELETE remains usable and never evaluates payment", async () => {
  state.order = fixedPriceOrder(); state.lookupFailure = "order_payments"; state.stripeFailure = true;
  const response = await ordinaryFiles.DELETE(req({ deliverable_id: candidateId, delete_file: true }), { params: Promise.resolve({ orderId }) });
  assert.equal(response.status, 200); assert.equal(state.deletes, 1);
  assert.equal(state.reads.some(read => read.table === "order_payments"), false); assert.equal(state.modeCalls, 0);
});

test("F11 fulfillment adds no order-status restriction for a Paid cancelled order", async () => {
  state.order = { ...fixedPriceOrder(), status: "cancelled" }; state.payment = paidPayment();
  assert.equal((await ordinaryRegister()).status, 200);
  assert.equal((await finalize()).status, 200);
});

test("F8 prepare returns only a server UUID and signed URL; no registration or email", async () => {
  const response = await prepare(); assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(Object.keys(result).sort(), ["ok", "replacementDeliverableId", "signedUrl"]);
  assert.match(result.replacementDeliverableId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(state.signedPaths[0], buildReplacementDeliverablePath("F8-SYNTHETIC", reviewId, result.replacementDeliverableId, metadata.filename));
  assert.deepEqual(state.rpcCalls, []); assert.deepEqual(state.after, []);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|storage_path|client_email|user_id/);
});

test("F8 prepare validates current lifecycle and empty replacement slot", async () => {
  for (const status of ["pending_review", "approved", "resolved", "rework_delivered"]) {
    state.review!.status = status; assert.equal((await prepare()).status, 409);
  }
  state.review!.status = "rework_in_progress";
  assert.equal((await prepare()).status, 200);
  state.review!.replacement_deliverable_id = candidateId; assert.equal((await prepare()).status, 409);
  state.review = null; assert.equal((await prepare()).status, 404);
});

test("F8 stable paths strip directories/unsafe characters and isolate review/candidate identities", () => {
  const path = buildReplacementDeliverablePath("F8-SYNTHETIC", reviewId, candidateId, "../../Room view!.png");
  assert.equal(path, `F8-SYNTHETIC/rework/${reviewId}/${candidateId}-Room_view_.png`);
  assert.equal(path, buildReplacementDeliverablePath("F8-SYNTHETIC", reviewId, candidateId, "Room view!.png"));
  assert.notEqual(path, buildReplacementDeliverablePath("F8-SYNTHETIC", reviewId, originalId, "Room view!.png"));
});

test("F8 auth, UUID, metadata, MIME and strict-mode validation precede side effects", async () => {
  state.authenticated = false;
  assert.equal((await prepare()).status, 401); assert.equal((await finalize()).status, 401);
  state.authenticated = true;
  assert.equal((await prepare(undefined, "invalid")).status, 400); assert.equal((await finalize(undefined, "invalid")).status, 400);
  for (const body of [
    { filename: "a.png", content_type: "image/png", file_size: 0 },
    { filename: "a.png", content_type: "image/png", file_size: ADMIN_DELIVERABLE_MAX_BYTES + 1 },
    { filename: "a.exe", content_type: "application/octet-stream", file_size: 8 },
    { filename: "a.png", content_type: "text/plain", file_size: 8 },
    { filename: "a.png", content_type: "image/png", file_size: 8, order_id: "attacker" },
  ]) assert.equal((await prepare(body)).status, 400);
  for (const body of [
    { mode: "unknown", replacementDeliverableId: candidateId },
    { mode: "atomic_upload", replacementDeliverableId: candidateId },
    { mode: "atomic_upload", replacementDeliverableId: candidateId, ...metadata, storage_path: "attacker" },
    { mode: "atomic_upload", replacementDeliverableId: originalId, ...metadata },
    { mode: "atomic_upload", replacementDeliverableId: candidateId, ...metadata, file_size: 0 },
    { mode: "atomic_upload", replacementDeliverableId: candidateId, ...metadata, mime_type: "text/plain" },
  ]) assert.equal((await finalize(body)).status, 400);
  assert.deepEqual(state.rpcCalls, []); assert.deepEqual(state.signedPaths, []); assert.deepEqual(state.verifiedPaths, []);
});

test("F8 preserves all allowed deliverable MIME types including ZIP octet-stream", async () => {
  for (const content_type of ALLOWED_DELIVERABLE_MIME_TYPES) {
    assert.equal((await prepare({ filename: "deliverable.zip", content_type, file_size: 8 })).status, 200);
  }
});

for (const failure of ["missing", "error", "throw", "size"]) test(`F8 Storage ${failure} prevents RPC and notification`, async () => {
  state.storageFailure = failure; if (failure === "size") state.size = 7;
  const response = await finalize(); assert.ok(response.status >= 400);
  assert.deepEqual(state.rpcCalls, []); assert.deepEqual(state.after, []);
  assert.equal(state.review!.status, "rework_requested");
  assert.doesNotMatch(await response.text(), /PRIVATE|storage_path|token/);
});

test("F8 signing failure returns no upload capability", async () => {
  state.signingFailure = true;
  const response = await prepare(); assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /signedUrl|token|PRIVATE/);
});

for (const code of ["committed", "already_committed"]) test(`F8 ${code} returns safe deliverable and schedules existing outbox entry point`, async () => {
  state.code = code;
  if (code === "already_committed") Object.assign(state.review!, { status: "rework_delivered", replacement_deliverable_id: candidateId });
  const response = await finalize(); assert.equal(response.status, 200);
  assert.deepEqual(state.verifiedPaths, [candidatePath]);
  assert.equal(state.rpcCalls[0].name, "commit_rework_replacement_upload");
  assert.deepEqual(Object.keys(state.rpcCalls[0].args).sort(), ["p_review_id", "p_replacement_deliverable_id", "p_storage_path", "p_filename", "p_file_size", "p_mime_type"].sort());
  const body = await response.json();
  assert.equal(body.deliverable.id, candidateId);
  assert.deepEqual(Object.keys(body.deliverable).sort(), ["id", "order_id", "order_number", "item_index", "filename", "file_size", "mime_type", "uploaded_at"].sort());
  assert.doesNotMatch(JSON.stringify(body), /storage_path|expires_at|client_email|user_id|PRIVATE|token/);
  assert.equal(state.after.length, 1); assert.equal(state.emails.length, 0);
  await state.after[0]();
  assert.deepEqual(state.emails, [{ event: "admin_replacement_ready", reviewId, replacementDeliverableId: candidateId }]);
});

test("F8 SQL rejection/unknown outcome cannot fall back to legacy or schedule email", async () => {
  for (const code of ["not_found", "invalid_state", "conflict", "invalid_candidate", "invalid_assignment", "unexpected"]) {
    state.code = code;
    const response = await finalize(); assert.equal(response.status, code === "not_found" ? 404 : code === "unexpected" ? 500 : 409);
  }
  state.code = "committed"; state.rpcError = true; assert.equal((await finalize()).status, 500);
  state.rpcError = false; state.rpcThrow = true; assert.equal((await finalize()).status, 503);
  state.rpcThrow = false; state.badResult = true; assert.equal((await finalize()).status, 500);
  assert.ok(state.rpcCalls.every(call => call.name === "commit_rework_replacement_upload"));
  assert.deepEqual(state.after, []);
});

test("F8 legacy PATCH retains verified pre-registered replacement attachment", async () => {
  const response = await finalize({ replacementDeliverableId: candidateId });
  assert.equal(response.status, 200);
  assert.deepEqual(state.verifiedPaths, [candidatePath]);
  assert.equal(state.rpcCalls[0].name, "attach_replacement_with_email");
  assert.equal(state.after.length, 1);
});

const migration = readFileSync("supabase/migrations/20260926155032_f8_atomic_replacement_deliverable_commit.sql", "utf8");
test("F8 manual migration adds only one invoker RPC with restricted grants", () => {
  assert.match(migration, /MANUAL MIGRATION ONLY/);
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length, 1);
  assert.match(migration, /LANGUAGE plpgsql SECURITY INVOKER\s+SET search_path = pg_catalog, public/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.commit_rework_replacement_upload[^;]+FROM PUBLIC, anon, authenticated;/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.commit_rework_replacement_upload[^;]+TO service_role;/);
  assert.doesNotMatch(migration, /(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|POLICY|TRIGGER)|storage\.(?:objects|buckets)|GRANT\s+.*ON TABLE/i);
  assert.match(migration, /WHERE id = p_review_id FOR UPDATE/);
  assert.match(migration, /'admin_replacement_ready:' \|\| p_review_id::text/);
  assert.match(migration, /p_file_size NOT BETWEEN 1 AND 209715200/);
  assert.equal(ADMIN_DELIVERABLE_MAX_BYTES, 209715200);
});
