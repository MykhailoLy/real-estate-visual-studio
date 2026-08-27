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
const { completeDraftReferenceForUser } = await import(
  "./draft-reference-files-server.ts"
);
const { markReworkReferenceUploaded } = await import("../rework-reference-files.ts");

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
}

class FlowSupabaseMock {
  readonly tables = new Map<string, TableRow[]>();
  readonly objects = new Map<string, StoredObject>();
  readonly rpcCalls: string[] = [];
  readonly updates: Array<{ table: string; values: TableRow }> = [];
  readonly removedPaths: string[][] = [];
  readonly prefixReads: string[] = [];
  readonly signedUrlTtls: number[] = [];
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
      remove: async (paths: string[]) => {
        this.removedPaths.push([...paths]);
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
      const inserted = { ...this.mutation.values };
      tableRows.push(inserted);
      return { data: [inserted], error: null };
    }

    let matches = tableRows.filter((row) =>
      this.filters.every(({ column, value }) => row[column] === value),
    );
    if (this.maximum !== null) matches = matches.slice(0, this.maximum);

    if (this.mutation?.kind === "update") {
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

    return { data: matches, error: null };
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

test("valid rework reference bytes preserve ownership and return safe file metadata", async () => {
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
  assert.deepEqual(mock.prefixReads, [file.storage_path]);
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

test("missing rework object preserves the existing incomplete-upload conflict", async () => {
  const { review, file } = reworkRows();
  const mock = new FlowSupabaseMock();
  mock.setRows("deliverable_reviews", [review]);
  mock.setRows("deliverable_review_files", [file]);
  mock.install();

  const result = await markReworkReferenceUploaded(REVIEW_ID, REFERENCE_ID, {
    userId: USER_ID,
    email: "client@example.com",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
  assert.deepEqual(mock.prefixReads, []);
});
