import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test, { after, beforeEach } from "node:test";
import type { NextRequest } from "next/server";
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
  signedPaths: [] as string[], verifiedPaths: [] as string[], rpcCalls: [] as { name: string; args: Row }[],
  after: [] as (() => Promise<void>)[], emails: [] as Row[], size: 8, storageFailure: "", signingFailure: false,
  rpcError: false, rpcThrow: false, code: "committed", badResult: false,
};
beforeEach(() => {
  Object.assign(state, { authenticated: true, signedPaths: [], verifiedPaths: [], rpcCalls: [], after: [], emails: [],
    size: 8, storageFailure: "", signingFailure: false, rpcError: false, rpcThrow: false, code: "committed", badResult: false });
  state.review = { id: reviewId, order_id: orderId, order_number: "F8-SYNTHETIC", item_index: 0,
    deliverable_id: originalId, status: "rework_requested", replacement_deliverable_id: null };
  state.deliverable = { id: candidateId, order_id: orderId, order_number: "F8-SYNTHETIC", item_index: 0,
    ...metadata, uploaded_at: "2026-09-26T15:00:00Z", expires_at: null, storage_path: candidatePath };
});
const supabase = {
  from(table: string) {
    const query = { select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: table === "deliverable_reviews" ? state.review : state.deliverable, error: null }) };
    return query;
  },
  storage: { from(bucket: string) {
    assert.equal(bucket, "deliverables");
    return {
      async createSignedUploadUrl(path: string, options: { upsert: boolean }) {
        assert.equal(options.upsert, false); state.signedPaths.push(path);
        return { data: { signedUrl: "https://storage.invalid/upload?token=synthetic", token: "PRIVATE" }, error: state.signingFailure ? { message: "PRIVATE" } : null };
      },
      async info(path: string) {
        state.verifiedPaths.push(path);
        if (state.storageFailure === "throw") throw new Error("PRIVATE signed URL/token");
        return { data: state.storageFailure === "missing" ? null : { size: state.size }, error: state.storageFailure === "error" ? {} : null };
      },
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
  if (specifier === "next/server") return mock("export const NextResponse = Response; export const after = fn => globalThis.__f8Route.state.after.push(fn);");
  if (specifier === "@/lib/admin-auth") return mock("export const isAdminAuthenticated = async () => globalThis.__f8Route.state.authenticated;");
  if (specifier === "@/lib/supabase") return mock("export const createServerClient = () => globalThis.__f8Route.supabase;");
  if (specifier === "@/lib/email/review-workflow-notifications") return mock("export const sendReviewWorkflowEmail = async args => globalThis.__f8Route.state.emails.push(args);");
  if (specifier.startsWith("@/")) return { url: new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
after(() => hooks.deregister());
const { POST, PATCH } = await import("../app/(public)/api/admin/reviews/[reviewId]/replacement/route.ts");
const req = (body: Row) => new Request("https://synthetic.invalid/replacement", { method: "POST", body: JSON.stringify(body) }) as NextRequest;
const prepare = (body: Row = { filename: metadata.filename, file_size: 8, content_type: metadata.mime_type }, id = reviewId) => POST(req(body), { params: Promise.resolve({ reviewId: id }) });
const finalize = (body: Row = { mode: "atomic_upload", replacementDeliverableId: candidateId, ...metadata }, id = reviewId) => PATCH(req(body), { params: Promise.resolve({ reviewId: id }) });

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
