import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
const orderId = "11111111-1111-4111-8111-111111111111";
const reviewId = "22222222-2222-4222-8222-222222222222";
const replacementId = "33333333-3333-4333-8333-333333333333";
const originalId = "44444444-4444-4444-8444-444444444444";
const state = {
  tables: {} as Record<string, Row[]>,
  outbox: [] as Row[],
  sent: [] as { payload: Row; key: string }[],
  after: [] as (() => Promise<void>)[],
  authenticated: true,
  configured: true,
  provider: "ok",
  storageSize: 100,
  storageError: false,
  storageThrows: false,
  updateError: false,
  claimError: false,
};

function reset() {
  Object.assign(state, {
    outbox: [], sent: [], after: [], authenticated: true, configured: true,
    provider: "ok", storageSize: 100, storageError: false, storageThrows: false,
    updateError: false, claimError: false,
  });
  state.tables = {
    orders: [{ id: orderId, status: "in-progress", order_number: "PS-0042",
      client_name: "Alex & Co", client_email: "persisted@example.com",
      service_type: "virtual-staging", pricing_snapshot: null }],
    order_payments: [],
    deliverable_reviews: [{ id: reviewId, deliverable_id: originalId,
      status: "rework_requested", order_id: orderId, order_number: "PS-0042",
      client_email: "persisted@example.com", item_index: 0, replacement_deliverable_id: null }],
    order_deliverables: [
      { id: originalId, order_id: orderId, item_index: 0, filename: "original.jpg" },
      { id: replacementId, order_id: orderId, item_index: 0, filename: "replacement.jpg",
        storage_path: "PRIVATE-CLIENT-PATH", file_size: 100, expires_at: null },
    ],
  };
}

// Query/claim test double. Transaction and locking contracts are independently
// asserted against the migration below; these are not live database tests.
class Query {
  filters: ((row: Row) => boolean)[] = [];
  updateValues: Row | null = null;
  readonly table: string;
  constructor(table: string) { this.table = table; }
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this; }
  in(key: string, values: unknown[]) { this.filters.push(row => values.includes(row[key])); return this; }
  is(key: string, value: unknown) { return this.eq(key, value); }
  update(values: Row) { this.updateValues = values; return this; }
  execute(single: boolean) {
    if (this.updateValues && state.updateError) return { data: null, error: { message: "DB failure" } };
    const tableRows = this.table === "order_email_deliveries" ? state.outbox : state.tables[this.table];
    const rows = tableRows.filter(row => this.filters.every(filter => filter(row)));
    for (const row of rows) {
      if (!this.updateValues) continue;
      if (this.table === "orders" && row.status !== "delivered" && this.updateValues.status === "delivered" && !state.outbox.some(delivery => delivery.delivery_kind === "order_delivered")) {
        state.outbox.push({ delivery_id: "delivery-1", order_id: orderId,
          delivery_kind: "order_delivered", status: "pending", attempt_count: 0,
          idempotency_key: `order-delivered-${orderId}-client-v1`, payload_hash: null });
      }
      if (this.table === "deliverable_reviews" && this.updateValues.status === "rework_delivered") {
        const kind = `admin_replacement_ready:${row.id}`;
        if (!state.outbox.some(delivery => delivery.delivery_kind === kind)) {
          state.outbox.push({ delivery_id: `delivery-${row.id}`, order_id: row.order_id,
            delivery_kind: kind, status: "pending", attempt_count: 0,
            idempotency_key: `review-${row.id}-replacement-${this.updateValues.replacement_deliverable_id}-ready-v1`, payload_hash: null });
        }
      }
      Object.assign(row, this.updateValues);
    }
    return { data: single ? rows[0] ? { ...rows[0] } : null : rows.map(row => ({ ...row })), error: null };
  }
  async maybeSingle() { return this.execute(true); }
  then(resolve: (value: ReturnType<Query["execute"]>) => unknown) { return Promise.resolve(this.execute(false)).then(resolve); }
}
const supabase = {
  from: (table: string) => new Query(table),
  storage: { from: () => ({ info: async () => {
    if (state.storageThrows) throw new Error("Storage unavailable");
    return { data: { size: state.storageSize }, error: state.storageError ? { message: "Not found" } : null };
  } }) },
  rpc(name: string, args: Row) {
    if (name === "mark_order_delivered_with_email") {
      return new Query("orders").update({ status: "delivered" }).eq("id", args.p_order_id);
    }
    if (name === "attach_replacement_with_email") {
      return new Query("deliverable_reviews")
        .update({ status: "rework_delivered", replacement_deliverable_id: args.p_replacement_deliverable_id })
        .eq("id", args.p_review_id).in("status", ["rework_requested", "rework_in_progress"])
        .is("replacement_deliverable_id", null);
    }
    if (name === "claim_order_email_deliveries") {
      if (state.claimError) return { data: null, error: { message: "Unavailable" } };
      const rows = state.outbox.filter(row => row.status !== "sent" && row.status !== "sending" && Number(row.attempt_count) < 3);
      for (const row of rows) {
        row.status = "sending"; row.attempt_count = Number(row.attempt_count) + 1;
      }
      return { data: rows.map(row => ({ ...row })), error: null };
    }
    assert.equal(name, "complete_order_email_delivery");
    const row = state.outbox.find(row => row.delivery_id === args.p_delivery_id)!;
    Object.assign(row, { status: args.p_status, payload_hash: args.p_payload_hash, last_error_code: args.p_error_code });
    return { data: "completed", error: null };
  },
};
const fixture = {
  state, supabase,
  async send(payload: Row, options?: { idempotencyKey: string }) {
    const key = options?.idempotencyKey ?? "";
    if (state.provider === "reject") return { error: { message: "Rejected" } };
    if (!state.sent.some(sent => sent.key === key)) state.sent.push({ payload, key });
    if (state.provider === "throw") throw new Error("Connection lost after acceptance");
    return { data: { id: "provider-1" }, error: null };
  },
};
Object.assign(globalThis, { __workReadyFixture: fixture });
const mock = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return mock("export default undefined;");
    if (specifier === "next/server") return mock(`
      export const NextResponse = Response;
      export const after = fn => globalThis.__workReadyFixture.state.after.push(fn);
    `);
    if (specifier === "@/lib/supabase") return mock("export const createServerClient = () => globalThis.__workReadyFixture.supabase;");
    if (specifier === "@/lib/admin-auth") return mock("export const isAdminAuthenticated = async () => globalThis.__workReadyFixture.state.authenticated;");
    if (specifier === "./resend-client") return mock(`
      const fixture = globalThis.__workReadyFixture;
      export const getResendClient = () => fixture.state.configured
        ? {ok: true, client: {emails: {send: fixture.send}}} : {ok: false, reason: 'not configured'};
      export const getAdminAddress = () => 'orders@picchuspot.com';
      export const getFromAddress = () => 'PicchuSpot <orders@picchuspot.com>';
    `);
    if (specifier.startsWith("@/")) return { url: new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !specifier.endsWith(".ts")) {
      return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { renderWorkReadyEmail } = await import("./order-work-ready.ts");
const { dispatchOrderEmailOutbox } = await import("./send-order-emails.ts");
const { sendReviewWorkflowEmail } = await import("./review-workflow-notifications.ts");
const { POST } = await import("../../app/(public)/api/admin/orders/[orderId]/status/route.ts");
const { PATCH } = await import("../../app/(public)/api/admin/reviews/[reviewId]/replacement/route.ts");
const request = (body: Row) => new Request("https://picchuspot.com/api/test", { method: "POST", body: JSON.stringify(body) }) as NextRequest;
const setStatus = (status: string) => POST(request({ status, client_email: "attacker@example.com", client_name: "Attacker" }), { params: Promise.resolve({ orderId }) });
const linkReplacement = () => PATCH(request({ replacementDeliverableId: replacementId }), { params: Promise.resolve({ reviewId }) });
async function drain() { for (const callback of state.after.splice(0)) await callback(); }
const dispatch = () => dispatchOrderEmailOutbox({ supabase: supabase as unknown as SupabaseClient, orderId });

for (const event of ["order_delivered", "admin_replacement_ready"] as const) {
  test(`${event}: branded HTML and useful text use only public media and verified routes`, () => {
    const email = renderWorkReadyEmail({ event, orderId, orderNumber: "PS-0042", clientName: "Alex <script>" });
    assert.equal(email.subject, event === "order_delivered" ? "Your PicchuSpot order PS-0042 is ready" : "Changes for order PS-0042 have been completed");
    assert.match(email.html, /Alex &lt;script&gt;/);
    assert.match(email.html, /picchuspot-social-preview-1200x630\.jpg/);
    assert.match(email.html, /alt="PicchuSpot real estate visuals — Fast, precise, reliable"/);
    assert.match(email.html, /picchuspot-logo-800\.png/);
    assert.equal((email.html.match(new RegExp(`href="https://picchuspot.com/dashboard/jobs/${orderId}"`, "g")) ?? []).length, 1);
    for (const content of [email.html, email.text]) {
      assert.ok(content.includes(`/dashboard/jobs/${orderId}`));
      assert.ok(content.includes("PS-0042"));
      assert.match(content, /no further action is required/);
      assert.match(content, /request (?:a revision|it directly)/);
      assert.match(content, /View (?:completed order|updated files)/);
      assert.doesNotMatch(content, /approv|supabase|token=|PRIVATE-CLIENT-PATH/i);
    }
    for (const service of ["virtual-staging", "virtual-renovation", "photo-editing", "floor-plans"]) {
      assert.ok(existsSync(`src/app/(public)/pricing/${service}/page.tsx`));
      assert.ok(email.html.includes(`https://picchuspot.com/pricing/${service}`));
    }
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const color of ["#071a2b", "#c7a94e", "#f4efe8", "#ded3c6", "#5a656d"]) {
      assert.ok(css.includes(color)); assert.ok(email.html.includes(color));
    }
    assert.match(renderWorkReadyEmail({ event, orderId, orderNumber: "PS-0042", clientName: null }).text, /Hi there,/);
  });
}

test("first delivered schedules once, reads persisted identity, and supports missing pricing snapshots", async () => {
  reset();
  assert.equal((await setStatus("delivered")).status, 200);
  assert.equal(state.outbox.length, 1);
  assert.equal(state.sent.length, 0);
  await drain();
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0].payload.to, "persisted@example.com");
  assert.match(String(state.sent[0].payload.html), /Alex &amp; Co/);
  await setStatus("delivered"); await drain();
  await setStatus("in-progress"); await setStatus("delivered"); await drain();
  assert.equal(state.outbox.length, 1); assert.equal(state.sent.length, 1);
});

test("concurrent delivered requests share one logical delivery", async () => {
  reset();
  await Promise.all([setStatus("delivered"), setStatus("delivered")]);
  await Promise.all(state.after.splice(0).map(callback => callback()));
  assert.equal(state.outbox.length, 1); assert.equal(state.sent.length, 1);
});

test("unrelated, failed, unauthorized and already-delivered historical updates do not create events", async () => {
  reset();
  for (const status of ["pending", "confirmed", "in-progress", "cancelled"]) await setStatus(status);
  assert.equal(state.after.length, 0); assert.equal(state.outbox.length, 0);
  state.authenticated = false;
  assert.equal((await setStatus("delivered")).status, 401);
  state.authenticated = true; state.updateError = true;
  assert.equal((await setStatus("delivered")).status, 500);
  state.updateError = false; state.tables.orders[0].status = "delivered";
  await setStatus("delivered"); await drain();
  assert.equal(state.outbox.length, 0); assert.equal(state.sent.length, 0);
});

test("provider rejection is durable, does not undo delivery, and retries with the same key", async () => {
  reset(); state.provider = "reject";
  assert.equal((await setStatus("delivered")).status, 200); await drain();
  assert.equal(state.tables.orders[0].status, "delivered");
  assert.equal(state.outbox[0].status, "failed");
  assert.equal(state.outbox[0].last_error_code, "provider_rejected");
  state.provider = "ok"; await dispatch();
  assert.equal(state.outbox[0].status, "sent");
  assert.equal(state.sent[0].key, `order-delivered-${orderId}-client-v1`);
});

test("a missed dispatch retains the pending event; unavailable configuration records failure", async () => {
  reset(); await setStatus("delivered"); state.after = [];
  assert.equal(state.outbox[0].status, "pending");
  state.configured = false; await dispatch();
  assert.equal(state.outbox[0].last_error_code, "email_not_configured");
  state.configured = true; await dispatch();
  assert.equal(state.sent.length, 1);
});

test("unknown provider outcomes reuse their key; payload changes do not resend", async () => {
  reset(); state.provider = "throw"; await setStatus("delivered"); await drain();
  assert.equal(state.outbox[0].status, "unknown");
  state.provider = "ok"; await dispatch();
  assert.equal(state.sent.length, 1);
  reset(); state.provider = "throw"; await setStatus("delivered"); await drain();
  state.tables.orders[0].client_name = "Changed"; state.provider = "ok";
  await dispatch();
  assert.equal(state.outbox[0].last_error_code, "payload_hash_mismatch");
  assert.equal(state.sent.length, 1);
});

test("replacement attaches after Storage verification and concurrent/repeated requests notify only once", async () => {
  reset();
  const responses = await Promise.all([linkReplacement(), linkReplacement()]);
  await drain();
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(state.tables.deliverable_reviews[0].status, "rework_delivered");
  assert.equal((await linkReplacement()).status, 409);
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0].payload.subject, "Changes for order PS-0042 have been completed");
  assert.ok(String(state.sent[0].payload.text).includes(`/dashboard/jobs/${orderId}`));
  assert.doesNotMatch(String(state.sent[0].payload.text), /approv/i);
  assert.match(String(state.sent[0].payload.text), /Hi Alex & Co,/);
  assert.equal(state.sent[0].key, `review-${reviewId}-replacement-${replacementId}-ready-v1`);
  assert.equal((await sendReviewWorkflowEmail({ event: "admin_replacement_ready", reviewId, replacementDeliverableId: replacementId })).sent, true);
  assert.equal(state.sent.length, 1);
});

test("replacement event survives a missed dispatch and Resend rejection without undoing finalization", async () => {
  reset();
  assert.equal((await linkReplacement()).status, 200);
  state.after = [];
  assert.equal(state.outbox[0].status, "pending");
  state.provider = "reject"; await dispatch();
  assert.equal(state.tables.deliverable_reviews[0].status, "rework_delivered");
  assert.equal(state.outbox[0].status, "failed");
  state.provider = "ok"; await dispatch(); await dispatch();
  assert.equal(state.sent.length, 1);
});

test("each rework cycle has its own durable delivery, with persisted order recipient and name", async () => {
  reset(); await linkReplacement(); await drain();
  const secondReviewId = "55555555-5555-4555-8555-555555555555";
  const secondReplacementId = "66666666-6666-4666-8666-666666666666";
  state.tables.order_deliverables.push({ ...state.tables.order_deliverables[1], id: secondReplacementId });
  state.tables.deliverable_reviews.push({ ...state.tables.deliverable_reviews[0],
    id: secondReviewId, deliverable_id: replacementId, status: "rework_requested", replacement_deliverable_id: null,
    client_email: "stale-review-email@example.com" });
  const response = await PATCH(request({ replacementDeliverableId: secondReplacementId }), { params: Promise.resolve({ reviewId: secondReviewId }) });
  assert.equal(response.status, 200); await drain();
  assert.equal(state.outbox.length, 2); assert.equal(state.sent.length, 2);
  assert.notEqual(state.sent[0].key, state.sent[1].key);
  assert.equal(state.sent[1].payload.to, "persisted@example.com");
});

test("a queued replacement removed or expired before dispatch cannot send a ready email", async () => {
  for (const removed of [true, false]) {
    reset(); await linkReplacement();
    if (removed) state.tables.order_deliverables.pop();
    else state.tables.order_deliverables[1].expires_at = "2020-01-01";
    await drain();
    assert.equal(state.sent.length, 0);
    assert.equal(state.outbox[0].last_error_code, "replacement_unavailable");
  }
});

test("replacement metadata, missing/partial objects, wrong assignment and failed attachment never notify", async () => {
  for (const scenario of ["missing", "partial", "storageThrows", "wrongOrder", "wrongItem", "original", "expired", "updateError", "unfinalized"] as const) {
    reset();
    const replacement = state.tables.order_deliverables[1];
    if (scenario === "missing") state.storageError = true;
    if (scenario === "partial") state.storageSize = 1;
    if (scenario === "storageThrows") state.storageThrows = true;
    if (scenario === "wrongOrder") replacement.order_id = "another-order";
    if (scenario === "wrongItem") replacement.item_index = 1;
    if (scenario === "original") state.tables.deliverable_reviews[0].deliverable_id = replacementId;
    if (scenario === "expired") replacement.expires_at = "2020-01-01";
    if (scenario === "updateError") state.updateError = true;
    if (scenario === "unfinalized") {
      assert.equal((await sendReviewWorkflowEmail({ event: "admin_replacement_ready", reviewId, replacementDeliverableId: replacementId })).sent, false);
    } else {
      assert.notEqual((await linkReplacement()).status, 200, scenario);
    }
    assert.equal(state.sent.length, 0, scenario);
    assert.equal(state.tables.deliverable_reviews[0].status, "rework_requested", scenario);
  }
});

test("migration atomically captures only transitions with the existing unique key and service-only RPC", () => {
  const sql = readFileSync("supabase/20260909210000_add_order_delivered_email.sql", "utf8");
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(sql, /FUNCTION public\.mark_order_delivered_with_email\(p_order_id UUID\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /v_previous_status IS DISTINCT FROM 'delivered'/);
  assert.match(sql, /UPDATE public\.orders AS orders SET status = 'delivered'/);
  assert.match(sql, /INSERT INTO public\.order_email_deliveries/);
  assert.match(sql, /ON CONFLICT \(order_id, delivery_kind\) DO NOTHING/);
  assert.match(sql, /'order-delivered-' \|\| p_order_id::TEXT \|\| '-client-v1'/);
  assert.match(sql, /SECURITY INVOKER[\s\S]*SET search_path = pg_catalog, public/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /TO service_role/);
  assert.match(sql, /FUNCTION public\.attach_replacement_with_email/);
  assert.match(sql, /reviews\.status IN \('rework_requested', 'rework_in_progress'\)/);
  assert.match(sql, /reviews\.replacement_deliverable_id IS NULL/);
  assert.match(sql, /replacement\.order_id = reviews\.order_id/);
  assert.match(sql, /replacement\.item_index IS NOT DISTINCT FROM reviews\.item_index/);
  assert.match(sql, /'admin_replacement_ready:' \|\| p_review_id::TEXT/);
  assert.doesNotMatch(sql, /CREATE POLICY|UPDATE public\.orders\s+SET|AFTER INSERT|storage\./i);
});
