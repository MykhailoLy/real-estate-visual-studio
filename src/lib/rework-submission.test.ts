import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test, { after, beforeEach } from "node:test";
import type { NextRequest } from "next/server";
import ts from "typescript";

type Row = Record<string, unknown>;
const owner = { userId: "11111111-1111-4111-8111-111111111111", email: "synthetic@example.invalid" };
const deliverableId = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const comment = "Please brighten the room.";
const meta = { filename: "reference.png", contentType: "image/png", fileSize: 8 };
const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const state = {
  tables: {} as Record<string, Row[]>, authenticated: true, events: [] as string[], emails: [] as Row[],
  removed: [] as string[], storageFailure: "", dbFailure: "", rpcFailure: "", invalidContent: false,
  objectExists: true, changeBeforeRpc: false, changeBeforeDelete: false, signatureReads: 0, emailFailure: false,
};
function reset() {
  Object.assign(state, { authenticated: true, events: [], emails: [], removed: [], storageFailure: "", dbFailure: "",
    rpcFailure: "", invalidContent: false, objectExists: true, changeBeforeRpc: false, changeBeforeDelete: false,
    signatureReads: 0, emailFailure: false });
  state.tables = {
    order_deliverables: [{ id: deliverableId, order_id: orderId, order_number: "F7-SYNTHETIC", item_index: 1 }],
    orders: [{ id: orderId, user_id: owner.userId, client_email: owner.email }],
    deliverable_reviews: [], deliverable_review_files: [],
  };
}

// Narrow PostgREST/Storage boundary double for the real F7 helpers and routes.
// RPC race semantics are tested separately by native PostgreSQL, not this double.
class Query {
  filters: ((row: Row) => boolean)[] = [];
  values?: Row;
  operation = "read";
  take = Infinity;
  descending = false;
  count = false;
  join = false;
  readonly table: string;
  constructor(table: string) { this.table = table; }
  select(columns: string, options?: { count?: string; head?: boolean }) { this.count = !!options?.count; this.join = columns.includes("orders!inner"); return this; }
  eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this; }
  neq(key: string, value: unknown) { this.filters.push(row => row[key] !== value); return this; }
  in(key: string, values: unknown[]) { this.filters.push(row => values.includes(row[key])); return this; }
  order(_key: string, options: { ascending: boolean }) { this.descending = !options.ascending; return this; }
  limit(n: number) { this.take = n; return this; }
  insert(values: Row) { this.operation = "insert"; this.values = values; return this; }
  delete() { this.operation = "delete"; return this; }
  update(values: Row) { this.operation = "update"; this.values = values; return this; }
  execute(single: boolean) {
    if (state.dbFailure === `${this.table}:${this.operation}`) return { data: null, count: null, error: { message: "PRIVATE DB detail" } };
    if (this.operation === "delete" && state.changeBeforeDelete) {
      state.tables.deliverable_reviews.filter(row => row.status === "pending_review").forEach(row => { row.status = "rework_requested"; });
    }
    let rows = state.tables[this.table].filter(row => this.filters.every(filter => filter(row)));
    if (this.descending) rows = [...rows].reverse();
    rows = rows.slice(0, this.take);
    if (this.operation === "insert") {
      const row = { id: crypto.randomUUID(), created_at: "2026-09-26T12:00:00Z", ...this.values };
      state.tables[this.table].push(row); rows = [row]; state.events.push(`${this.table}:insert`);
    }
    if (this.operation === "delete") {
      state.events.push("retire");
      state.tables[this.table] = state.tables[this.table].filter(row => !rows.includes(row));
      if (this.table === "deliverable_reviews") state.tables.deliverable_review_files = state.tables.deliverable_review_files.filter(file => !rows.some(row => row.id === file.review_id));
    }
    if (this.operation === "update") rows.forEach(row => Object.assign(row, this.values));
    const result = rows.map(row => ({ ...row, ...(this.join ? { orders: state.tables.orders[0] } : {}) }));
    return { data: single ? result[0] ?? null : result, count: this.count ? rows.length : null, error: null };
  }
  async maybeSingle() { return this.execute(true); }
  async single() { return this.execute(true); }
  then(resolve: (result: ReturnType<Query["execute"]>) => unknown) { return Promise.resolve(this.execute(false)).then(resolve); }
}
const supabase = {
  from: (table: string) => new Query(table),
  storage: { from(bucket: string) {
    assert.equal(bucket, "order-files");
    return {
      async createSignedUploadUrl(_path: string, options: { upsert: boolean }) {
        assert.equal(options.upsert, false); state.events.push("sign");
        return state.storageFailure === "sign" ? { data: null, error: {} } : { data: { signedUrl: "https://storage.invalid/upload?token=synthetic" }, error: null };
      },
      async remove(paths: string[]) {
        state.events.push("remove"); state.removed.push(...paths);
        assert.ok(paths.every(path => !state.tables.deliverable_review_files.some(row => row.storage_path === path)), "Metadata was retired before Storage deletion");
        if (state.storageFailure === "remove-throw") throw new Error("PRIVATE storage detail");
        return { error: state.storageFailure === "remove" ? { message: "PRIVATE storage detail" } : null };
      },
      async list(_folder: string, { search }: { search: string }) { return { data: state.objectExists ? [{ name: search }] : [], error: null }; },
      async info() { return { data: { size: 8, contentType: "image/png", etag: "synthetic-etag" }, error: null }; },
      async createSignedUrl() { return { data: { signedUrl: "https://storage.invalid/read" }, error: null }; },
    };
  } },
  async rpc(name: string, args: Row) {
    state.events.push(name);
    if (state.rpcFailure === name) return { data: null, error: { message: "PRIVATE RPC detail" } };
    const review = state.tables.deliverable_reviews.find(row => row.id === args.p_review_id);
    const reply = (result_code: string, extra = {}) => ({ data: [{ result_code, ...extra }], error: null });
    if (!review) return reply("not_found");
    if (state.changeBeforeRpc) review.status = "rework_requested";
    if (review.status !== "pending_review") return reply("invalid_state");
    const files = state.tables.deliverable_review_files.filter(row => row.review_id === review.id);
    if (name === "prepare_rework_reference_file_upload") {
      if (files.length >= 5) return reply("file_limit");
      const file = { id: args.p_file_id, review_id: review.id, order_id: review.order_id, deliverable_id: review.deliverable_id,
        item_index: review.item_index, storage_path: args.p_storage_path, filename: args.p_filename,
        file_size: args.p_file_size, mime_type: args.p_mime_type, uploaded_by: "client", upload_status: "pending", created_at: review.created_at };
      state.tables.deliverable_review_files.push(file);
      return reply("prepared", { file_id: file.id, created_at: file.created_at });
    }
    assert.equal(name, "finalize_rework_review_submission");
    if (files.length !== args.p_expected_file_count || files.some(file => file.upload_status !== "uploaded")) return reply("files_incomplete");
    if (state.tables.deliverable_reviews.some(row => row.id !== review.id && row.deliverable_id === review.deliverable_id && ["rework_requested", "rework_in_progress"].includes(String(row.status)))) return reply("active_rework");
    review.status = "rework_requested";
    return reply("finalized", { review_id: review.id, status: review.status, comment: review.comment, created_at: review.created_at });
  },
};
Object.assign(globalThis, { __f7: { state, supabase, owner, orderId } });
const mock = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return mock("export default undefined;");
    if (specifier === "next/server") return mock("export const NextResponse = Response;");
    if (specifier === "@supabase/supabase-js") return mock("export const createClient = () => globalThis.__f7.supabase;");
    if (specifier === "@/lib/supabase") return mock("export const createServerClient = () => globalThis.__f7.supabase;");
    if (specifier === "@/lib/client-orders") return mock("export const getOwnedOrderIds = async () => [globalThis.__f7.orderId];");
    if (specifier === "@/lib/client-auth") return mock("export const getClientUser = async () => globalThis.__f7.state.authenticated ? {id: globalThis.__f7.owner.userId, email: globalThis.__f7.owner.email} : null;");
    if (specifier === "@/lib/email/review-workflow-notifications") return mock(`export const sendReviewWorkflowEmail = async args => {
      const s = globalThis.__f7.state;
      const review = s.tables.deliverable_reviews.find(r => r.id === args.reviewId);
      if (review.status === 'pending_review') throw new Error('Email before commit');
      s.events.push('email'); s.emails.push(args); return {sent: !s.emailFailure};
    };`);
    if (specifier.startsWith("@/")) return { url: new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-only";
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  state.signatureReads++;
  return new Response(state.invalidContent ? new Uint8Array(8) : PNG, { headers: { "content-length": "8", etag: "synthetic-etag" } });
};
after(() => {
  hooks.deregister(); globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});
beforeEach(reset);
const { submitDeliverableReview, getReviewsForClient, getLatestReviewForDeliverable, finalizeReworkReviewSubmission } = await import("./client-reviews.ts");
const { createReworkReferenceUploadSlot, markReworkReferenceUploaded } = await import("./rework-reference-files.ts");
const { POST: reviewPost } = await import("../app/api/client/deliverables/[deliverableId]/review/route.ts");
const { POST: finalizePost } = await import("../app/api/client/reviews/[reviewId]/finalize/route.ts");
const { POST: slotPost } = await import("../app/api/client/reviews/[reviewId]/reference-files/upload-url/route.ts");
const { POST: completePost } = await import("../app/api/client/reviews/[reviewId]/reference-files/[fileId]/complete/route.ts");
const req = (body: Row) => new Request("https://synthetic.invalid/api", { method: "POST", body: JSON.stringify(body) }) as NextRequest;
const reviewRequest = (count?: number) => reviewPost(req({ action: "rework_requested", comment, ...(count === undefined ? {} : { reference_file_count: count }) }), { params: Promise.resolve({ deliverableId }) });
const finalizeRequest = (reviewId: string, count = 1) => finalizePost(req({ expected_file_count: count }), { params: Promise.resolve({ reviewId }) });
async function prepare() {
  const res = await reviewRequest(1); assert.equal(res.status, 200);
  return (await res.json()).review.id as string;
}
function addReview(status: string, id = crypto.randomUUID()): Row {
  const row = { id, deliverable_id: deliverableId, order_id: orderId, status, comment, created_at: "2026-09-26T12:00:00Z" };
  state.tables.deliverable_reviews.push(row); return row;
}
function addFile(review: Row, upload_status = "uploaded") {
  const row = { id: crypto.randomUUID(), review_id: review.id, storage_path: `PRIVATE/${review.id}/reference.png`, upload_status };
  state.tables.deliverable_review_files.push(row); return row;
}

test("F7 prepare is hidden and sends no email; exact verified files finalize once then email", async () => {
  const id = await prepare();
  assert.equal(state.tables.deliverable_reviews[0].status, "pending_review");
  assert.equal(state.emails.length, 0);
  assert.deepEqual(await getReviewsForClient(owner), []);
  const slot = await createReworkReferenceUploadSlot(id, owner, meta, "pending_rework"); assert.equal(slot.ok, true);
  if (!slot.ok) return;
  assert.deepEqual(state.events.slice(-2), ["sign", "prepare_rework_reference_file_upload"]);
  assert.equal((await finalizeRequest(id)).status, 409); assert.equal(state.emails.length, 0);
  const completed = await completePost(req({}), { params: Promise.resolve({ reviewId: id, fileId: slot.file.id }) });
  assert.equal(completed.status, 200); assert.equal(state.signatureReads, 1);
  assert.doesNotMatch(await completed.text(), /storage_path|PRIVATE|token/);
  const res = await finalizeRequest(id); assert.equal(res.status, 200);
  const publicResult = await res.json();
  assert.deepEqual(Object.keys(publicResult.review).sort(), ["comment", "created_at", "id", "status"]);
  assert.doesNotMatch(JSON.stringify(publicResult), /storage_path|client_email|user_id|PRIVATE|token/);
  assert.deepEqual(state.events.slice(-2), ["finalize_rework_review_submission", "email"]);
  assert.equal(state.emails.length, 1);
  assert.equal((await finalizeRequest(id)).status, 409); assert.equal(state.emails.length, 1);
});

for (const count of [undefined, 0]) test(`F7 legacy/text-only count=${count} stays one POST and immediate email`, async () => {
  const res = await reviewRequest(count);
  assert.equal(res.status, 200); assert.equal((await res.json()).review.status, "rework_requested");
  assert.equal(state.emails.length, 1); assert.equal(state.events.some(event => event.includes("submission")), false);
});

test("F7 email failure after committed review retains existing best-effort success", async () => {
  const id = await prepare(); const slot = await createReworkReferenceUploadSlot(id, owner, meta, "pending_rework");
  assert.equal(slot.ok, true); if (!slot.ok) return;
  await markReworkReferenceUploaded(id, slot.file.id, owner); state.emailFailure = true;
  assert.equal((await finalizeRequest(id)).status, 200);
  assert.equal(state.tables.deliverable_reviews[0].status, "rework_requested");
});

for (const failure of ["sign", "rpc", "missing", "invalid-content"]) test(`F7 ${failure} prevents activation/email and returns safe errors`, async () => {
  const id = await prepare();
  state.storageFailure = failure === "sign" ? "sign" : "";
  state.rpcFailure = failure === "rpc" ? "prepare_rework_reference_file_upload" : "";
  const slot = await createReworkReferenceUploadSlot(id, owner, meta, "pending_rework");
  if (failure === "sign" || failure === "rpc") {
    assert.equal(slot.ok, false); assert.equal(state.tables.deliverable_review_files.length, 0);
    assert.doesNotMatch(JSON.stringify(slot), /signedUrl|storage_path|token|PRIVATE/);
  } else {
    assert.equal(slot.ok, true); if (!slot.ok) return;
    state.objectExists = failure !== "missing"; state.invalidContent = failure === "invalid-content";
    const complete = await markReworkReferenceUploaded(id, slot.file.id, owner);
    assert.equal(complete.ok, false);
    if (failure === "invalid-content" && !complete.ok) assert.equal(complete.code, "invalid_upload");
    assert.equal(state.tables.deliverable_review_files[0].upload_status, "pending");
  }
  assert.equal((await finalizeRequest(id)).status, 409);
  assert.equal(state.tables.deliverable_reviews[0].status, "pending_review"); assert.equal(state.emails.length, 0);
});

test("F7 strict late slot fails at RPC even after app status SELECT; legacy active uploads still work", async () => {
  const id = await prepare(); state.changeBeforeRpc = true;
  const rejected = await createReworkReferenceUploadSlot(id, owner, meta, "pending_rework");
  assert.equal(rejected.ok, false); if (!rejected.ok) assert.equal(rejected.status, 409);
  assert.equal(state.tables.deliverable_review_files.length, 0);
  assert.doesNotMatch(JSON.stringify(rejected), /signedUrl|token|storage_path/);
  state.changeBeforeRpc = false;
  const legacy = await createReworkReferenceUploadSlot(id, owner, meta);
  assert.equal(legacy.ok, true);
  assert.equal(state.tables.deliverable_review_files[0].upload_status, "pending");
});

test("F7 visible history/latest exclude only pending_review, preserving every existing status", async () => {
  for (const status of ["approved", "resolved", "rework_requested", "rework_in_progress", "rework_delivered"]) {
    reset(); const visible = addReview(status); addReview("pending_review");
    assert.deepEqual((await getReviewsForClient(owner)).map(row => row.id), [visible.id]);
    assert.equal((await getLatestReviewForDeliverable(deliverableId, owner))?.id, visible.id);
  }
});

for (const status of ["rework_requested", "rework_in_progress"]) test(`F7 newer preparation cannot mask older ${status}`, async () => {
  addReview(status); addReview("approved"); addReview("pending_review");
  const result = await submitDeliverableReview(deliverableId, owner, "rework_requested", comment, 1);
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.status, 409);
  assert.equal(state.tables.deliverable_reviews.length, 3); assert.deepEqual(state.removed, []);
});

for (const failure of ["", "remove", "remove-throw"]) test(`F7 retry retires only pending metadata before best-effort Storage cleanup (${failure || "success"})`, async () => {
  const committed = addReview("resolved"), old = addReview("pending_review");
  const keep = addFile(committed); const retire = addFile(old);
  state.storageFailure = failure;
  const id = await prepare(); assert.notEqual(id, old.id);
  assert.deepEqual(state.removed, [retire.storage_path]);
  assert.deepEqual(state.tables.deliverable_review_files, [keep]);
  assert.deepEqual(state.tables.deliverable_reviews.map(row => row.status), ["resolved", "pending_review"]);
  assert.equal(state.events.indexOf("retire") < state.events.indexOf("remove"), true); assert.equal(state.emails.length, 0);
});

for (const table of ["deliverable_reviews:read", "deliverable_review_files:read", "deliverable_reviews:delete"]) test(`F7 failed cleanup ${table} aborts new preparation`, async () => {
  const old = addReview("pending_review"); addFile(old); state.dbFailure = table;
  assert.equal((await reviewRequest(1)).status, 500);
  assert.equal(state.tables.deliverable_reviews.length, 1); assert.deepEqual(state.removed, []);
});

test("F7 cleanup racing finalization never removes committed metadata or objects", async () => {
  const old = addReview("pending_review"); const keep = addFile(old); state.changeBeforeDelete = true;
  assert.equal((await reviewRequest(1)).status, 409);
  assert.deepEqual(state.tables.deliverable_review_files, [keep]); assert.deepEqual(state.removed, []);
  assert.equal(state.tables.deliverable_reviews.length, 1);
});

test("F7 route validation/auth/ownership fail safely before side effects", async () => {
  const id = await prepare(); state.events = [];
  for (const count of [-1, 1.5, 6]) assert.equal((await reviewRequest(count)).status, 400);
  for (const count of [0, 1.5, 6]) assert.equal((await finalizeRequest(id, count)).status, 400);
  assert.equal((await finalizeRequest("invalid-id")).status, 400);
  const invalidMode = await slotPost(req({ filename: meta.filename, content_type: meta.contentType, file_size: 8, submission_mode: "legacy" }), { params: Promise.resolve({ reviewId: id }) });
  assert.equal(invalidMode.status, 400);
  state.authenticated = false;
  assert.equal((await finalizeRequest(id)).status, 401); assert.equal((await reviewRequest(1)).status, 401);
  state.authenticated = true; state.tables.orders[0].user_id = crypto.randomUUID();
  assert.equal((await finalizeRequest(id)).status, 404); assert.equal((await reviewRequest(1)).status, 404);
  const slot = await createReworkReferenceUploadSlot(id, owner, meta, "pending_rework");
  assert.equal(slot.ok, false); if (!slot.ok) assert.equal(slot.status, 404);
  assert.deepEqual(state.events, []); assert.equal(state.emails.length, 0);
});

test("F7 finalization RPC failure never sends email or exposes DB details", async () => {
  const id = await prepare(); state.rpcFailure = "finalize_rework_review_submission";
  const result = await finalizeReworkReviewSubmission(id, owner, 1);
  assert.equal(result.ok, false); assert.doesNotMatch(JSON.stringify(result), /PRIVATE|token|storage_path/);
  assert.equal((await finalizeRequest(id)).status, 500); assert.equal(state.emails.length, 0);
});

test("F7 rework remains available after approved/resolved; approval retains its terminal guard", async () => {
  for (const status of ["approved", "resolved"]) {
    reset(); addReview(status);
    const approval = await submitDeliverableReview(deliverableId, owner, "approve");
    assert.equal(approval.ok, false); if (!approval.ok) assert.equal(approval.status, 409);
    assert.equal((await reviewRequest(1)).status, 200);
    assert.equal(state.tables.deliverable_reviews.at(-1)?.status, "pending_review");
  }
});

test("F7 strict upload route returns only safe metadata and the required signed upload capability", async () => {
  const id = await prepare();
  const res = await slotPost(req({ filename: meta.filename, content_type: meta.contentType, file_size: 8,
    submission_mode: "pending_rework", user_id: "attacker", storage_path: "attacker-path" }), { params: Promise.resolve({ reviewId: id }) });
  assert.equal(res.status, 200); const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ["file", "ok", "signedUrl"]);
  assert.deepEqual(Object.keys(body.file).sort(), ["created_at", "file_size", "filename", "id", "mime_type", "review_id"]);
  assert.doesNotMatch(JSON.stringify(body.file), /storage_path|token|PRIVATE|attacker/);
  assert.equal(state.tables.deliverable_review_files[0].order_id, orderId);
  assert.notEqual(state.tables.deliverable_review_files[0].storage_path, "attacker-path");
});

test("F7 unique file IDs do not shorten the existing filename budget or lose its extension", async () => {
  const id = await prepare();
  const slot = await createReworkReferenceUploadSlot(id, owner, { ...meta, filename: `${"a".repeat(80)}.png` }, "pending_rework");
  assert.equal(slot.ok, true); if (!slot.ok) return;
  assert.equal((await markReworkReferenceUploaded(id, slot.file.id, owner)).ok, true);
  assert.ok(String(state.tables.deliverable_review_files[0].storage_path).includes(slot.file.id));
});

test("F7 admin order detail executes queries excluding internal reviews and their file count", async () => {
  const path = "src/app/(default)/(public)/admin/orders/[orderId]/page.tsx";
  const source = readFileSync(path, "utf8"), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const committed = addReview("resolved"), hidden = addReview("pending_review"); addFile(committed); addFile(hidden);
  state.tables.deliverable_review_files.forEach(row => { row.order_id = orderId; });
  const executeQuery = async (binding: string, reviews: Row[] = []) => {
    let expression = "";
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast).includes(binding)) expression = node.initializer?.getText(ast) ?? "";
      ts.forEachChild(node, visit);
    }
    visit(ast); assert.ok(expression);
    const js = ts.transpileModule(`async function query() { return ${expression}; }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function("supabase", "orderId", "reviews", `${js}; return query();`)(supabase, orderId, reviews) as Promise<{ data: Row[] }>;
  };
  const reviews = (await executeQuery("data: revData")).data;
  assert.deepEqual(reviews.map(row => row.id), [committed.id]);
  assert.deepEqual((await executeQuery("data: refFileData", reviews)).data.map(row => row.review_id), [committed.id]);
  const queue = readFileSync("src/app/(default)/(public)/admin/rework/page.tsx", "utf8");
  assert.match(queue, /\.in\("status",\s*\["rework_requested", "rework_in_progress"\]\)/);
});
