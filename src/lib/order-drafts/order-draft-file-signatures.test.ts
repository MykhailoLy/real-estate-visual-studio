import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import * as nodeModule from "node:module";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";
const REFERENCE_ID = "44444444-4444-4444-8444-444444444444";
const EXISTING_FILE_ID = "55555555-5555-4555-8555-555555555555";
const ITEM_ID = "66666666-6666-4666-8666-666666666666";
const REVIEW_ID = "77777777-7777-4777-8777-777777777777";
const TIMESTAMP = "2026-06-27T11:22:36.123Z";
const encoder = new TextEncoder();
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0);
const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const PDF = encoder.encode("%PDF-1.7\n");
const HTML = encoder.encode("<html><script>alert(1)</script></html>");

const SUPABASE_MOCK_URL = `data:text/javascript,${encodeURIComponent(`
export class SupabaseAdminConfigurationError extends Error {}
export function getSupabaseAdminClient() {
  return globalThis.__draftSignatureTestSupabase;
}
export function createServerClient() {
  return globalThis.__draftSignatureTestSupabase;
}
`)}`;

const DRAFT_SERVER_MOCK_URL = `data:text/javascript,${encodeURIComponent(`
export async function getOrderDraftForUser(userId, draftId) {
  return globalThis.__draftSignatureTestSupabase.getOwnedDraft(userId, draftId);
}
`)}`;

interface ResolveHookContext {
  parentURL?: string;
}

interface ResolveHookResult {
  url: string;
  shortCircuit?: boolean;
}

type ResolveNext = (
  specifier: string,
  context: ResolveHookContext,
) => ResolveHookResult;

const registerHooks = Reflect.get(nodeModule, "registerHooks") as (
  hooks: {
    resolve(
      specifier: string,
      context: ResolveHookContext,
      nextResolve: ResolveNext,
    ): ResolveHookResult;
  },
) => void;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export default undefined;",
        shortCircuit: true,
      };
    }
    if (specifier === "../supabase-admin.ts" || specifier === "@/lib/supabase") {
      return { url: SUPABASE_MOCK_URL, shortCircuit: true };
    }
    if (
      specifier === "./server.ts" &&
      (context.parentURL?.endsWith("/order-drafts/files-server.ts") ||
        context.parentURL?.endsWith("/order-drafts/draft-reference-files-server.ts"))
    ) {
      return { url: DRAFT_SERVER_MOCK_URL, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const localPath = join(ROOT_DIR, "src", specifier.slice(2));
      const candidates = [
        localPath,
        `${localPath}.ts`,
        `${localPath}.tsx`,
        join(localPath, "index.ts"),
      ];
      const resolved = candidates.find((candidate) => existsSync(candidate));
      if (resolved) {
        return { url: pathToFileURL(resolved).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  completeOrderDraftFileUploadForUser,
  listUploadedOrderDraftFilesForUser,
} = await import("./files-server.ts");
const {
  completeDraftReferenceForUser,
  listDraftReferencesForUser,
  prepareDraftReferenceForUser,
} = await import(
  "./draft-reference-files-server.ts"
);
const {
  createReworkReferenceUploadSlot,
  getReworkReferenceFilesForReview,
  markReworkReferenceUploaded,
} = await import("../rework-reference-files.ts");

const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
});

type TableRow = Record<string, unknown>;

interface StoredObject {
  path: string;
  bytes: Uint8Array;
  size: number;
  mimeType: string;
  etag: string;
}

interface FlowMockOptions {
  listFailure?: boolean;
  signedReadFailure?: boolean;
  previewSigningFailure?: boolean;
  previewSigningThrows?: boolean;
  fetchFailure?: boolean;
  failInvalidationUpdate?: boolean;
  failRetirement?: boolean;
  failSigningUpload?: boolean;
  removeFailure?: "error" | "throw" | "missing";
  draftUnavailable?: boolean;
  beforePrefixResponse?: () => Promise<void>;
}

class FlowSupabaseMock {
  readonly tables = new Map<string, TableRow[]>();
  readonly objects = new Map<string, StoredObject>();
  readonly rpcCalls: string[] = [];
  readonly updates: Array<{ table: string; values: TableRow }> = [];
  readonly removedPaths: string[][] = [];
  readonly prefixReads: string[] = [];
  readonly signedUrlTtls: number[] = [];
  readonly signedUploadPaths: string[] = [];
  readonly options: FlowMockOptions;

  constructor(options: FlowMockOptions = {}) {
    this.options = options;
  }

  readonly storage = {
    from: () => ({
      list: async (directory: string, options?: { search?: string }) => {
        if (this.options.listFailure) {
          return { data: null, error: { name: "StorageUnavailable", message: "Storage unavailable" } };
        }
        const prefix = `${directory}/`;
        const data = Array.from(this.objects.values())
          .filter((object) => object.path.startsWith(prefix))
          .map((object) => ({
            name: object.path.slice(prefix.length),
            metadata: {
              size: object.size,
              mimetype: object.mimeType,
              eTag: object.etag,
            },
          }))
          .filter((object) => !object.name.includes("/"))
          .filter((object) =>
            options?.search ? object.name.includes(options.search) : true,
          );
        return { data, error: null };
      },
      info: async (path: string) => {
        const object = this.objects.get(path);
        if (!object) return { data: null, error: { name: "NotFound" } };
        return {
          data: {
            size: object.size,
            contentType: object.mimeType,
            etag: object.etag,
          },
          error: null,
        };
      },
      createSignedUrl: async (path: string, expiresIn: number) => {
        this.signedUrlTtls.push(expiresIn);
        if (this.options.previewSigningThrows && expiresIn === 600) {
          throw new Error("Preview signing connection failed");
        }
        return this.options.signedReadFailure ||
          (this.options.previewSigningFailure && expiresIn === 600)
          ? { data: null, error: { name: "SignedReadFailed" } }
          : {
              data: { signedUrl: `https://storage.example/${encodeURIComponent(path)}` },
              error: null,
            };
      },
      createSignedUploadUrl: async (path: string) => {
        this.signedUploadPaths.push(path);
        return this.options.failSigningUpload
          ? { data: null, error: { name: "SigningFailed" } }
          : {
              data: { path, token: `token-${path}`, signedUrl: `https://storage.example/upload/${encodeURIComponent(path)}` },
              error: null,
            };
      },
      remove: async (paths: string[]) => {
        this.removedPaths.push([...paths]);
        if (this.options.removeFailure === "throw") throw new Error("private-storage-token");
        if (this.options.removeFailure) {
          return { data: null, error: { name: "private-storage-token", message: "private-storage-path" } };
        }
        for (const path of paths) this.objects.delete(path);
        return { data: [], error: null };
      },
    }),
  };

  install(): void {
    (globalThis as typeof globalThis & {
      __draftSignatureTestSupabase?: FlowSupabaseMock;
    }).__draftSignatureTestSupabase = this;

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      const path = decodeURIComponent(url.pathname.slice(1));
      this.prefixReads.push(path);
      if (this.options.fetchFailure) {
        return new Response("Storage unavailable", { status: 503 });
      }

      const object = this.objects.get(path);
      if (!object) return new Response("Missing", { status: 404 });
      const prefixLength = Math.min(512, object.size);
      const bytes = new Uint8Array(prefixLength);
      bytes.set(object.bytes.subarray(0, prefixLength));
      await this.options.beforePrefixResponse?.();
      return new Response(bytes, {
        status: 206,
        headers: {
          "content-range": `bytes 0-${prefixLength - 1}/${object.size}`,
          etag: object.etag,
        },
      });
    };
  }

  getOwnedDraft(userId: string, draftId: string) {
    if (userId !== USER_ID || draftId !== DRAFT_ID || this.options.draftUnavailable) {
      return { ok: false, code: "not_found", message: "Draft was not found." };
    }
    return {
      ok: true,
      data: {
        id: draftId,
        userId,
        serviceType: "virtual-staging",
        version: 1,
        state: { items: [{ clientItemId: ITEM_ID }] },
      },
    };
  }

  setRows(table: string, rows: TableRow[]): void {
    this.tables.set(table, rows);
  }

  addObject(path: string, bytes: Uint8Array, mimeType: string, size = 1_234): void {
    this.objects.set(path, {
      path,
      bytes,
      mimeType,
      size,
      etag: `"etag-${mimeType}-${size}"`,
    });
  }

  from(table: string): MockTableQuery {
    return new MockTableQuery(this, table);
  }

  async rpc(name: string, params: Record<string, unknown>) {
    this.rpcCalls.push(name);
    if (name !== "complete_order_draft_file_upload") {
      return { data: null, error: { message: "Unexpected RPC" } };
    }

    const row = (this.tables.get("order_draft_files") ?? [])
      .find((candidate) => candidate.id === params.p_file_id);
    if (!row || row.upload_status !== "pending") {
      return { data: [{ result_code: "invalid_file_status" }], error: null };
    }
    row.upload_status = "uploaded";
    return {
      data: [{
        result_code: "completed",
        completed_file_id: row.id,
        retired_storage_paths: [],
      }],
      error: null,
    };
  }
}

class MockTableQuery implements PromiseLike<{ data: TableRow[] | null; error: { message: string } | null }> {
  private readonly supabase: FlowSupabaseMock;
  private readonly table: string;
  private readonly filters: Array<{ column: string; value: unknown }> = [];
  private readonly inclusionFilters: Array<{ column: string; values: unknown[] }> = [];
  private mutation: { kind: "update" | "insert"; values: TableRow } | null = null;
  private maximum: number | null = null;

  constructor(supabase: FlowSupabaseMock, table: string) {
    this.supabase = supabase;
    this.table = table;
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  is(column: string, value: unknown) {
    return this.eq(column, value);
  }

  in(column: string, values: unknown[]) {
    this.inclusionFilters.push({ column, values });
    return this;
  }

  order() {
    return this;
  }

  limit(value: number) {
    this.maximum = value;
    return this;
  }

  update(values: TableRow) {
    this.mutation = { kind: "update", values };
    return this;
  }

  insert(values: TableRow) {
    this.mutation = { kind: "insert", values };
    return this;
  }

  async maybeSingle() {
    const result = this.execute();
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  async single() {
    const result = this.execute();
    const row = result.data?.[0] ?? null;
    return {
      data: row,
      error: result.error ?? (row ? null : { message: "No row found" }),
    };
  }

  then<TResult1 = { data: TableRow[] | null; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: TableRow[] | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): { data: TableRow[] | null; error: { message: string } | null } {
    const tableRows = this.supabase.tables.get(this.table) ?? [];
    if (!this.supabase.tables.has(this.table)) {
      this.supabase.tables.set(this.table, tableRows);
    }

    if (this.mutation?.kind === "insert") {
      const inserted: TableRow = { deleted_at: null, ...this.mutation.values };
      if (this.table === "order_draft_item_reference_files" && tableRows.some((row) =>
        row.id === inserted.id ||
        (row.draft_id === inserted.draft_id && row.item_client_id === inserted.item_client_id &&
          row.position === inserted.position && row.deleted_at === null &&
          ["pending", "uploaded"].includes(String(row.upload_status)))
      )) {
        return { data: null, error: { message: "Unique reference constraint" } };
      }
      tableRows.push(inserted);
      return { data: [inserted], error: null };
    }

    let matches = tableRows.filter((row) =>
      this.filters.every(({ column, value }) => row[column] === value) &&
      this.inclusionFilters.every(({ column, values }) => values.includes(row[column])),
    );
    if (this.maximum !== null) matches = matches.slice(0, this.maximum);

    if (this.mutation?.kind === "update") {
      if (this.supabase.options.failRetirement && this.mutation.values.upload_status === "deleted") {
        return { data: null, error: { message: "Retirement failed" } };
      }
      this.supabase.updates.push({
        table: this.table,
        values: this.mutation.values,
      });
      if (
        this.supabase.options.failInvalidationUpdate &&
        this.mutation.values.upload_status === "failed"
      ) {
        return { data: null, error: { message: "Concurrent update" } };
      }
      for (const row of matches) Object.assign(row, this.mutation.values);
    }

    // Queries return snapshots, not live references to mutable database rows.
    return { data: matches.map((row) => ({ ...row })), error: null };
  }
}

function draftFileRow(overrides: TableRow = {}): TableRow {
  return {
    id: FILE_ID,
    draft_id: DRAFT_ID,
    item_client_id: ITEM_ID,
    item_index: 0,
    kind: "original",
    bucket: "order-files",
    storage_path: `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID}/room.jpg`,
    original_filename: "room.jpg",
    file_size: 1_234,
    mime_type: "image/jpeg",
    content_hash: null,
    upload_status: "pending",
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    deleted_at: null,
    moved_at: null,
    ...overrides,
  };
}

function draftReferenceRow(overrides: TableRow = {}): TableRow {
  return {
    id: REFERENCE_ID,
    draft_id: DRAFT_ID,
    item_client_id: ITEM_ID,
    item_index: 0,
    reference_id: REFERENCE_ID,
    position: 0,
    bucket: "order-files",
    storage_path: `drafts/${USER_ID}/${DRAFT_ID}/${REFERENCE_ID}/notes.pdf`,
    original_filename: "notes.pdf",
    file_size: 1_234,
    mime_type: "application/pdf",
    upload_status: "pending",
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    deleted_at: null,
    ...overrides,
  };
}

function reworkRows(extension = "png", mimeType = "image/png") {
  const review = {
    id: REVIEW_ID,
    status: "rework_requested",
    deliverable_id: FILE_ID,
    order_id: DRAFT_ID,
    item_index: 0,
    orders: { user_id: USER_ID, client_email: "client@example.com" },
  };
  const file = {
    id: REFERENCE_ID,
    review_id: REVIEW_ID,
    order_id: DRAFT_ID,
    deliverable_id: FILE_ID,
    item_index: 0,
    storage_path: `rework/${REVIEW_ID}/1234567890-reference.${extension}`,
    filename: `reference.${extension}`,
    file_size: 1_234,
    mime_type: mimeType,
    uploaded_by: "client",
    upload_status: "pending",
    created_at: TIMESTAMP,
  };
  return { review, file };
}

test("valid draft bytes are verified before the pending row becomes uploaded", async () => {
  const row = draftFileRow();
  const mock = new FlowSupabaseMock();
  mock.setRows("order_draft_files", [row]);
  mock.addObject(String(row.storage_path), JPEG, "image/jpeg");
  mock.install();

  const result = await completeOrderDraftFileUploadForUser(USER_ID, DRAFT_ID, FILE_ID);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(row.upload_status, "uploaded");
  assert.deepEqual(mock.rpcCalls, ["complete_order_draft_file_upload"]);
  assert.deepEqual(mock.prefixReads, [row.storage_path]);
  assert.deepEqual(mock.signedUrlTtls, [60, 600]);
  assert.equal(
    result.data.previewUrl,
    `https://storage.example/${encodeURIComponent(String(row.storage_path))}`,
  );
  assert.match(result.data.previewExpiresAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
  for (const privateField of [
    "storagePath",
    "bucket",
    "path",
    "token",
    "signedUrl",
  ]) {
    assert.equal(privateField in result.data, false);
  }
});

test("completion and list share successful preview enrichment semantics", async () => {
  const row = draftFileRow();
  const mock = new FlowSupabaseMock();
  mock.setRows("order_draft_files", [row]);
  mock.addObject(String(row.storage_path), JPEG, "image/jpeg");
  mock.install();

  const completed = await completeOrderDraftFileUploadForUser(
    USER_ID,
    DRAFT_ID,
    FILE_ID,
  );
  const listed = await listUploadedOrderDraftFilesForUser(USER_ID, DRAFT_ID);

  assert.equal(completed.ok, true);
  assert.equal(listed.ok, true);
  if (!completed.ok || !listed.ok) return;
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0]?.id, completed.data.id);
  assert.equal(listed.data[0]?.previewUrl, completed.data.previewUrl);
  assert.match(listed.data[0]?.previewExpiresAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(mock.signedUrlTtls, [60, 600, 600]);
});

test("preview signing failure never fails completion and matches list fallback", async () => {
  const row = draftFileRow();
  const mock = new FlowSupabaseMock({ previewSigningFailure: true });
  mock.setRows("order_draft_files", [row]);
  mock.addObject(String(row.storage_path), JPEG, "image/jpeg");
  mock.install();

  const completed = await completeOrderDraftFileUploadForUser(
    USER_ID,
    DRAFT_ID,
    FILE_ID,
  );
  const listed = await listUploadedOrderDraftFilesForUser(USER_ID, DRAFT_ID);

  assert.equal(completed.ok, true);
  assert.equal(listed.ok, true);
  if (!completed.ok || !listed.ok) return;
  assert.equal(row.upload_status, "uploaded");
  assert.deepEqual(mock.rpcCalls, ["complete_order_draft_file_upload"]);
  assert.deepEqual(mock.prefixReads, [row.storage_path]);
  assert.equal("previewUrl" in completed.data, false);
  assert.equal("previewExpiresAt" in completed.data, false);
  assert.equal(listed.data.length, 1);
  assert.equal("previewUrl" in (listed.data[0] ?? {}), false);
  assert.equal("previewExpiresAt" in (listed.data[0] ?? {}), false);
  assert.deepEqual(mock.signedUrlTtls, [60, 600, 600]);
  assert.deepEqual(mock.removedPaths, []);
});

test("thrown preview signing errors cannot invalidate a completed upload", async () => {
  const row = draftFileRow();
  const mock = new FlowSupabaseMock({ previewSigningThrows: true });
  mock.setRows("order_draft_files", [row]);
  mock.addObject(String(row.storage_path), JPEG, "image/jpeg");
  mock.install();

  const completed = await completeOrderDraftFileUploadForUser(
    USER_ID,
    DRAFT_ID,
    FILE_ID,
  );

  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(row.upload_status, "uploaded");
  assert.deepEqual(mock.rpcCalls, ["complete_order_draft_file_upload"]);
  assert.deepEqual(mock.prefixReads, [row.storage_path]);
  assert.equal("previewUrl" in completed.data, false);
  assert.deepEqual(mock.signedUrlTtls, [60, 600]);
  assert.deepEqual(mock.removedPaths, []);
});

test("invalid draft bytes mark only the pending candidate failed and remove only its object", async () => {
  const pending = draftFileRow();
  const existing = draftFileRow({
    id: EXISTING_FILE_ID,
    storage_path: `drafts/${USER_ID}/${DRAFT_ID}/${EXISTING_FILE_ID}/previous.jpg`,
    original_filename: "previous.jpg",
    upload_status: "uploaded",
  });
  const mock = new FlowSupabaseMock();
  mock.setRows("order_draft_files", [pending, existing]);
  mock.addObject(String(pending.storage_path), HTML, "image/jpeg");
  mock.addObject(String(existing.storage_path), JPEG, "image/jpeg");
  mock.install();

  const result = await completeOrderDraftFileUploadForUser(USER_ID, DRAFT_ID, FILE_ID);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_upload");
  assert.equal(pending.upload_status, "failed");
  assert.equal(existing.upload_status, "uploaded");
  assert.deepEqual(mock.rpcCalls, []);
  assert.deepEqual(mock.removedPaths, [[pending.storage_path]]);
  assert.equal(mock.objects.has(String(pending.storage_path)), false);
  assert.equal(mock.objects.has(String(existing.storage_path)), true);
});

test("draft cleanup never removes an object when its pending row could not be invalidated", async () => {
  const pending = draftFileRow();
  const mock = new FlowSupabaseMock({ failInvalidationUpdate: true });
  mock.setRows("order_draft_files", [pending]);
  mock.addObject(String(pending.storage_path), HTML, "image/jpeg");
  mock.install();

  const result = await completeOrderDraftFileUploadForUser(USER_ID, DRAFT_ID, FILE_ID);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_upload");
  assert.equal(pending.upload_status, "pending");
  assert.deepEqual(mock.removedPaths, []);
  assert.equal(mock.objects.has(String(pending.storage_path)), true);
});

for (const [name, options] of [
  ["signed prefix creation fails", { signedReadFailure: true }],
  ["prefix download fails", { fetchFailure: true }],
] satisfies Array<[string, FlowMockOptions]>) {
  test(`draft completion stays pending with storage_error when ${name}`, async () => {
    const row = draftFileRow();
    const mock = new FlowSupabaseMock(options);
    mock.setRows("order_draft_files", [row]);
    mock.addObject(String(row.storage_path), JPEG, "image/jpeg");
    mock.install();

    const result = await completeOrderDraftFileUploadForUser(USER_ID, DRAFT_ID, FILE_ID);

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "storage_error");
    assert.equal(row.upload_status, "pending");
    assert.deepEqual(mock.rpcCalls, []);
    assert.deepEqual(mock.removedPaths, []);
  });
}

test("missing draft object remains upload_not_found and never reaches completion", async () => {
  const row = draftFileRow();
  const mock = new FlowSupabaseMock();
  mock.setRows("order_draft_files", [row]);
  mock.install();

  const result = await completeOrderDraftFileUploadForUser(USER_ID, DRAFT_ID, FILE_ID);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "upload_not_found");
  assert.equal(row.upload_status, "pending");
  assert.deepEqual(mock.rpcCalls, []);
});

test("draft metadata MIME mismatch is rejected before signature fetching", async () => {
  const row = draftFileRow();
  const mock = new FlowSupabaseMock();
  mock.setRows("order_draft_files", [row]);
  mock.addObject(String(row.storage_path), PNG, "image/png");
  mock.install();

  const result = await completeOrderDraftFileUploadForUser(USER_ID, DRAFT_ID, FILE_ID);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "upload_mismatch");
  assert.deepEqual(mock.prefixReads, []);
  assert.deepEqual(mock.rpcCalls, []);
});

test("valid PDF draft multi-reference is verified before uploaded state and legacy mirroring", async () => {
  const reference = draftReferenceRow();
  const mock = new FlowSupabaseMock();
  mock.setRows("order_draft_item_reference_files", [reference]);
  mock.setRows("order_draft_files", []);
  mock.addObject(String(reference.storage_path), PDF, "application/pdf");
  mock.install();

  const result = await completeDraftReferenceForUser(USER_ID, DRAFT_ID, REFERENCE_ID);

  assert.equal(result.ok, true);
  assert.equal(reference.upload_status, "uploaded");
  assert.deepEqual(mock.prefixReads, [reference.storage_path]);
  assert.equal((mock.tables.get("order_draft_files") ?? []).length, 1);
});

test("spoofed draft multi-reference never becomes uploaded and removes only its own object", async () => {
  const reference = draftReferenceRow();
  const mock = new FlowSupabaseMock();
  mock.setRows("order_draft_item_reference_files", [reference]);
  mock.addObject(String(reference.storage_path), HTML, "application/pdf");
  mock.install();

  const result = await completeDraftReferenceForUser(USER_ID, DRAFT_ID, REFERENCE_ID);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.code, "invalid_upload");
  }
  assert.equal(reference.upload_status, "failed");
  assert.deepEqual(mock.removedPaths, [[reference.storage_path]]);
});

test("draft multi-reference cleanup is skipped if its pending row could not be invalidated", async () => {
  const reference = draftReferenceRow();
  const mock = new FlowSupabaseMock({ failInvalidationUpdate: true });
  mock.setRows("order_draft_item_reference_files", [reference]);
  mock.addObject(String(reference.storage_path), HTML, "application/pdf");
  mock.install();

  const result = await completeDraftReferenceForUser(USER_ID, DRAFT_ID, REFERENCE_ID);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_upload");
  assert.equal(reference.upload_status, "pending");
  assert.deepEqual(mock.removedPaths, []);
});

for (const [name, options] of [
  ["metadata listing fails", { listFailure: true }],
  ["prefix verification fails", { fetchFailure: true }],
] satisfies Array<[string, FlowMockOptions]>) {
  test(`draft multi-reference returns storage_error when ${name}`, async () => {
    const reference = draftReferenceRow();
    const mock = new FlowSupabaseMock(options);
    mock.setRows("order_draft_item_reference_files", [reference]);
    mock.addObject(String(reference.storage_path), PDF, "application/pdf");
    mock.install();

    const result = await completeDraftReferenceForUser(USER_ID, DRAFT_ID, REFERENCE_ID);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 500);
      assert.equal(result.code, "storage_error");
    }
    assert.equal(reference.upload_status, "pending");
    assert.deepEqual(mock.removedPaths, []);
  });
}

test("newly created rework upload slots stay pending and are not listed", async () => {
  const { review } = reworkRows();
  const mock = new FlowSupabaseMock();
  mock.setRows("deliverable_reviews", [review]);
  mock.setRows("deliverable_review_files", []);
  mock.install();

  const created = await createReworkReferenceUploadSlot(
    REVIEW_ID,
    { userId: USER_ID, email: "client@example.com" },
    { filename: "reference.png", contentType: "image/png", fileSize: 1_234 },
  );
  const listed = await getReworkReferenceFilesForReview(REVIEW_ID, {
    userId: USER_ID,
    email: "client@example.com",
  });

  assert.equal(created.ok, true);
  const inserted = (mock.tables.get("deliverable_review_files") ?? [])[0];
  assert.equal(inserted?.upload_status, "pending");
  assert.equal(listed.ok, true);
  if (listed.ok) assert.deepEqual(listed.files, []);
});

test("successful rework completion marks the pending row uploaded and exposes it", async () => {
  const { review, file } = reworkRows();
  const mock = new FlowSupabaseMock();
  mock.setRows("deliverable_reviews", [review]);
  mock.setRows("deliverable_review_files", [file]);
  mock.addObject(String(file.storage_path), PNG, "image/png");
  mock.install();

  const result = await markReworkReferenceUploaded(REVIEW_ID, REFERENCE_ID, {
    userId: USER_ID,
    email: "client@example.com",
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal("storage_path" in result.file, false);
  assert.equal(file.upload_status, "uploaded");
  assert.deepEqual(mock.prefixReads, [file.storage_path]);

  const listed = await getReworkReferenceFilesForReview(REVIEW_ID, {
    userId: USER_ID,
    email: "client@example.com",
  });
  assert.equal(listed.ok, true);
  if (listed.ok) assert.deepEqual(listed.files.map(({ id }) => id), [REFERENCE_ID]);
});

test("repeated rework completion returns the durable uploaded row safely", async () => {
  const { review, file } = reworkRows();
  const mock = new FlowSupabaseMock();
  mock.setRows("deliverable_reviews", [review]);
  mock.setRows("deliverable_review_files", [file]);
  mock.addObject(String(file.storage_path), PNG, "image/png");
  mock.install();

  const ownership = { userId: USER_ID, email: "client@example.com" };
  const first = await markReworkReferenceUploaded(REVIEW_ID, REFERENCE_ID, ownership);
  const second = await markReworkReferenceUploaded(REVIEW_ID, REFERENCE_ID, ownership);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(file.upload_status, "uploaded");
  assert.deepEqual(mock.prefixReads, [file.storage_path]);
  assert.equal(
    mock.updates.filter(({ table }) => table === "deliverable_review_files").length,
    1,
  );
});

test("backfilled historical rework references remain visible", async () => {
  const { review, file } = reworkRows();
  file.upload_status = "uploaded";
  const mock = new FlowSupabaseMock();
  mock.setRows("deliverable_reviews", [review]);
  mock.setRows("deliverable_review_files", [file]);
  mock.install();

  const listed = await getReworkReferenceFilesForReview(REVIEW_ID, {
    userId: USER_ID,
    email: "client@example.com",
  });

  assert.equal(listed.ok, true);
  if (listed.ok) assert.deepEqual(listed.files.map(({ id }) => id), [REFERENCE_ID]);
});

test("spoofed rework reference is rejected without deleting historical review objects", async () => {
  const { review, file } = reworkRows("jpg", "image/jpeg");
  const mock = new FlowSupabaseMock();
  mock.setRows("deliverable_reviews", [review]);
  mock.setRows("deliverable_review_files", [file]);
  mock.addObject(String(file.storage_path), HTML, "image/jpeg");
  mock.install();

  const result = await markReworkReferenceUploaded(REVIEW_ID, REFERENCE_ID, {
    userId: USER_ID,
    email: "client@example.com",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.code, "invalid_upload");
  }
  assert.deepEqual(mock.removedPaths, []);
});

for (const [name, options] of [
  ["Storage listing fails", { listFailure: true }],
  ["prefix verification fails", { fetchFailure: true }],
] satisfies Array<[string, FlowMockOptions]>) {
  test(`rework completion returns storage_error when ${name}`, async () => {
    const { review, file } = reworkRows();
    const mock = new FlowSupabaseMock(options);
    mock.setRows("deliverable_reviews", [review]);
    mock.setRows("deliverable_review_files", [file]);
    mock.addObject(String(file.storage_path), PNG, "image/png");
    mock.install();

    const result = await markReworkReferenceUploaded(REVIEW_ID, REFERENCE_ID, {
      userId: USER_ID,
      email: "client@example.com",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 500);
      assert.equal(result.code, "storage_error");
    }
    assert.deepEqual(mock.removedPaths, []);
  });
}

test("an object at a mismatched path cannot complete or expose a pending rework row", async () => {
  const { review, file } = reworkRows();
  const mock = new FlowSupabaseMock();
  mock.setRows("deliverable_reviews", [review]);
  mock.setRows("deliverable_review_files", [file]);
  mock.addObject(
    `rework/88888888-8888-4888-8888-888888888888/${file.filename}`,
    PNG,
    "image/png",
  );
  mock.install();

  const result = await markReworkReferenceUploaded(REVIEW_ID, REFERENCE_ID, {
    userId: USER_ID,
    email: "client@example.com",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
  assert.equal(file.upload_status, "pending");
  assert.deepEqual(mock.prefixReads, []);

  const listed = await getReworkReferenceFilesForReview(REVIEW_ID, {
    userId: USER_ID,
    email: "client@example.com",
  });
  assert.equal(listed.ok, true);
  if (listed.ok) assert.deepEqual(listed.files, []);
});

const REFERENCE_TABLE = "order_draft_item_reference_files";
const MB = 1024 * 1024;
const newReferenceInput = {
  itemClientId: ITEM_ID,
  referenceId: EXISTING_FILE_ID,
  position: 0,
  filename: "new-reference.pdf",
  fileSize: 1_234,
  mimeType: "application/pdf" as const,
};

function referenceFixture(rows: TableRow[], options: FlowMockOptions = {}): FlowSupabaseMock {
  const mock = new FlowSupabaseMock(options);
  mock.setRows(REFERENCE_TABLE, rows);
  mock.install();
  return mock;
}

function assertRetired(row: TableRow): void {
  assert.equal(row.upload_status, "deleted");
  assert.match(String(row.deleted_at), /^\d{4}-\d{2}-\d{2}T/);
}

function uploadedReferences(count: number, fileSize = 1_234): TableRow[] {
  return Array.from({ length: count }, (_, position) => {
    const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(position).padStart(12, "0")}`;
    return draftReferenceRow({
      id, reference_id: id, position, file_size: fileSize, upload_status: "uploaded",
      storage_path: `drafts/${USER_ID}/${DRAFT_ID}/${id}/notes.pdf`,
    });
  });
}

test("F6: reload hides interrupted pending reference; prepare recovers the same position", async () => {
  const old = draftReferenceRow();
  const mock = referenceFixture([old]);
  assert.deepEqual(await listDraftReferencesForUser(USER_ID, DRAFT_ID), { ok: true, data: [] });
  const result = await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput);
  assert.equal(result.ok, true, JSON.stringify(result));
  assertRetired(old);
  assert.equal(mock.tables.get(REFERENCE_TABLE)?.[1]?.upload_status, "pending");
});

test("F6: cleanup removes only the retired object's path once and keeps a unique new upload", async () => {
  const old = draftReferenceRow();
  const mock = referenceFixture([old]);
  mock.addObject(String(old.storage_path), PDF, "application/pdf");
  const result = await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput);
  assert.ok(result.ok);
  assertRetired(old);
  assert.deepEqual(mock.removedPaths, [[old.storage_path]]);
  assert.equal(mock.objects.has(String(old.storage_path)), false);
  assert.notEqual(result.data.upload.path, old.storage_path);
  assert.deepEqual(mock.signedUploadPaths, [result.data.upload.path]);
  assert.equal(result.data.upload.token, `token-${result.data.upload.path}`);
  assert.equal(result.data.reference.storagePath, null);
});

for (const removeFailure of ["missing", "error", "throw"] as const) {
  test(`F6: Storage cleanup ${removeFailure} cannot undo retirement or fail prepare`, async (context) => {
    const warnings: unknown[][] = [];
    context.mock.method(console, "warn", (...args: unknown[]) => warnings.push(args));
    const old = draftReferenceRow();
    const mock = referenceFixture([old], { removeFailure });
    if (removeFailure !== "missing") mock.addObject(String(old.storage_path), PDF, "application/pdf");
    const result = await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput);
    assert.ok(result.ok);
    assertRetired(old);
    assert.deepEqual(mock.removedPaths, [[old.storage_path]]);
    assert.equal(warnings.length, 1);
    assert.deepEqual(warnings[0], ["[draft-reference-files] retired reference storage cleanup failed."]);
  });
}

test("F6: failed candidates retire even when they alone exceed the quota", async () => {
  const failed = uploadedReferences(6, 20 * MB).map((row) => ({ ...row, upload_status: "failed" }));
  referenceFixture([...failed]);
  assert.ok((await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput)).ok);
  failed.forEach(assertRetired);
});

test("F6: all incomplete positions retire; uploaded, other item/draft and already deleted rows stay intact", async () => {
  const incomplete = [draftReferenceRow({ position: 2 }), draftReferenceRow({
    id: FILE_ID, reference_id: FILE_ID, position: 8, upload_status: "failed",
    storage_path: `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID}/notes.pdf`,
  })];
  const untouched = [
    ...uploadedReferences(1),
    draftReferenceRow({ id: REVIEW_ID, reference_id: REVIEW_ID, item_client_id: REVIEW_ID }),
    draftReferenceRow({ id: ITEM_ID, reference_id: ITEM_ID, draft_id: REVIEW_ID }),
    draftReferenceRow({ id: USER_ID, reference_id: USER_ID, deleted_at: TIMESTAMP, upload_status: "deleted" }),
  ];
  const snapshot = structuredClone(untouched);
  const mock = referenceFixture([...incomplete, ...untouched]);
  assert.ok((await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, { ...newReferenceInput, position: 1 })).ok);
  incomplete.forEach(assertRetired);
  assert.deepEqual(untouched, snapshot);
  assert.deepEqual(mock.removedPaths.flat(), incomplete.map((row) => row.storage_path));
});

for (const conflict of ["position", "identity", "count", "total"] as const) {
  test(`F6: true uploaded ${conflict} conflict still rejects without replacing completed references`, async () => {
    const uploaded = uploadedReferences(conflict === "count" ? 10 : conflict === "total" ? 5 : 1,
      conflict === "total" ? 20 * MB : 1_234);
    const snapshot = structuredClone(uploaded);
    const incomplete = conflict === "count" ? [] : [draftReferenceRow({ position: 9 })];
    const mock = referenceFixture([...uploaded, ...incomplete]);
    const input = {
      ...newReferenceInput,
      position: conflict === "position" ? 0 : 9,
      referenceId: conflict === "identity" ? String(uploaded[0].reference_id) : newReferenceInput.referenceId,
    };
    const result = await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    const messages = { position: /position is already occupied/, identity: /already saved/, count: /up to 10/, total: /100 MB/ };
    assert.match(result.message, messages[conflict]);
    assert.deepEqual(uploaded, snapshot);
    incomplete.forEach(assertRetired);
    assert.deepEqual(mock.signedUploadPaths, []);
    assert.deepEqual(mock.removedPaths.flat(), incomplete.map((row) => row.storage_path));
  });
}

test("F6: nine uploaded plus an invisible pending tenth allows a fresh tenth", async () => {
  const old = draftReferenceRow({ position: 9 });
  referenceFixture([...uploadedReferences(9), old]);
  assert.ok((await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, { ...newReferenceInput, position: 9 })).ok);
  assertRetired(old);
});

test("F6: pending bytes do not inflate uploaded total at the exact 100 MB boundary", async () => {
  const old = draftReferenceRow({ position: 7, file_size: 20 * MB });
  referenceFixture([...uploadedReferences(4, 20 * MB), old]);
  assert.ok((await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, {
    ...newReferenceInput, position: 4, fileSize: 20 * MB,
  })).ok);
  assertRetired(old);
});

test("F6: database retirement failure aborts before insertion, signing or Storage removal", async () => {
  const old = draftReferenceRow();
  const snapshot = structuredClone(old);
  const mock = referenceFixture([old], { failRetirement: true });
  const result = await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 500);
  assert.deepEqual(mock.tables.get(REFERENCE_TABLE), [snapshot]);
  assert.deepEqual(mock.removedPaths, []);
  assert.deepEqual(mock.signedUploadPaths, []);
});

test("F6: signed upload failure marks only the new candidate failed and still cleans retired objects", async () => {
  const old = draftReferenceRow();
  const mock = referenceFixture([old], { failSigningUpload: true });
  const result = await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput);
  assert.equal(result.ok, false);
  assertRetired(old);
  const fresh = mock.tables.get(REFERENCE_TABLE)?.find((row) => row.id === newReferenceInput.referenceId);
  assert.equal(fresh?.upload_status, "failed");
  assert.equal(fresh?.deleted_at, null);
  assert.deepEqual(mock.removedPaths, [[old.storage_path]]);
});

test("F6: a late completion of retired K1 cannot promote it or change new K2", async () => {
  const old = draftReferenceRow();
  const mock = referenceFixture([old]);
  assert.ok((await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput)).ok);
  const result = await completeDraftReferenceForUser(USER_ID, DRAFT_ID, REFERENCE_ID);
  assert.equal(result.ok, false);
  assertRetired(old);
  assert.equal(mock.tables.get(REFERENCE_TABLE)?.[1]?.upload_status, "pending");
  assert.deepEqual(mock.prefixReads, []);
});

test("F6: completion already verifying K1 cannot promote it after K2 retires it", async (context) => {
  context.mock.method(console, "warn", () => undefined);
  const old = draftReferenceRow();
  const mock = referenceFixture([old], {
    removeFailure: "error",
    beforePrefixResponse: async () => {
      assert.ok((await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput)).ok);
    },
  });
  mock.addObject(String(old.storage_path), PDF, "application/pdf");
  const result = await completeDraftReferenceForUser(USER_ID, DRAFT_ID, REFERENCE_ID);
  assert.equal(result.ok, false);
  assertRetired(old);
  assert.equal(mock.tables.get(REFERENCE_TABLE)?.[1]?.upload_status, "pending");
  assert.ok(mock.updates.some((update) => update.values.upload_status === "uploaded"));
  assert.deepEqual(mock.tables.get("order_draft_files") ?? [], []);
});

for (const invalidCase of ["input", "user", "draft", "owner", "inactive", "item"] as const) {
  test(`F6: ${invalidCase} validation happens before recovery mutations`, async () => {
    const old = draftReferenceRow();
    const snapshot = structuredClone(old);
    const mock = referenceFixture([old], { draftUnavailable: invalidCase === "inactive" });
    const result = await prepareDraftReferenceForUser(
      invalidCase === "user" ? "invalid" : invalidCase === "owner" ? REVIEW_ID : USER_ID,
      invalidCase === "draft" ? "invalid" : DRAFT_ID,
      { ...newReferenceInput, position: invalidCase === "input" ? -1 : 0,
        itemClientId: invalidCase === "item" ? REVIEW_ID : ITEM_ID },
    );
    assert.equal(result.ok, false);
    assert.deepEqual(mock.tables.get(REFERENCE_TABLE), [snapshot]);
    assert.deepEqual(mock.updates, []);
    assert.deepEqual(mock.removedPaths, []);
    assert.deepEqual(mock.signedUploadPaths, []);
  });
}

test("F6: recovered prepare, completion and reload preserve the canonical summary and legacy mirror", async () => {
  const old = draftReferenceRow();
  const mock = referenceFixture([old]);
  const prepared = await prepareDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput);
  assert.ok(prepared.ok);
  mock.addObject(prepared.data.upload.path, PDF, "application/pdf");
  const completed = await completeDraftReferenceForUser(USER_ID, DRAFT_ID, newReferenceInput.referenceId);
  assert.ok(completed.ok);
  const listed = await listDraftReferencesForUser(USER_ID, DRAFT_ID);
  assert.ok(listed.ok);
  assert.equal(listed.data.length, 1);
  for (const reference of [prepared.data.reference, completed.data, listed.data[0]]) {
    assert.equal(reference.id, newReferenceInput.referenceId);
    assert.equal(reference.draftFileId, newReferenceInput.referenceId);
    assert.equal(reference.itemClientId, ITEM_ID);
    assert.equal(reference.position, 0);
    assert.equal(reference.filename, newReferenceInput.filename);
    assert.equal(reference.file, null);
    assert.equal(reference.storagePath, null);
  }
  assert.ok(completed.data.previewUrl);
  assert.equal(listed.data[0].previewUrl, completed.data.previewUrl);
  assert.equal(mock.tables.get("order_draft_files")?.[0]?.id, newReferenceInput.referenceId);
  assertRetired(old);
});
