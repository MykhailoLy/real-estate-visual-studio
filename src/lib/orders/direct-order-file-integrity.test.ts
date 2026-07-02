import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  MAX_FILE_SIZE_BYTES,
  ORDER_FILES_BUCKET,
  type UploadKind,
} from "../upload-config.ts";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ORDER_NUMBER = "VS-0001";

const SUPABASE_ADMIN_MOCK_URL = `data:text/javascript,${encodeURIComponent(`
export class SupabaseAdminConfigurationError extends Error {}
export function getSupabaseAdminClient() {
  return globalThis.__directOrderTestSupabase;
}
`)}`;

const EMAIL_MOCK_URL = `data:text/javascript,${encodeURIComponent(`
export async function sendOrderEmails(args) {
  if (typeof globalThis.__directOrderEmailMock === "function") {
    return globalThis.__directOrderEmailMock(args);
  }
  return { client: { sent: true }, admin: { sent: true } };
}
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export default undefined;",
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/supabase-admin") {
      return { url: SUPABASE_ADMIN_MOCK_URL, shortCircuit: true };
    }
    if (specifier === "@/lib/email/send-order-emails") {
      return { url: EMAIL_MOCK_URL, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const localPath = join(ROOT_DIR, "src", specifier.slice(2));
      const resolved = resolveLocalModule(localPath);
      if (resolved) return { url: resolved, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

type ServiceTypeForTest =
  | "virtual-staging"
  | "virtual-renovation"
  | "3d-floor-plans"
  | "photo-editing";

interface FileDescriptorForTest {
  bucket: string;
  path: string;
  originalFilename: string;
  size: number;
  mimeType: string;
  draftFileId?: string;
}

interface ItemFilesForTest {
  original: FileDescriptorForTest;
  reference?: FileDescriptorForTest | null;
}

interface ProductionOrderInputForTest {
  ownerUserId: string;
  clientIdentity: {
    name: string;
    email: string;
    phone: string;
    company: string;
  };
  serviceType: ServiceTypeForTest;
  jobTitle: string;
  currency: "USD" | "EUR" | "CAD";
  items: Array<Record<string, unknown>>;
  itemFiles: ItemFilesForTest[];
  termsAcceptance: { accepted: boolean; version: string };
  portfolioPermission: { allowed: boolean };
  sourceDraftId?: string;
  storageMode: "move" | "copy";
}

type ProductionOrderResultForTest =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      emailNotifications: {
        clientConfirmation: boolean;
        adminNotification: boolean;
      };
    }
  | {
      ok: false;
      code: string;
      status: number;
      message: string;
    };

interface VerificationResultForTest<T> {
  ok: boolean;
  data?: T;
  code?: string;
  status?: number;
  message?: string;
}

interface DirectVerificationModuleForTest {
  verifyDirectOrderUploads(input: {
    supabase: unknown;
    serviceType: ServiceTypeForTest;
    itemFiles: ItemFilesForTest[];
  }): Promise<VerificationResultForTest<ItemFilesForTest[]>>;
  validateDirectPendingDescriptorStructure(input: {
    descriptor: FileDescriptorForTest;
    itemIndex: number;
    kind: UploadKind;
    seenPaths?: Set<string>;
  }): VerificationResultForTest<unknown>;
}

interface CreateOrderModuleForTest {
  createProductionOrder(
    input: ProductionOrderInputForTest,
  ): Promise<ProductionOrderResultForTest>;
}

interface EmailMockResult {
  client: { sent: boolean };
  admin: { sent: boolean };
}

type DirectOrderTestGlobals = typeof globalThis & {
  __directOrderTestSupabase?: MockSupabase;
  __directOrderEmailMock?: (args: unknown) => Promise<EmailMockResult>;
};

interface StoredObjectForTest {
  metadata: Record<string, unknown> | null;
}

interface StorageOperationForTest {
  sourcePath: string;
  finalPath: string;
}

interface InsertOperationForTest {
  table: string;
  payload: unknown;
}

interface DeleteOperationForTest {
  table: string;
  column: string;
  value: unknown;
}

interface ListOperationForTest {
  bucket: string;
  directory: string;
  search?: string;
}

interface MockSupabaseOptions {
  rpcError?: boolean;
  orderInsertError?: boolean;
  orderItemsInsertError?: boolean;
  moveFailures?: string[];
  copyFailures?: string[];
  emailResult?: EmailMockResult;
}

class MockSupabase {
  readonly objects = new Map<string, StoredObjectForTest>();
  readonly listCalls: ListOperationForTest[] = [];
  readonly moves: StorageOperationForTest[] = [];
  readonly copies: StorageOperationForTest[] = [];
  readonly removes: string[][] = [];
  readonly inserts: InsertOperationForTest[] = [];
  readonly deletes: DeleteOperationForTest[] = [];
  readonly rpcCalls: Array<{ name: string; params: unknown }> = [];
  readonly emailCalls: unknown[] = [];
  private readonly moveFailures: Set<string>;
  private readonly copyFailures: Set<string>;
  private readonly options: MockSupabaseOptions;

  readonly storage = {
    from: (bucket: string) => ({
      list: async (
        directory: string,
        options?: { search?: string; limit?: number },
      ) => {
        this.listCalls.push({ bucket, directory, search: options?.search });
        const prefix = `${directory}/`;
        const data = Array.from(this.objects.entries())
          .filter(([path]) => path.startsWith(prefix))
          .map(([path, object]) => ({
            name: path.slice(prefix.length),
            metadata: object.metadata,
          }))
          .filter((entry) => !entry.name.includes("/"))
          .filter((entry) =>
            options?.search ? entry.name.includes(options.search) : true,
          );
        return { data, error: null };
      },
      move: async (sourcePath: string, finalPath: string) => {
        this.moves.push({ sourcePath, finalPath });
        if (this.moveFailures.has(moveKey(sourcePath, finalPath))) {
          return { data: null, error: storageError("MoveFailed") };
        }
        const object = this.objects.get(sourcePath);
        if (!object) return { data: null, error: storageError("NotFound") };
        this.objects.delete(sourcePath);
        this.objects.set(finalPath, object);
        return { data: { path: finalPath }, error: null };
      },
      copy: async (sourcePath: string, finalPath: string) => {
        this.copies.push({ sourcePath, finalPath });
        if (this.copyFailures.has(moveKey(sourcePath, finalPath))) {
          return { data: null, error: storageError("CopyFailed") };
        }
        const object = this.objects.get(sourcePath);
        if (!object) return { data: null, error: storageError("NotFound") };
        this.objects.set(finalPath, { metadata: object.metadata });
        return { data: { path: finalPath }, error: null };
      },
      remove: async (paths: string[]) => {
        this.removes.push([...paths]);
        for (const path of paths) this.objects.delete(path);
        return { data: null, error: null };
      },
    }),
  };

  constructor(options: MockSupabaseOptions = {}) {
    this.options = options;
    this.moveFailures = new Set(options.moveFailures ?? []);
    this.copyFailures = new Set(options.copyFailures ?? []);
  }

  addObject(path: string, metadata: Record<string, unknown> | null): void {
    this.objects.set(path, { metadata });
  }

  async rpc(name: string, params: unknown) {
    this.rpcCalls.push({ name, params });
    if (name === "generate_order_number" && this.options.rpcError) {
      return { data: null, error: databaseError("RpcFailed") };
    }
    return { data: ORDER_NUMBER, error: null };
  }

  from(table: string): MockTableQuery {
    return new MockTableQuery(this, table);
  }

  get emailResult(): EmailMockResult {
    return this.options.emailResult ?? {
      client: { sent: true },
      admin: { sent: true },
    };
  }

  get shouldFailOrderInsert(): boolean {
    return this.options.orderInsertError === true;
  }

  get shouldFailOrderItemsInsert(): boolean {
    return this.options.orderItemsInsertError === true;
  }
}

class MockTableQuery {
  private readonly supabase: MockSupabase;
  private readonly table: string;

  constructor(
    supabase: MockSupabase,
    table: string,
  ) {
    this.supabase = supabase;
    this.table = table;
  }

  insert(payload: unknown) {
    this.supabase.inserts.push({ table: this.table, payload });
    if (this.table === "orders") {
      return {
        select: () => ({
          single: async () =>
            this.supabase.shouldFailOrderInsert
              ? { data: null, error: databaseError("OrderInsertFailed") }
              : { data: { id: "order-id-1" }, error: null },
        }),
      };
    }
    return {
      error: this.supabase.shouldFailOrderItemsInsert
        ? databaseError("OrderItemsInsertFailed")
        : null,
    };
  }

  delete() {
    return {
      eq: (column: string, value: unknown) => {
        this.supabase.deletes.push({ table: this.table, column, value });
        return { error: null };
      },
    };
  }
}

function resolveLocalModule(localPath: string): string | null {
  const candidates = [
    localPath,
    `${localPath}.ts`,
    `${localPath}.tsx`,
    join(localPath, "index.ts"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ? pathToFileURL(found).href : null;
}

function storageError(name: string): { name: string; message: string } {
  return { name, message: name };
}

function databaseError(name: string): {
  name: string;
  message: string;
  code?: string;
} {
  return { name, message: name };
}

function moveKey(sourcePath: string, finalPath: string): string {
  return `${sourcePath}->${finalPath}`;
}

function directPath(
  itemIndex: number,
  kind: UploadKind,
  extension = "jpg",
): string {
  return `pending/${TOKEN}/${itemIndex}-${kind}.${extension}`;
}

function finalPath(
  itemIndex: number,
  kind: UploadKind,
  extension = "jpg",
): string {
  return `${ORDER_NUMBER}/${itemIndex}-${kind}.${extension}`;
}

function draftPath(
  itemIndex: number,
  kind: UploadKind,
  extension = "jpg",
): string {
  return `drafts/user/draft/file-${itemIndex}-${kind}/source.${extension}`;
}

function metadata(size: number, mimeType: string): Record<string, unknown> {
  return { size, mimetype: mimeType };
}

function descriptor(
  path: string,
  overrides: Partial<FileDescriptorForTest> = {},
): FileDescriptorForTest {
  const extension = path.split(".").pop() ?? "jpg";
  return {
    bucket: ORDER_FILES_BUCKET,
    path,
    originalFilename: `upload.${extension}`,
    size: 1234,
    mimeType: extension === "png" ? "image/png" : "image/jpeg",
    ...overrides,
  };
}

function itemFilesForDirectOrder(count = 1): ItemFilesForTest[] {
  return Array.from({ length: count }, (_value, index) => ({
    original: descriptor(directPath(index, "original")),
  }));
}

function stagingItems(count = 1): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_value, index) => ({
    roomName: `Room ${index + 1}`,
    furnitureStyle: "Modern",
    referenceLink: "",
    additionalInfo: "",
    selectedAddons: [],
    fileSizeLimit: "",
    disclaimerText: "",
  }));
}

function orderInput(
  overrides: Partial<ProductionOrderInputForTest> = {},
): ProductionOrderInputForTest {
  const itemFiles = overrides.itemFiles ?? itemFilesForDirectOrder();
  return {
    ownerUserId: "11111111-1111-4111-8111-111111111111",
    clientIdentity: {
      name: "Ada Client",
      email: "ada@example.com",
      phone: "+15551234567",
      company: "",
    },
    serviceType: "virtual-staging",
    jobTitle: "123 Main Street",
    currency: "USD",
    items: stagingItems(itemFiles.length),
    itemFiles,
    termsAcceptance: { accepted: true, version: "test" },
    portfolioPermission: { allowed: false },
    storageMode: "move",
    ...overrides,
  };
}

function addStoredObjects(
  supabase: MockSupabase,
  itemFiles: ItemFilesForTest[],
): void {
  for (const slot of itemFiles) {
    supabase.addObject(
      slot.original.path,
      metadata(slot.original.size, slot.original.mimeType),
    );
    if (slot.reference) {
      supabase.addObject(
        slot.reference.path,
        metadata(slot.reference.size, slot.reference.mimeType),
      );
    }
  }
}

function installSupabaseMock(supabase: MockSupabase): void {
  const globals = globalThis as DirectOrderTestGlobals;
  globals.__directOrderTestSupabase = supabase;
  globals.__directOrderEmailMock = async (args: unknown) => {
    supabase.emailCalls.push(args);
    return supabase.emailResult;
  };
}

async function loadVerifier(): Promise<DirectVerificationModuleForTest> {
  return import("./direct-upload-verification.ts") as Promise<
    DirectVerificationModuleForTest
  >;
}

async function loadOrderModule(): Promise<CreateOrderModuleForTest> {
  return import("./create-order-server.ts") as Promise<CreateOrderModuleForTest>;
}

function assertFailure(
  result: VerificationResultForTest<unknown> | ProductionOrderResultForTest,
  code: string,
): void {
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, code);
}

function getOrderItemsPayload(supabase: MockSupabase): Record<string, unknown>[] {
  const insert = supabase.inserts.find((entry) => entry.table === "order_items");
  assert.ok(insert);
  assert.ok(Array.isArray(insert.payload));
  return insert.payload.map((entry) => asRecord(entry));
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

test("direct verifier accepts a valid original file", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(path, metadata(1234, "image/jpeg"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(path) }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.data?.[0]?.original.size, 1234);
  assert.equal(result.data?.[0]?.original.mimeType, "image/jpeg");
});

test("direct verifier accepts an original plus reference", async () => {
  const originalPath = directPath(0, "original");
  const referencePath = directPath(0, "reference", "png");
  const supabase = new MockSupabase();
  supabase.addObject(originalPath, metadata(1234, "image/jpeg"));
  supabase.addObject(referencePath, metadata(2222, "image/png"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    serviceType: "virtual-staging",
    itemFiles: [
      {
        original: descriptor(originalPath),
        reference: descriptor(referencePath, {
          size: 2222,
          mimeType: "image/png",
          originalFilename: "reference.png",
        }),
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.data?.[0]?.reference?.size, 2222);
});

test("direct verifier rejects nonexistent pending objects", async () => {
  const verifier = await loadVerifier();
  const result = await verifier.verifyDirectOrderUploads({
    supabase: new MockSupabase(),
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(directPath(0, "original")) }],
  });

  assertFailure(result, "invalid_upload");
  assert.equal(result.status, 409);
});

test("direct verifier rejects fabricated paths", async () => {
  const verifier = await loadVerifier();
  const result = verifier.validateDirectPendingDescriptorStructure({
    descriptor: descriptor("orders/VS-0001/0-original.jpg"),
    itemIndex: 0,
    kind: "original",
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier rejects malformed pending tokens", async () => {
  const verifier = await loadVerifier();
  const result = verifier.validateDirectPendingDescriptorStructure({
    descriptor: descriptor("pending/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/0-original.jpg"),
    itemIndex: 0,
    kind: "original",
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier rejects an incorrect item index in the path", async () => {
  const verifier = await loadVerifier();
  const result = verifier.validateDirectPendingDescriptorStructure({
    descriptor: descriptor(directPath(1, "original")),
    itemIndex: 0,
    kind: "original",
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier rejects an incorrect upload kind in the path", async () => {
  const verifier = await loadVerifier();
  const result = verifier.validateDirectPendingDescriptorStructure({
    descriptor: descriptor(directPath(0, "reference")),
    itemIndex: 0,
    kind: "original",
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier rejects duplicate pending paths in one order", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(path, metadata(1234, "image/jpeg"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    serviceType: "virtual-staging",
    itemFiles: [
      {
        original: descriptor(path),
        reference: descriptor(path),
      },
    ],
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier rejects actual size mismatch", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(path, metadata(9999, "image/jpeg"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(path) }],
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier rejects actual MIME mismatch", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(path, metadata(1234, "image/png"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(path) }],
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier rejects actual files over 20 MB", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(path, metadata(MAX_FILE_SIZE_BYTES + 1, "image/jpeg"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    serviceType: "virtual-staging",
    itemFiles: [
      {
        original: descriptor(path, {
          size: MAX_FILE_SIZE_BYTES + 1,
        }),
      },
    ],
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier rejects disallowed MIME types by service and kind", async () => {
  const path = directPath(0, "reference", "pdf");
  const supabase = new MockSupabase();
  supabase.addObject(path, metadata(1234, "application/pdf"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    serviceType: "3d-floor-plans",
    itemFiles: [
      {
        original: descriptor(directPath(0, "original")),
        reference: descriptor(path, {
          originalFilename: "reference.pdf",
          mimeType: "application/pdf",
        }),
      },
    ],
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier rejects missing required Storage metadata", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(path, { size: 1234 });
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(path) }],
  });

  assertFailure(result, "invalid_upload");
});

test("direct verifier returns normalized server-trusted metadata", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(path, metadata(1234, "IMAGE/JPEG"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    serviceType: "virtual-staging",
    itemFiles: [
      {
        original: descriptor(path, {
          mimeType: "image/jpeg",
          originalFilename: "client-name.jpg",
        }),
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.data?.[0]?.original.mimeType, "image/jpeg");
  assert.equal(result.data?.[0]?.original.originalFilename, "client-name.jpg");
});

test("successful direct finalization moves files and uses verified metadata", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase();
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assert.equal(result.ok, true);
  assert.equal(supabase.objects.has(directPath(0, "original")), false);
  assert.equal(supabase.objects.has(finalPath(0, "original")), true);
  assert.equal(supabase.emailCalls.length, 1);
  const payload = getOrderItemsPayload(supabase);
  const details = asRecord(payload[0].details);
  const uploadedFiles = asRecord(details.uploaded_files);
  const original = asRecord(uploadedFiles.original);
  assert.equal(original.size_bytes, 1234);
  assert.equal(original.mime_type, "image/jpeg");
});

test("first direct move failure creates no order and sends no email", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const source = directPath(0, "original");
  const supabase = new MockSupabase({
    moveFailures: [moveKey(source, finalPath(0, "original"))],
  });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "storage_error");
  assert.equal(supabase.inserts.length, 0);
  assert.equal(supabase.emailCalls.length, 0);
  assert.equal(supabase.objects.has(source), true);
});

test("later direct move failure rolls earlier moves back in reverse order", async () => {
  const itemFiles: ItemFilesForTest[] = [
    {
      original: descriptor(directPath(0, "original")),
      reference: descriptor(directPath(0, "reference", "png"), {
        size: 1234,
        mimeType: "image/png",
      }),
    },
    { original: descriptor(directPath(1, "original")) },
  ];
  const failingMove = moveKey(directPath(1, "original"), finalPath(1, "original"));
  const supabase = new MockSupabase({ moveFailures: [failingMove] });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "storage_error");
  assert.deepEqual(
    supabase.moves.map((move) => moveKey(move.sourcePath, move.finalPath)),
    [
      moveKey(directPath(0, "original"), finalPath(0, "original")),
      moveKey(directPath(0, "reference", "png"), finalPath(0, "reference", "png")),
      failingMove,
      moveKey(finalPath(0, "reference", "png"), directPath(0, "reference", "png")),
      moveKey(finalPath(0, "original"), directPath(0, "original")),
    ],
  );
  assert.equal(supabase.inserts.length, 0);
  assert.equal(supabase.emailCalls.length, 0);
});

test("rollback failure still creates no order", async () => {
  const itemFiles = [
    { original: descriptor(directPath(0, "original")) },
    { original: descriptor(directPath(1, "original")) },
  ];
  const supabase = new MockSupabase({
    moveFailures: [
      moveKey(directPath(1, "original"), finalPath(1, "original")),
      moveKey(finalPath(0, "original"), directPath(0, "original")),
    ],
  });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "storage_error");
  assert.equal(supabase.inserts.length, 0);
  assert.equal(supabase.emailCalls.length, 0);
});

test("order-number RPC failure leaves direct pending sources untouched", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase({ rpcError: true });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "database_error");
  assert.equal(supabase.objects.has(directPath(0, "original")), true);
  assert.equal(supabase.moves.length, 0);
  assert.equal(supabase.removes.length, 0);
  assert.equal(supabase.emailCalls.length, 0);
});

test("order insert failure rolls all direct moves back", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase({ orderInsertError: true });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "database_error");
  assert.deepEqual(
    supabase.moves.map((move) => moveKey(move.sourcePath, move.finalPath)),
    [
      moveKey(directPath(0, "original"), finalPath(0, "original")),
      moveKey(finalPath(0, "original"), directPath(0, "original")),
    ],
  );
  assert.equal(supabase.emailCalls.length, 0);
});

test("order-item insert failure deletes the order and rolls direct moves back", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase({ orderItemsInsertError: true });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "database_error");
  assert.deepEqual(supabase.deletes, [
    { table: "orders", column: "id", value: "order-id-1" },
  ]);
  assert.equal(supabase.objects.has(directPath(0, "original")), true);
  assert.equal(supabase.emailCalls.length, 0);
});

test("email failure after database success preserves the direct order", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase({
    emailResult: { client: { sent: false }, admin: { sent: false } },
  });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assert.equal(result.ok, true);
  assert.equal(result.ok ? result.emailNotifications.clientConfirmation : true, false);
  assert.equal(supabase.objects.has(finalPath(0, "original")), true);
  assert.equal(supabase.inserts.some((entry) => entry.table === "orders"), true);
});

test("repeated direct submission after a successful move is rejected", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase();
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const first = await createProductionOrder(orderInput({ itemFiles }));
  const second = await createProductionOrder(orderInput({ itemFiles }));

  assert.equal(first.ok, true);
  assertFailure(second, "invalid_upload");
  assert.equal(
    supabase.inserts.filter((entry) => entry.table === "orders").length,
    1,
  );
});

test("verification failure sends no email and creates no order", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase();
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "invalid_upload");
  assert.equal(supabase.inserts.length, 0);
  assert.equal(supabase.emailCalls.length, 0);
});

test("draft copy flow still copies instead of moving", async () => {
  const sourcePath = draftPath(0, "original");
  const itemFiles = [
    {
      original: descriptor(sourcePath, {
        draftFileId: "draft-file-1",
      }),
    },
  ];
  const supabase = new MockSupabase();
  supabase.addObject(sourcePath, metadata(1234, "image/jpeg"));
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(
    orderInput({ itemFiles, storageMode: "copy", sourceDraftId: "draft-1" }),
  );

  assert.equal(result.ok, true);
  assert.equal(supabase.listCalls.length, 0);
  assert.equal(supabase.moves.length, 0);
  assert.deepEqual(supabase.copies, [
    { sourcePath, finalPath: finalPath(0, "original") },
  ]);
  assert.equal(supabase.objects.has(sourcePath), true);
  assert.equal(supabase.objects.has(finalPath(0, "original")), true);
});

test("draft copy failure remains fatal", async () => {
  const sourcePath = draftPath(0, "original");
  const itemFiles = [
    {
      original: descriptor(sourcePath, {
        draftFileId: "draft-file-1",
      }),
    },
  ];
  const supabase = new MockSupabase({
    copyFailures: [moveKey(sourcePath, finalPath(0, "original"))],
  });
  supabase.addObject(sourcePath, metadata(1234, "image/jpeg"));
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(
    orderInput({ itemFiles, storageMode: "copy", sourceDraftId: "draft-1" }),
  );

  assertFailure(result, "storage_error");
  assert.equal(supabase.inserts.length, 0);
  assert.equal(supabase.emailCalls.length, 0);
});
