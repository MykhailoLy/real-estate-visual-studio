import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import { createPricingExpectation } from "../pricing/expectation.ts";
import type { OrderPricingInput, PricingSnapshot, TransactionalServiceType } from "../pricing/types.ts";
import { WELCOME_OFFER_BENEFIT_KEYS } from "../welcome-offer.ts";
import type { SubmitOrderDraftInput } from "./finalization-server.ts";
import type { OrderDraftDatabaseRow, OrderDraftFileDatabaseRow } from "./database.ts";
import { mapVirtualStagingFormToDraftState } from "./virtual-staging.ts";
import { createPhotoEditingFormItem, mapPhotoEditingFormToDraftState } from "./photo-editing.ts";
import { createVirtualRenovationFormItem, mapVirtualRenovationFormToDraftState } from "./virtual-renovation.ts";
import { createFloorPlanFormItem, mapFloorPlansFormToDraftState } from "./floor-plans.ts";

// Only external transports are replaced. Both production services, validation,
// request/quote hashes, pricing and file signature/finalization code run intact.
// RPCs below model the post-F5 schema; native PostgreSQL tests prove SQL safety.
const ADMIN_MOCK = `data:text/javascript,${encodeURIComponent(`
export class SupabaseAdminConfigurationError extends Error {}
export function getSupabaseAdminClient() { return globalThis.__directOrderTestSupabase; }
`)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export default undefined", shortCircuit: true };
  if (specifier === "@/lib/supabase-admin" || specifier === "../supabase-admin.ts") {
    return { url: ADMIN_MOCK, shortCircuit: true };
  }
  if (specifier === "@/lib/email/send-order-emails") return {
    url: "data:text/javascript,export async function dispatchOrderEmailOutbox(args){return typeof globalThis.__directOrderEmailMock === 'function' ? globalThis.__directOrderEmailMock(args) : {clientConfirmationSent:true,adminNotificationSent:true}}", shortCircuit: true,
  };
  if (specifier.startsWith("@/")) {
    // The combined draft suite also imports direct-order tests. Give their
    // existing transport hooks (auth, email, etc.) first refusal.
    try { return nextResolve(specifier, context); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ERR_MODULE_NOT_FOUND") throw error;
      const path = resolve("src", `${specifier.slice(2)}.ts`);
      if (existsSync(path)) return { url: pathToFileURL(path).href, shortCircuit: true };
      throw error;
    }
  }
  return nextResolve(specifier, context);
} });

const USER = "11111111-1111-4111-8111-111111111111";
const DRAFT = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const ORIGINAL = "55555555-5555-4555-8555-555555555555";
const REFERENCE = "66666666-6666-4666-8666-666666666666";
const K1 = "77777777-7777-4777-8777-777777777777";
const K2 = "88888888-8888-4888-8888-888888888888";
const NOW = "2026-09-23T10:00:00.000Z";
type Row = Record<string, unknown>;
type RpcResult = { data: unknown; error: { message: string } | null };

function fixtureState(service: TransactionalServiceType) {
  const common = {
    jobTitle: "123 Main Street", currency: "USD" as const, region: "US" as const,
    orderTerms: { accepted: true, earlyPerformanceRequested: true, allowPortfolio: false },
  };
  const file = { name: "living.jpg" };
  switch (service) {
    case "virtual-staging": return mapVirtualStagingFormToDraftState({ ...common, items: [{
      clientItemId: ITEM, file, roomName: "Living Room", furnitureStyle: "Modern",
      fileSizeLimit: "", disclaimerText: "", referenceLink: "", referenceFiles: [],
      additionalInfo: "Warm accents", selectedAddons: [],
    }] });
    case "photo-editing": return mapPhotoEditingFormToDraftState({ ...common, items: [{
      ...createPhotoEditingFormItem(), clientItemId: ITEM, file, selectedOptions: ["shadow-removal"],
    }] });
    case "virtual-renovation": return mapVirtualRenovationFormToDraftState({ ...common, items: [{
      ...createVirtualRenovationFormItem(), clientItemId: ITEM, file,
      selectedInternal: ["replace-flooring"], room: "Kitchen", presentationStyle: "Modern",
    }] });
    case "3d-floor-plans": return mapFloorPlansFormToDraftState({ ...common, items: [{
      ...createFloorPlanFormItem(), clientItemId: ITEM, file, planType: "2d-bw",
      pageOrientation: "Portrait", planOrientation: "Landscape",
    }] });
  }
}

function fileRow(id = ORIGINAL, filename = "living.jpg", kind = "original"): OrderDraftFileDatabaseRow {
  return {
    id, draft_id: DRAFT, item_client_id: ITEM, item_index: 0, kind,
    bucket: "order-files", storage_path: `drafts/${USER}/${DRAFT}/${id}/${filename}`,
    original_filename: filename, file_size: 1234, mime_type: "image/jpeg",
    content_hash: null, upload_status: "uploaded", created_at: NOW, updated_at: NOW,
    deleted_at: null, moved_at: null,
  };
}

class Query {
  private filters = new Map<string, unknown>();
  private rows: () => Row[];
  constructor(rows: () => Row[]) { this.rows = rows; }
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.set(key, value); return this; }
  is(key: string, value: unknown) { return this.eq(key, value); }
  order() { return this; }
  private values() {
    return structuredClone(this.rows().filter((row) => [...this.filters].every(([key, value]) => row[key] === value)));
  }
  async maybeSingle() { return { data: this.values()[0] ?? null, error: null }; }
  then(resolveValue: (value: { data: Row[]; error: null }) => unknown) {
    return Promise.resolve({ data: this.values(), error: null }).then(resolveValue);
  }
}

class DraftAdapter {
  readonly state: ReturnType<typeof fixtureState>;
  readonly draft: OrderDraftDatabaseRow;
  files = [fileRow()];
  references: Row[] = [];
  readonly submissions = new Map<string, Row>();
  readonly orders: Row[] = [];
  readonly orderItems: Row[] = [];
  readonly outbox: string[] = [];
  readonly calls: Array<{ name: string; input: Row; result?: string }> = [];
  readonly objects = new Map<string, { size: number; contentType: string; etag: string }>();
  readonly copies: Array<{ source: string; destination: string }> = [];
  readonly removed: string[] = [];
  welcomeAvailable = true;
  failCopy = true;
  failList = false;
  failListDirectory: string | null = null;
  releaseReply: "released" | "error" | "throw" | "malformed" | "order_exists" | "wrong_draft" | "missing_draft" | "multiple_rows" | "object_row" | "converted_order" = "released";
  ambiguousCommit = false;
  readonly service: TransactionalServiceType;
  constructor(service: TransactionalServiceType = "virtual-staging") {
    this.service = service;
    this.state = fixtureState(service);
    this.draft = {
      id: DRAFT, user_id: USER, service_type: service, sub_service: null,
      route: `/dashboard/orders/new/${service}`, title: this.state.jobTitle,
      current_step: this.state.currentStep, state: this.state, state_schema_version: 1,
      pricing_preview: null, pricing_version_seen: null, currency: "USD", region: "US",
      status: "active", version: 4, finalization_key: null, converted_order_id: null,
      created_at: NOW, updated_at: NOW, last_autosaved_at: NOW,
      expires_at: "2099-10-23T10:00:00.000Z", converted_at: null, deleted_at: null,
    };
    this.addObject(this.files[0]);
  }
  addObject(file: OrderDraftFileDatabaseRow) {
    this.objects.set(file.storage_path, { size: file.file_size, contentType: file.mime_type, etag: `"${file.id}"` });
  }
  from(table: string) {
    return new Query(() => {
      switch (table) {
        case "order_drafts": return [this.draft as unknown as Row];
        case "order_draft_files": return this.files as unknown as Row[];
        case "order_draft_item_reference_files": return this.references;
        case "orders": return this.orders;
        case "order_items": return this.orderItems;
        case "order_submissions": return [...this.submissions.values()];
        case "account_pricing": return [];
        case "welcome_offer_redemptions": return this.welcomeAvailable ? [] : WELCOME_OFFER_BENEFIT_KEYS.map((benefit_key) => ({ user_id: USER, benefit_key }));
        default: throw new Error(`Unexpected table ${table}`);
      }
    });
  }
  readonly storage = { from: (bucket: string) => {
    assert.equal(bucket, "order-files");
    return {
      list: async (directory: string) => this.failList || this.failListDirectory === directory
        ? { data: null, error: { message: "ControlledListFailure" } }
        : { data: [...this.objects].filter(([path]) => path.startsWith(`${directory}/`))
          .map(([path, object]) => ({ name: path.slice(directory.length + 1), metadata: { size: object.size, mimetype: object.contentType } })), error: null },
      info: async (path: string) => ({ data: this.objects.get(path) ?? null, error: this.objects.has(path) ? null : { message: "NotFound" } }),
      createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://f5.invalid/read/${encodeURIComponent(path)}` }, error: null }),
      copy: async (source: string, destination: string) => {
        this.copies.push({ source, destination });
        if (this.failCopy) return { data: null, error: { name: "ControlledCopyFailure", message: "ControlledCopyFailure" } };
        const object = this.objects.get(source);
        assert.ok(object, source);
        this.objects.set(destination, structuredClone(object));
        return { data: { path: destination }, error: null };
      },
      remove: async (paths: string[]) => {
        this.removed.push(...paths);
        paths.forEach((path) => this.objects.delete(path));
        return { data: null, error: null };
      },
    };
  } };
  async readObject(input: RequestInfo | URL): Promise<Response> {
    const url = new URL(typeof input === "string" ? input : input.toString());
    assert.equal(url.hostname, "f5.invalid");
    const object = this.objects.get(decodeURIComponent(url.pathname.slice("/read/".length)));
    assert.ok(object);
    const bytes = new Uint8Array(Math.min(512, object.size));
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    return new Response(bytes, { status: 206, headers: {
      "content-range": `bytes 0-${bytes.length - 1}/${object.size}`, etag: object.etag,
    } });
  }
  async rpc(name: string, input: Row): Promise<RpcResult> {
    const call: { name: string; input: Row; result?: string } = { name, input: structuredClone(input) };
    this.calls.push(call);
    const row = (code: string, extra: Row = {}): RpcResult => {
      call.result = code;
      return { data: [{ result_code: code, draft_id: DRAFT, converted_order_id: this.orders[0]?.id ?? null, ...extra }], error: null };
    };
    if (name === "claim_order_draft_finalization") {
      if (input.p_user_id !== USER) return row("not_found");
      if (this.draft.status === "converted") return row("already_converted");
      if (this.orders.length) return row("already_claimed");
      if (this.draft.version !== input.p_expected_version) return row("version_conflict");
      if (this.draft.status === "converting") return row(this.draft.finalization_key === input.p_finalization_key ? "already_claimed" : "finalization_conflict");
      this.draft.status = "converting";
      this.draft.finalization_key = String(input.p_finalization_key);
      return row("claimed");
    }
    if (name === "release_order_draft_finalization") {
      if (this.releaseReply === "throw") throw new Error("ControlledReleaseFailure");
      if (this.releaseReply === "error") return { data: null, error: { message: "ControlledReleaseFailure" } };
      if (this.releaseReply === "malformed") return { data: [{}], error: null };
      const releasedRow = { result_code: "released", draft_id: DRAFT, converted_order_id: null };
      if (this.releaseReply === "wrong_draft") return { data: [{ ...releasedRow, draft_id: K2 }], error: null };
      if (this.releaseReply === "missing_draft") return { data: [{ result_code: "released" }], error: null };
      if (this.releaseReply === "multiple_rows") return { data: [releasedRow, releasedRow], error: null };
      if (this.releaseReply === "object_row") return { data: releasedRow, error: null };
      if (this.releaseReply === "converted_order") return { data: [{ ...releasedRow, converted_order_id: K2 }], error: null };
      if (this.orders.length || this.releaseReply === "order_exists") return row("order_exists");
      if (input.p_finalization_key !== this.draft.finalization_key) return row("finalization_conflict");
      this.draft.status = "active"; this.draft.finalization_key = null;
      return row("released");
    }
    if (name === "claim_order_submission") {
      const id = String(input.p_submission_id);
      let stored = this.submissions.get(id);
      if (!stored) {
        stored = { ...structuredClone(input), submission_id: id, user_id: input.p_user_id, status: "processing",
          reserved_order_id: crypto.randomUUID(), reserved_order_number: `F5-${this.submissions.size + 1}`, pricing_snapshot: structuredClone(input.p_pricing_snapshot) };
        this.submissions.set(id, stored);
      } else if (stored.p_request_hash !== input.p_request_hash) return row("payload_conflict");
      else if (stored.status !== "committed" && stored.p_quote_hash !== input.p_quote_hash) return row("pricing_changed");
      else if (stored.status !== "committed" && stored.p_lease_token) return row("in_progress");
      stored.p_lease_token = input.p_lease_token;
      return row(stored.status === "committed" ? "committed" : "claimed", {
        lease_token: input.p_lease_token, reserved_order_id: stored.reserved_order_id,
        reserved_order_number: stored.reserved_order_number, order_id: stored.order_id ?? null,
        estimated_total_cents: stored.p_estimated_total_cents, currency: stored.p_currency, pricing_snapshot: stored.pricing_snapshot,
      });
    }
    if (name === "release_order_submission") {
      const stored = this.submissions.get(String(input.p_submission_id));
      assert.ok(stored);
      assert.equal(stored.p_lease_token, input.p_lease_token);
      stored.p_lease_token = null;
      return { data: "released", error: null };
    }
    if (name.startsWith("commit_order_submission")) {
      if (this.ambiguousCommit) return { data: null, error: { message: "ControlledCommitResponseLoss" } };
      const stored = this.submissions.get(String(input.p_submission_id));
      assert.ok(stored);
      if (stored.p_lease_token !== input.p_lease_token) return row("lease_conflict");
      if (this.draft.version !== input.p_draft_expected_version || this.draft.status !== "converting" || this.draft.finalization_key !== input.p_draft_finalization_key) return row("draft_conflict");
      assert.equal(this.orders.length, 0, "SQL source-draft uniqueness is proved separately in PostgreSQL");
      const items = input.p_items as Array<Row & { details: Row }>;
      this.orders.push({ id: stored.reserved_order_id, order_number: stored.reserved_order_number, user_id: USER,
        service_type: this.service, source_draft_id: DRAFT, item_count: items.length, job_title: input.p_job_title });
      this.orderItems.push(...items.map((item) => ({ ...structuredClone(item), order_id: stored.reserved_order_id,
        item_index: item.itemIndex, original_photo_path: item.originalPhotoPath, reference_image_path: item.referenceImagePath })));
      this.outbox.push("client_confirmation", "admin_notification");
      stored.status = "committed"; stored.order_id = stored.reserved_order_id;
      this.draft.status = "converted"; this.draft.converted_order_id = String(stored.order_id);
      return row("created", { created: true, order_id: stored.order_id, order_number: stored.reserved_order_number,
        estimated_total_cents: stored.p_estimated_total_cents, currency: stored.p_currency, pricing_snapshot: stored.pricing_snapshot, item_count: items.length });
    }
    if (name === "complete_order_draft_finalization") {
      assert.equal(input.p_finalization_key, this.draft.finalization_key);
      this.draft.status = "converted";
      return row("completed");
    }
    throw new Error(`Unexpected RPC ${name}`);
  }
  expectation() {
    const input = { serviceType: this.service, currency: "USD", items: this.state.items.map((item) => item.state) } as OrderPricingInput;
    return createPricingExpectation(calculateOrderQuote(input, { welcomeOfferAvailability: {
      imageEnhancementAvailable: this.welcomeAvailable, dayToDuskAvailable: this.welcomeAvailable, virtualStagingAvailable: this.welcomeAvailable,
    } }));
  }
  input(key = K1): SubmitOrderDraftInput {
    return { userId: USER, draftId: DRAFT, expectedVersion: this.draft.version, finalizationKey: key,
      clientIdentity: { name: "Ada Client", email: "ada@example.com", phone: "+15551234567", company: "" }, pricingExpectation: this.expectation() };
  }
}

async function submit(db: DraftAdapter, input = db.input()) {
  const globals = globalThis as typeof globalThis & { __directOrderTestSupabase?: unknown };
  const previous = globals.__directOrderTestSupabase;
  const previousFetch = globalThis.fetch;
  globals.__directOrderTestSupabase = db;
  globalThis.fetch = (url) => db.readObject(url);
  try {
    const { submitOrderDraftForUser } = await import("./finalization-server.ts");
    return await submitOrderDraftForUser(input);
  } finally {
    globals.__directOrderTestSupabase = previous;
    globalThis.fetch = previousFetch;
  }
}

async function failAfterReservation(db: DraftAdapter, key = K1) {
  const result = await submit(db, db.input(key));
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("Expected controlled Storage failure");
  assert.equal(result.code, "storage_error", JSON.stringify(result));
  assert.equal(db.submissions.size, 1);
  assert.equal([...db.submissions.values()][0].p_lease_token, null);
  assert.equal(db.draft.status, "active");
  assert.equal(db.draft.finalization_key, null);
  assert.equal(db.copies.length, 1);
  assert.equal(db.objects.has(db.files[0].storage_path), true);
  assert.equal(db.orders.length, 0);
  db.failCopy = false;
  return result;
}

test("F5 title/instruction edits after released Storage failure use a new immutable attempt", async () => {
  const db = new DraftAdapter();
  await failAfterReservation(db);
  const historical = structuredClone([...db.submissions.values()][0]);
  db.state.jobTitle = "Edited listing";
  db.state.items[0].state.additionalInfo = "New instructions after failure";
  db.draft.version += 1;
  const result = await submit(db, db.input(K2));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(db.submissions.get(K1), historical);
  assert.equal(db.submissions.size, 2);
  assert.equal(db.orders.length, 1);
  assert.equal(db.orders[0].job_title, "Edited listing");
  assert.equal((db.orderItems[0].details as Row).additional_info, "New instructions after failure");
  assert.notEqual(db.submissions.get(K2)?.p_request_hash, historical.p_request_hash);
});

test("F5 reviewed current pricing gets its own snapshot and leaves the failed snapshot immutable", async () => {
  const db = new DraftAdapter();
  await failAfterReservation(db);
  const historical = structuredClone([...db.submissions.values()][0]);
  db.welcomeAvailable = false;
  db.draft.version += 1;
  const result = await submit(db, db.input(K2));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(db.submissions.get(K1), historical);
  const current = db.submissions.get(K2)!;
  assert.equal((historical.pricing_snapshot as PricingSnapshot).totalCents, 950);
  assert.equal((current.pricing_snapshot as PricingSnapshot).totalCents, 1900);
  assert.notEqual(current.p_quote_hash, historical.p_quote_hash);
});

test("F5 item configuration change is represented in K2 hash and committed item", async () => {
  const db = new DraftAdapter();
  await failAfterReservation(db);
  const previousHash = db.submissions.get(K1)?.p_request_hash;
  const state = db.state.items[0].state as Row;
  state.furnitureStyle = "Scandinavian";
  state.selectedAddons = ["day-to-dusk"];
  db.draft.version += 1;
  const result = await submit(db, db.input(K2));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.notEqual(db.submissions.get(K2)?.p_request_hash, previousHash);
  assert.equal((db.orderItems[0].details as Row).furniture_style, "Scandinavian");
  assert.deepEqual((db.orderItems[0].details as Row).selected_addons, ["day-to-dusk"]);
});

function setReference(db: DraftAdapter, reference: OrderDraftFileDatabaseRow) {
  db.files.push(reference);
  db.addObject(reference);
  db.references = [{
    draft_id: DRAFT, item_index: 0, item_client_id: ITEM, reference_id: reference.id,
    position: 0, storage_path: reference.storage_path, original_filename: reference.original_filename,
    file_size: reference.file_size, mime_type: reference.mime_type, upload_status: "uploaded", deleted_at: null,
  }];
  const state = db.state.items[0].state as Row;
  state.referenceFilename = reference.original_filename;
  state.referenceFiles = [{ id: reference.id, filename: reference.original_filename,
    fileSize: reference.file_size, mimeType: reference.mime_type, lastModified: null }];
}

test("F5 replacement after release copies and commits only the current original and normalized reference", async () => {
  const db = new DraftAdapter();
  setReference(db, fileRow(REFERENCE, "old-reference.jpg", "reference"));
  await failAfterReservation(db);
  const oldPaths = db.files.map((file) => file.storage_path);
  db.files.forEach((file) => { file.deleted_at = NOW; });
  const replacement = fileRow("99999999-9999-4999-8999-999999999999", "replacement.jpg");
  db.files.push(replacement); db.addObject(replacement);
  setReference(db, fileRow("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "new-reference.jpg", "reference"));
  db.state.items[0].state.originalFilename = replacement.original_filename;
  db.draft.version += 1;
  const historical = structuredClone(db.submissions.get(K1));
  const result = await submit(db, db.input(K2));
  assert.equal(result.ok, true, JSON.stringify(result));
  const copies = db.copies.slice(1);
  assert.equal(copies.length, 2);
  assert.ok(copies.every((copy) => !oldPaths.includes(copy.source)));
  const uploaded = (db.orderItems[0].details as Row).uploaded_files as { original: Row; reference: Row; references: Row[] };
  assert.equal(uploaded.original.original_filename, replacement.original_filename);
  assert.equal(uploaded.reference.original_filename, "new-reference.jpg");
  assert.equal(db.orderItems[0].originalPhotoPath, copies.find((copy) => copy.source === replacement.storage_path)?.destination);
  assert.equal(db.orderItems[0].referenceImagePath, copies.find((copy) => copy.source.endsWith("/new-reference.jpg"))?.destination);
  assert.equal(uploaded.references.length, 1);
  assert.equal((db.orderItems[0].references as Row[]).length, 1);
  assert.deepEqual(db.submissions.get(K1), historical);
  assert.ok(oldPaths.every((path) => !db.removed.includes(path)));
});

for (const service of ["virtual-staging", "photo-editing", "virtual-renovation", "3d-floor-plans"] as const) {
  test(`F5 ${service}: shared finalizer separates new attempt identity from source draft identity`, async () => {
    const db = new DraftAdapter(service);
    await failAfterReservation(db);
    db.state.jobTitle = "Changed after release"; db.draft.version += 1;
    const result = await submit(db, db.input(K2));
    assert.equal(result.ok, true, JSON.stringify(result));
    const claims = db.calls.filter((call) => call.name === "claim_order_submission");
    assert.deepEqual(claims.map((call) => call.input.p_submission_id), [K1, K2]);
    assert.ok(claims.every((call) => call.input.p_source_draft_id === DRAFT && call.input.p_user_id === USER));
    const commit = db.calls.find((call) => call.name.startsWith("commit_order_submission"))!;
    assert.equal(commit.input.p_draft_expected_version, 5);
    assert.equal(commit.input.p_draft_finalization_key, K2);
    assert.equal(db.orders.length, 1); assert.equal(db.orderItems.length, 1);
    assert.deepEqual(db.outbox, ["client_confirmation", "admin_notification"]);
  });
}

test("F5 unchanged same-key retry reuses reservation and Welcome commit, then source-order replay", async () => {
  const db = new DraftAdapter();
  await failAfterReservation(db);
  const historical = structuredClone(db.submissions.get(K1)!);
  const result = await submit(db, db.input(K1));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(db.submissions.size, 1);
  assert.equal(db.submissions.get(K1)?.reserved_order_id, historical.reserved_order_id);
  assert.equal(db.submissions.get(K1)?.reserved_order_number, historical.reserved_order_number);
  assert.deepEqual(db.submissions.get(K1)?.pricing_snapshot, historical.pricing_snapshot);
  assert.equal(db.calls.filter((call) => call.name === "commit_order_submission_with_welcome_offer_v1").length, 1);
  const replay = await submit(db, db.input(K1));
  assert.equal(replay.ok, true, JSON.stringify(replay));
  if (result.ok && replay.ok) assert.equal(replay.data.orderId, result.data.orderId);
  assert.equal(db.orders.length, 1); assert.equal(db.orderItems.length, 1); assert.equal(db.outbox.length, 2);
  assert.equal(db.calls.filter((call) => call.name === "claim_order_submission").length, 2);
});

test("F5 historical draftId submission remains untouched while a new key finalizes edited draft", async () => {
  const db = new DraftAdapter();
  // D is a valid old identity; creating it through the real service produces the
  // historical predeployment row shape without fabricating request/quote hashes.
  await failAfterReservation(db, DRAFT);
  const historical = structuredClone(db.submissions.get(DRAFT));
  db.state.jobTitle = "Recover historical stuck draft"; db.draft.version += 1;
  const result = await submit(db, db.input(K2));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(db.submissions.get(DRAFT), historical);
  assert.equal(db.submissions.get(K2)?.p_source_draft_id, DRAFT);
  assert.equal(db.orders.length, 1);
});

test("F5 interrupted completion reconciles the existing source order with no new submission or side effects", async () => {
  const db = new DraftAdapter(); db.failCopy = false;
  const created = await submit(db);
  assert.equal(created.ok, true, JSON.stringify(created));
  // Represent a historical interrupted completion: order/final objects already
  // durable, draft/source rows not retired. No new order is seeded for replay.
  db.draft.status = "converting"; db.draft.converted_order_id = null;
  db.files.forEach((file) => db.addObject(file));
  const before = { submissions: db.submissions.size, orders: db.orders.length, items: db.orderItems.length, outbox: db.outbox.length };
  const recovered = await submit(db, db.input(K2));
  assert.equal(recovered.ok, true, JSON.stringify(recovered));
  if (created.ok && recovered.ok) {
    assert.equal(recovered.data.orderId, created.data.orderId);
    assert.equal(recovered.data.alreadyFinalized, true);
  }
  assert.deepEqual({ submissions: db.submissions.size, orders: db.orders.length, items: db.orderItems.length, outbox: db.outbox.length }, before);
  assert.equal(db.calls.filter((call) => call.name === "claim_order_submission").length, 1);
  assert.equal(db.calls.find((call) => call.name === "complete_order_draft_finalization")?.input.p_finalization_key, K1);
});

test("F5 owner, stale version, conflicting key and file namespace mismatches fail closed", async () => {
  for (const variant of ["owner", "version", "key", "file-owner"] as const) {
    const db = new DraftAdapter();
    const input = db.input();
    if (variant === "owner") input.userId = K2;
    if (variant === "version") input.expectedVersion -= 1;
    if (variant === "key") { db.draft.status = "converting"; db.draft.finalization_key = K2; }
    if (variant === "file-owner") db.files[0].storage_path = db.files[0].storage_path.replace(USER, K2);
    const result = await submit(db, input);
    assert.equal(result.ok, false, variant);
    if (!result.ok) assert.equal(result.code, { owner: "not_found", version: "version_conflict", key: "finalization_conflict", "file-owner": "file_mismatch" }[variant]);
    assert.equal(db.submissions.size, 0); assert.equal(db.orders.length, 0);
  }
});

test("F5 confirmed storage failure release is explicitly editable", async () => {
  const db = new DraftAdapter();
  const result = await failAfterReservation(db);
  assert.equal("draftReleased" in result && result.draftReleased, true);
});

for (const releaseReply of ["error", "throw", "malformed", "order_exists", "wrong_draft", "missing_draft", "multiple_rows", "object_row", "converted_order"] as const) {
  test(`F5 ${releaseReply} release result cannot authorize editing after Storage failure`, async () => {
    const db = new DraftAdapter(); db.releaseReply = releaseReply;
    const result = await submit(db);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "storage_error");
    assert.equal("draftReleased" in result && result.draftReleased === true, false);
    assert.equal(db.draft.status, "converting");
  });
}

test("F5 ambiguous atomic commit never signals an editable released draft", async () => {
  const db = new DraftAdapter(); db.failCopy = false; db.ambiguousCommit = true;
  const result = await submit(db);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "database_error");
  assert.equal("draftReleased" in result && result.draftReleased === true, false);
  assert.equal(db.submissions.size, 1);
  assert.ok(db.submissions.get(K1)?.p_lease_token);
  assert.equal(db.removed.length, 0);
});

test("F5 Storage verification failure before submission claim unlocks only after confirmed draft release", async () => {
  const db = new DraftAdapter(); db.failList = true;
  const result = await submit(db);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "storage_error");
  assert.equal("draftReleased" in result && result.draftReleased, true);
  assert.equal(db.submissions.size, 0);
  assert.equal(db.draft.status, "active");
});

test("F5 normalized reference Storage verification failure also requires confirmed draft release", async () => {
  const db = new DraftAdapter();
  const reference = fileRow(REFERENCE, "reference.jpg", "reference");
  setReference(db, reference);
  // A fully uploaded normalized reference can have no legacy mirror row.
  db.files = db.files.filter((file) => file.kind !== "reference");
  db.failListDirectory = reference.storage_path.slice(0, reference.storage_path.lastIndexOf("/"));
  const result = await submit(db);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "storage_error");
  assert.equal("draftReleased" in result && result.draftReleased, true);
  assert.equal(db.submissions.size, 0);
  assert.equal(db.draft.status, "active");
});

test("F5 existing source order prevents verification failure from unlocking draft edits", async () => {
  const db = new DraftAdapter(); db.failCopy = false;
  const created = await submit(db);
  assert.equal(created.ok, true, JSON.stringify(created));
  db.draft.status = "converting"; db.draft.converted_order_id = null;
  db.files.forEach((file) => db.addObject(file));
  db.failList = true;
  const result = await submit(db);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "storage_error");
  assert.equal("draftReleased" in result && result.draftReleased === true, false);
  assert.equal(db.calls.at(-1)?.result, "order_exists");
  assert.equal(db.draft.status, "converting");
  assert.equal(db.orders.length, 1);
});

test("F5 in-progress same-key attempt preserves the draft claim and retry identity", async () => {
  const db = new DraftAdapter();
  await failAfterReservation(db);
  // A competing handler has reacquired this unchanged attempt with a live lease.
  db.draft.status = "converting"; db.draft.finalization_key = K1;
  db.submissions.get(K1)!.p_lease_token = crypto.randomUUID();
  const historical = structuredClone(db.submissions.get(K1));
  const callCount = db.calls.length;
  const copyCount = db.copies.length;
  const result = await submit(db, db.input(K1));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "finalization_conflict");
  assert.equal("draftReleased" in result && result.draftReleased === true, false);
  assert.equal(db.draft.status, "converting");
  assert.equal(db.draft.finalization_key, K1);
  assert.equal(db.calls.slice(callCount).some((call) => call.name === "release_order_draft_finalization"), false);
  assert.equal(db.copies.length, copyCount);
  assert.equal(db.submissions.size, 1);
  assert.deepEqual(db.submissions.get(K1), historical);
});

test("F5 reusing an old attempt key for edited state still rejects immutable payload mismatch", async () => {
  const db = new DraftAdapter();
  await failAfterReservation(db);
  const historical = structuredClone(db.submissions.get(K1));
  db.state.jobTitle = "Changed without rotating key"; db.draft.version += 1;
  const result = await submit(db, db.input(K1));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_status");
  assert.equal(db.calls.findLast((call) => call.name === "claim_order_submission")?.result, "payload_conflict");
  assert.equal(db.submissions.size, 1);
  assert.deepEqual(db.submissions.get(K1), historical);
  assert.equal(db.orders.length, 0);
});
