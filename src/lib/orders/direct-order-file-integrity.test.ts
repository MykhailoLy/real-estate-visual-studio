import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildFinalPath,
  buildPendingPath,
  MAX_FILE_SIZE_BYTES,
  ORDER_FILES_BUCKET,
  parseDirectPendingPath,
  type UploadKind,
} from "../upload-config.ts";
import { LEGAL_VERSION as TERMS_VERSION } from "../legal.ts";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_USER_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN = "aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa";
const SECOND_TOKEN = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SUBMISSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REFERENCE_ID = "77777777-7777-4777-8777-777777777777";
const ORDER_NUMBER = "VS-0001";
const SUBMIT_ORDER_SOURCE = readFileSync("src/lib/submit-order.ts", "utf8");
const DRAFT_STORAGE_PATHS_SOURCE = readFileSync(
  "src/lib/order-drafts/storage-paths.ts",
  "utf8",
);

const SUPABASE_ADMIN_MOCK_URL = `data:text/javascript,${encodeURIComponent(`
export class SupabaseAdminConfigurationError extends Error {}
export function getSupabaseAdminClient() {
  return globalThis.__directOrderTestSupabase;
}
`)}`;

const EMAIL_MOCK_URL = `data:text/javascript,${encodeURIComponent(`
export async function dispatchOrderEmailOutbox(args) {
  if (typeof globalThis.__directOrderEmailMock === "function") {
    return globalThis.__directOrderEmailMock(args);
  }
  return { claimed: 2, sent: 2, failed: 0, unknown: 0 };
}
`)}`;

const CLIENT_AUTH_MOCK_URL = `data:text/javascript,${encodeURIComponent(`
export async function getClientUser() {
  return globalThis.__directOrderTestClientUser ?? null;
}
export async function isClientAuthenticated() {
  return Boolean(globalThis.__directOrderTestClientUser);
}
export function getInitials() {
  return "";
}
`)}`;

const SUPABASE_JS_MOCK_URL = `data:text/javascript,${encodeURIComponent(`
export function createClient(url, key) {
  if (typeof globalThis.__directOrderCreateClientMock === "function") {
    return globalThis.__directOrderCreateClientMock(url, key);
  }
  return globalThis.__directOrderUploadUrlSupabase;
}
`)}`;

const NEXT_SERVER_MOCK_URL = `data:text/javascript,${encodeURIComponent(`
export const NextResponse = {
  json(body, init) {
    return Response.json(body, init);
  },
};
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
    if (specifier === "@/lib/client-auth") {
      return { url: CLIENT_AUTH_MOCK_URL, shortCircuit: true };
    }
    if (specifier === "@/lib/email/send-order-emails") {
      return { url: EMAIL_MOCK_URL, shortCircuit: true };
    }
    if (specifier === "@supabase/supabase-js") {
      return { url: SUPABASE_JS_MOCK_URL, shortCircuit: true };
    }
    if (specifier === "next/server") {
      return { url: NEXT_SERVER_MOCK_URL, shortCircuit: true };
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
  references?: Array<FileDescriptorForTest & { referenceId: string; position: number }>;
}

interface ProductionOrderInputForTest {
  submissionId: string;
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
  termsAcceptance: {
    accepted: boolean;
    version?: string;
    acceptedAt?: string;
  };
  portfolioPermission: { allowed: boolean };
  sourceDraftId?: string;
  storageMode: "move" | "copy";
}

type ProductionOrderResultForTest =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      replayed: boolean;
      pricingSnapshot: {
        items: Array<{ lineSubtotalCents: number }>;
      };
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
    ownerUserId: string;
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

interface OrderFingerprintModuleForTest {
  createOrderIntentHash(input: ProductionOrderInputForTest): string;
}

interface EmailMockResult {
  claimed: number;
  sent: number;
  failed: number;
  unknown: number;
}

type DirectOrderTestGlobals = typeof globalThis & {
  __directOrderTestSupabase?: MockSupabase;
  __directOrderEmailMock?: (args: unknown) => Promise<EmailMockResult>;
  __directOrderTestClientUser?: { id: string; email: string } | null;
  __directOrderUploadUrlSupabase?: MockUploadUrlSupabase;
  __directOrderCreateClientMock?: (
    url: string,
    key: string,
  ) => MockUploadUrlSupabase;
};

interface StoredObjectForTest {
  metadata: Record<string, unknown> | null;
  bytes: Uint8Array;
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
  limit?: number;
}

interface MockSupabaseOptions {
  rpcError?: boolean;
  claimCode?: string;
  commitCode?: string;
  commitError?: boolean;
  recoveryCommitted?: boolean;
  orderInsertError?: boolean;
  orderItemsInsertError?: boolean;
  listFailures?: string[];
  moveFailures?: string[];
  copyFailures?: string[];
  signedReadFailures?: string[];
  prefixReadFailures?: string[];
  malformedRangeResponses?: string[];
  mutateOnInfoCall?: {
    path: string;
    callNumber: number;
    metadata: Record<string, unknown>;
    bytes?: Uint8Array;
  };
  emailResult?: EmailMockResult;
}

class MockSupabase {
  readonly objects = new Map<string, StoredObjectForTest>();
  readonly infoCalls: string[] = [];
  readonly signedReadPaths: string[] = [];
  readonly prefixReadCalls: Array<{ path: string; range: string | null; ifMatch: string | null }> = [];
  readonly listCalls: ListOperationForTest[] = [];
  readonly moves: StorageOperationForTest[] = [];
  readonly copies: StorageOperationForTest[] = [];
  readonly removes: string[][] = [];
  readonly inserts: InsertOperationForTest[] = [];
  readonly deletes: DeleteOperationForTest[] = [];
  readonly rpcCalls: Array<{ name: string; params: unknown }> = [];
  readonly emailCalls: unknown[] = [];
  private readonly listFailures: Set<string>;
  private readonly moveFailures: Set<string>;
  private readonly copyFailures: Set<string>;
  private readonly signedReadFailures: Set<string>;
  private readonly prefixReadFailures: Set<string>;
  private readonly malformedRangeResponses: Set<string>;
  private readonly options: MockSupabaseOptions;

  readonly storage = {
    from: (bucket: string) => ({
      info: async (path: string) => {
        this.infoCalls.push(path);
        const mutation = this.options.mutateOnInfoCall;
        if (
          mutation?.path === path &&
          this.infoCalls.filter((candidate) => candidate === path).length === mutation.callNumber
        ) {
          this.addObject(path, mutation.metadata, mutation.bytes);
        }
        const object = this.objects.get(path);
        if (!object?.metadata) {
          return { data: null, error: storageError("NotFound") };
        }
        return {
          data: {
            size: object.metadata.size,
            contentType: object.metadata.mimetype,
            etag: object.metadata.eTag,
            metadata: object.metadata,
          },
          error: null,
        };
      },
      createSignedUrl: async (path: string) => {
        this.signedReadPaths.push(path);
        if (this.signedReadFailures.has(path)) {
          return { data: null, error: storageError("SignedReadFailed") };
        }
        return {
          data: { signedUrl: `https://storage.example/read/${encodeURIComponent(path)}` },
          error: null,
        };
      },
      list: async (
        directory: string,
        options?: { search?: string; limit?: number },
      ) => {
        this.listCalls.push({
          bucket,
          directory,
          search: options?.search,
          limit: options?.limit,
        });
        if (this.listFailures.has(directory)) {
          return { data: null, error: storageError("ListFailed") };
        }
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
          )
          .slice(0, options?.limit);
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
        this.objects.set(finalPath, {
          metadata: object.metadata,
          bytes: object.bytes,
        });
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
    this.listFailures = new Set(options.listFailures ?? []);
    this.moveFailures = new Set(options.moveFailures ?? []);
    this.copyFailures = new Set(options.copyFailures ?? []);
    this.signedReadFailures = new Set(options.signedReadFailures ?? []);
    this.prefixReadFailures = new Set(options.prefixReadFailures ?? []);
    this.malformedRangeResponses = new Set(options.malformedRangeResponses ?? []);
  }

  addObject(
    path: string,
    metadata: Record<string, unknown> | null,
    bytes = defaultSignatureForMime(String(metadata?.mimetype ?? "")),
  ): void {
    this.objects.set(path, { metadata, bytes });
  }

  async readSignedObject(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const path = decodeURIComponent(url.pathname.slice("/read/".length));
    const headers = new Headers(init?.headers);
    this.prefixReadCalls.push({
      path,
      range: headers.get("range"),
      ifMatch: headers.get("if-match"),
    });

    if (this.prefixReadFailures.has(path)) {
      return new Response("Storage unavailable", { status: 503 });
    }

    const object = this.objects.get(path);
    if (!object?.metadata) return new Response("Missing", { status: 404 });

    const objectSize = Number(object.metadata.size);
    const prefixLength = Math.min(512, objectSize);
    const prefix = new Uint8Array(prefixLength);
    prefix.set(object.bytes.subarray(0, prefixLength));

    const responseHeaders: Record<string, string> = {
      "content-range": this.malformedRangeResponses.has(path)
        ? `bytes 1-${prefixLength}/${objectSize}`
        : `bytes 0-${prefixLength - 1}/${objectSize}`,
    };
    if (typeof object.metadata.eTag === "string") {
      responseHeaders.etag = object.metadata.eTag;
    }

    return new Response(prefix, { status: 206, headers: responseHeaders });
  }

  async rpc(name: string, params: unknown) {
    this.rpcCalls.push({ name, params });
    if (this.options.rpcError) {
      return { data: null, error: databaseError("RpcFailed") };
    }
    const input = params as Record<string, unknown>;
    if (name === "claim_order_submission") {
      const code = this.options.claimCode ?? "claimed";
      this.claimSnapshot = input.p_pricing_snapshot;
      return {
        data: [{
          result_code: code,
          lease_token: code === "claimed" ? input.p_lease_token : null,
          reserved_order_id: "33333333-3333-4333-8333-333333333333",
          reserved_order_number: ORDER_NUMBER,
          order_id: code === "committed" ? "33333333-3333-4333-8333-333333333333" : null,
          estimated_total_cents: input.p_estimated_total_cents,
          currency: input.p_currency,
          pricing_snapshot: input.p_pricing_snapshot,
        }],
        error: null,
      };
    }
    if (name === "commit_order_submission") {
      if (this.options.commitError) {
        return { data: null, error: databaseError("CommitConnectionLost") };
      }
      const items = input.p_items as unknown[];
      return {
        data: [{
          result_code: this.options.commitCode ?? "created",
          created: (this.options.commitCode ?? "created") === "created",
          order_id: "33333333-3333-4333-8333-333333333333",
          order_number: ORDER_NUMBER,
          estimated_total_cents: 2900,
          currency: "USD",
          pricing_snapshot: this.claimSnapshot,
          item_count: items.length,
        }],
        error: null,
      };
    }
    return { data: "released", error: null };
  }

  claimSnapshot: unknown = null;

  from(table: string): MockTableQuery {
    return new MockTableQuery(this, table);
  }

  get emailResult(): EmailMockResult {
    return this.options.emailResult ?? {
      claimed: 2,
      sent: 2,
      failed: 0,
      unknown: 0,
    };
  }

  get shouldFailOrderInsert(): boolean {
    return this.options.orderInsertError === true;
  }

  get shouldFailOrderItemsInsert(): boolean {
    return this.options.orderItemsInsertError === true;
  }

  get recoveryCommitted(): boolean {
    return this.options.recoveryCommitted === true;
  }
}

class MockUploadUrlSupabase {
  readonly signedUploadPaths: string[] = [];
  readonly buckets: string[] = [];
  signedUploadError: { name: string; message: string } | null = null;

  readonly storage = {
    from: (bucket: string) => ({
      createSignedUploadUrl: async (path: string) => {
        this.buckets.push(bucket);
        this.signedUploadPaths.push(path);
        if (this.signedUploadError) {
          return { data: null, error: this.signedUploadError };
        }
        return {
          data: {
            path,
            token: "signed-upload-token",
            signedUrl: `https://storage.example/upload/${encodeURIComponent(path)}`,
          },
          error: null,
        };
      },
    }),
  };
}

class MockTableQuery {
  private readonly supabase: MockSupabase;
  private readonly table: string;
  private filters = new Map<string, unknown>();

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

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  async maybeSingle() {
    if (this.table === "order_submissions" && this.supabase.recoveryCommitted) {
      return {
        data: {
          status: "committed",
          order_id: "33333333-3333-4333-8333-333333333333",
          reserved_order_number: ORDER_NUMBER,
          estimated_total_cents: 2900,
          currency: "USD",
          pricing_snapshot: this.supabase.claimSnapshot,
        },
        error: null,
      };
    }
    return { data: null, error: null };
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

function directPathForToken(
  token: string,
  itemIndex: number,
  kind: UploadKind,
  extension = "jpg",
): string {
  return directPathForUserAndToken(USER_ID, token, itemIndex, kind, extension);
}

function directPathForUserAndToken(
  userId: string,
  token: string,
  itemIndex: number,
  kind: UploadKind,
  extension = "jpg",
): string {
  return `pending/${userId}/${token}/${itemIndex}-${kind}.${extension}`;
}

function directDirectory(token = TOKEN, userId = USER_ID): string {
  return `pending/${userId}/${token}`;
}

function directPath(
  itemIndex: number,
  kind: UploadKind,
  extension = "jpg",
): string {
  return directPathForToken(TOKEN, itemIndex, kind, extension);
}

function finalPath(
  itemIndex: number,
  kind: UploadKind,
  extension = "jpg",
): string {
  return `${ORDER_NUMBER}/${itemIndex}-${kind}.${extension}`;
}

function metadata(
  size: number,
  mimeType: string,
  etag = `"etag-${size}-${mimeType}"`,
): Record<string, unknown> {
  return { size, mimetype: mimeType, eTag: etag };
}

function defaultSignatureForMime(mimeType: string): Uint8Array {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
      return Uint8Array.of(0xff, 0xd8, 0xff, 0xe0);
    case "image/png":
      return Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/gif":
      return new TextEncoder().encode("GIF89a");
    case "image/webp":
      return new TextEncoder().encode("RIFF\u0018\u0000\u0000\u0000WEBPVP8 ");
    case "application/pdf":
      return new TextEncoder().encode("%PDF-1.7\n");
    default:
      return Uint8Array.of(0xff, 0xd8, 0xff, 0xe0);
  }
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
    submissionId: SUBMISSION_ID,
    ownerUserId: USER_ID,
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
    termsAcceptance: { accepted: true, version: TERMS_VERSION },
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
    for (const reference of slot.references ?? []) {
      supabase.addObject(
        reference.path,
        metadata(reference.size, reference.mimeType),
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
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    supabase.readSignedObject(input, init);
}

function installUploadRouteMock(input: {
  sessionUserId?: string | null;
  supabase?: MockUploadUrlSupabase;
} = {}): MockUploadUrlSupabase {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret-marker";
  const globals = globalThis as DirectOrderTestGlobals;
  const supabase = input.supabase ?? new MockUploadUrlSupabase();
  globals.__directOrderTestClientUser =
    input.sessionUserId === null
      ? null
      : {
          id: input.sessionUserId ?? USER_ID,
          email: "client@example.com",
        };
  globals.__directOrderUploadUrlSupabase = supabase;
  globals.__directOrderCreateClientMock = () => supabase;
  return supabase;
}

async function loadVerifier(): Promise<DirectVerificationModuleForTest> {
  return import("./direct-upload-verification.ts") as Promise<
    DirectVerificationModuleForTest
  >;
}

async function loadOrderModule(): Promise<CreateOrderModuleForTest> {
  return import("./create-order-server.ts") as Promise<CreateOrderModuleForTest>;
}

async function loadOrderFingerprintModule(): Promise<OrderFingerprintModuleForTest> {
  return import("./order-submission-fingerprint.ts") as Promise<
    OrderFingerprintModuleForTest
  >;
}

async function loadServerValidation(): Promise<{
  UploadedFileSchema: {
    safeParse(value: unknown): { success: boolean };
  };
}> {
  return import("../server-validation.ts") as Promise<{
    UploadedFileSchema: {
      safeParse(value: unknown): { success: boolean };
    };
  }>;
}

async function loadUploadRoute(): Promise<{
  POST(request: Request): Promise<Response>;
}> {
  return import("../../app/(public)/api/upload-url/route.ts") as Promise<{
    POST(request: Request): Promise<Response>;
  }>;
}

function validUploadUrlBody(overrides: Record<string, unknown> = {}) {
  return {
    submissionId: SUBMISSION_ID,
    serviceType: "virtual-staging",
    pendingToken: TOKEN,
    itemIndex: 0,
    kind: "original",
    filename: "room.jpg",
    contentType: "image/jpeg",
    size: 1234,
    ...overrides,
  };
}

function uploadUrlRequest(body: unknown): Request {
  return new Request("https://example.test/api/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function responseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function assertFailure(
  result: VerificationResultForTest<unknown> | ProductionOrderResultForTest,
  code: string,
): void {
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, code);
}

function assertListCalls(
  supabase: MockSupabase,
  directories: string[],
): void {
  assert.deepEqual(
    supabase.listCalls,
    directories.map((directory) => ({
      bucket: ORDER_FILES_BUCKET,
      directory,
      search: undefined,
      limit: 100,
    })),
  );
}

test("direct pending path helpers build and parse the canonical user-bound format", () => {
  const path = buildPendingPath(USER_ID, TOKEN, 3, "reference", "jpg");
  assert.equal(path, `${directDirectory()}/3-reference.jpg`);

  assert.deepEqual(parseDirectPendingPath(path), {
    userId: USER_ID,
    pendingToken: TOKEN,
    directory: directDirectory(),
    basename: "3-reference.jpg",
    itemIndex: 3,
    kind: "reference",
    extension: "jpg",
  });
});

test("direct pending path parser rejects noncanonical paths", () => {
  const cases = [
    ["malformed uuid", `pending/not-a-uuid/${TOKEN}/0-original.jpg`],
    [
      "uppercase uuid",
      directPathForUserAndToken(
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa".toUpperCase(),
        TOKEN,
        0,
        "original",
      ),
    ],
    ["missing user segment", `pending/${TOKEN}/0-original.jpg`],
    ["legacy path", `pending/${TOKEN}/0-original.jpg`],
    ["traversal", `pending/${USER_ID}/${TOKEN}/../0-original.jpg`],
    ["extra segment", `${directPath(0, "original")}/extra`],
    ["short token", directPathForUserAndToken(USER_ID, "abc", 0, "original")],
    [
      "non-hex token",
      directPathForUserAndToken(
        USER_ID,
        "gggggggggggggggggggggggggggggggg",
        0,
        "original",
      ),
    ],
    ["uppercase token", directPathForUserAndToken(USER_ID, TOKEN.toUpperCase(), 0, "original")],
    ["negative index", `${directDirectory()}/-1-original.jpg`],
    ["leading-zero index", `${directDirectory()}/01-original.jpg`],
    ["wrong kind", `${directDirectory()}/0-preview.jpg`],
    ["invalid extension", `${directDirectory()}/0-original.jp-g`],
    ["uppercase extension", `${directDirectory()}/0-original.JPG`],
  ] as const;

  for (const [name, path] of cases) {
    assert.equal(parseDirectPendingPath(path), null, name);
  }
});

test("uploaded-file schema accepts only user-bound direct pending paths", async () => {
  const { UploadedFileSchema } = await loadServerValidation();

  assert.equal(
    UploadedFileSchema.safeParse(descriptor(directPath(0, "original"))).success,
    true,
  );
  assert.equal(
    UploadedFileSchema.safeParse(descriptor(`pending/${TOKEN}/0-original.jpg`))
      .success,
    false,
  );
  assert.equal(
    UploadedFileSchema.safeParse(
      descriptor(`pending/not-a-uuid/${TOKEN}/0-original.jpg`),
    ).success,
    false,
  );
});

test("final and draft path builders keep their existing storage formats", () => {
  assert.equal(buildFinalPath(ORDER_NUMBER, 0, "original", "jpg"), finalPath(0, "original"));
  assert.match(
    DRAFT_STORAGE_PATHS_SOURCE,
    /return `drafts\/\$\{parsedUserId\}\/\$\{parsedDraftId\}\/\$\{parsedFileId\}\/\$\{sanitizedFilename\}`;/,
  );
});

test("submit-order treats the returned signed-upload path as opaque", () => {
  assert.match(SUBMIT_ORDER_SOURCE, /path: origUrl\.data\.path/);
  assert.match(SUBMIT_ORDER_SOURCE, /path: refUrl\.data\.path/);
  assert.match(SUBMIT_ORDER_SOURCE, /\.uploadToSignedUrl\(path, token, file/);
  assert.doesNotMatch(SUBMIT_ORDER_SOURCE, /pending\/\$\{/);
});

test("upload-url route rejects unauthenticated requests", async () => {
  const supabase = installUploadRouteMock({ sessionUserId: null });
  const { POST } = await loadUploadRoute();

  const response = await POST(uploadUrlRequest(validUploadUrlBody()));

  assert.equal(response.status, 401);
  assert.equal(supabase.signedUploadPaths.length, 0);
});

test("upload-url route tells an authenticated old tab to refresh", async () => {
  const supabase = installUploadRouteMock();
  const { POST } = await loadUploadRoute();
  const legacyBody = validUploadUrlBody() as Record<string, unknown>;
  delete legacyBody.submissionId;

  const response = await POST(uploadUrlRequest(legacyBody));
  const body = await responseJson(response);

  assert.equal(response.status, 409);
  assert.equal(body.code, "client_upgrade_required");
  assert.equal(supabase.signedUploadPaths.length, 0);
});

test("upload-url route uses the server-derived user ID", async () => {
  const supabase = installUploadRouteMock();
  const { POST } = await loadUploadRoute();

  const response = await POST(uploadUrlRequest(validUploadUrlBody()));
  const body = await responseJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.bucket, ORDER_FILES_BUCKET);
  assert.equal(body.path, directPath(0, "original"));
  assert.deepEqual(supabase.buckets, [ORDER_FILES_BUCKET]);
  assert.deepEqual(supabase.signedUploadPaths, [directPath(0, "original")]);
});

test("upload-url route ignores client-supplied userId", async () => {
  installUploadRouteMock();
  const { POST } = await loadUploadRoute();

  const response = await POST(
    uploadUrlRequest(validUploadUrlBody({ userId: SECOND_USER_ID })),
  );
  const body = await responseJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.path, directPath(0, "original"));
  assert.equal(String(body.path).includes(SECOND_USER_ID), false);
});

test("upload-url route separates two users with the same token", async () => {
  installUploadRouteMock({ sessionUserId: USER_ID });
  const { POST } = await loadUploadRoute();
  const first = await responseJson(await POST(uploadUrlRequest(validUploadUrlBody())));

  installUploadRouteMock({ sessionUserId: SECOND_USER_ID });
  const second = await responseJson(await POST(uploadUrlRequest(validUploadUrlBody())));

  assert.equal(first.path, directPathForUserAndToken(USER_ID, TOKEN, 0, "original"));
  assert.equal(second.path, directPathForUserAndToken(SECOND_USER_ID, TOKEN, 0, "original"));
  assert.notEqual(first.path, second.path);
});

test("upload-url route rejects malformed trusted session UUID before signing", async () => {
  const supabase = installUploadRouteMock({ sessionUserId: "not-a-uuid" });
  const { POST } = await loadUploadRoute();

  const response = await POST(uploadUrlRequest(validUploadUrlBody()));

  assert.equal(response.status, 500);
  assert.equal(supabase.signedUploadPaths.length, 0);
});

test("upload-url route accepts canonical tokens and rejects legacy broad tokens", async () => {
  const supabase = installUploadRouteMock();
  const { POST } = await loadUploadRoute();

  const accepted = await POST(uploadUrlRequest(validUploadUrlBody()));
  const rejected = await POST(
    uploadUrlRequest(validUploadUrlBody({ pendingToken: "legacy_token" })),
  );

  assert.equal(accepted.status, 200);
  assert.equal(rejected.status, 400);
  assert.equal(supabase.signedUploadPaths.length, 1);
});

test("upload-url route preserves upload input validation before signing", async () => {
  const invalidCases = [
    { itemIndex: -1 },
    { kind: "preview" },
    { filename: "room.jp-g" },
    { contentType: "text/plain" },
    { size: 0 },
    { size: MAX_FILE_SIZE_BYTES + 1 },
    { serviceType: "unknown-service" },
  ];

  for (const overrides of invalidCases) {
    const supabase = installUploadRouteMock();
    const { POST } = await loadUploadRoute();
    const response = await POST(uploadUrlRequest(validUploadUrlBody(overrides)));

    assert.equal(response.status, 400, JSON.stringify(overrides));
    assert.equal(supabase.signedUploadPaths.length, 0, JSON.stringify(overrides));
  }
});

test("upload-url route response does not expose service role secrets", async () => {
  installUploadRouteMock();
  const { POST } = await loadUploadRoute();

  const response = await POST(uploadUrlRequest(validUploadUrlBody()));
  const serialized = JSON.stringify(await responseJson(response));

  assert.equal(response.status, 200);
  assert.equal(serialized.includes("service-role-secret-marker"), false);
});

test("upload-url route maps Supabase signing errors to a generic response", async () => {
  const supabase = installUploadRouteMock();
  supabase.signedUploadError = {
    name: "StorageApiError",
    message: "raw bucket internals and service-role-secret-marker",
  };
  const { POST } = await loadUploadRoute();

  const response = await POST(uploadUrlRequest(validUploadUrlBody()));
  const serialized = JSON.stringify(await responseJson(response));

  assert.equal(response.status, 500);
  assert.equal(serialized.includes("StorageApiError"), false);
  assert.equal(serialized.includes("service-role-secret-marker"), false);
  assert.equal(serialized.includes(directDirectory()), false);
});

test("direct verifier accepts a valid original file", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(path, metadata(1234, "image/jpeg"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(path) }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.data?.[0]?.original.size, 1234);
  assert.equal(result.data?.[0]?.original.mimeType, "image/jpeg");
  assertListCalls(supabase, [directDirectory()]);
});

test("direct verifier rejects foreign descriptors before Storage list", async () => {
  const foreignPath = directPathForUserAndToken(
    SECOND_USER_ID,
    TOKEN,
    0,
    "original",
  );
  const supabase = new MockSupabase();
  supabase.addObject(foreignPath, metadata(1234, "image/jpeg"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(foreignPath) }],
  });

  assertFailure(result, "invalid_upload");
  assert.equal(supabase.listCalls.length, 0);
});

test("direct verifier rejects mixed own and foreign descriptors before Storage list", async () => {
  const ownPath = directPath(0, "original");
  const foreignPath = directPathForUserAndToken(
    SECOND_USER_ID,
    TOKEN,
    1,
    "original",
  );
  const itemFiles = [
    { original: descriptor(ownPath) },
    { original: descriptor(foreignPath) },
  ];
  const supabase = new MockSupabase();
  addStoredObjects(supabase, itemFiles);
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles,
  });

  assertFailure(result, "invalid_upload");
  assert.equal(supabase.listCalls.length, 0);
});

test("direct verifier rejects legacy descriptors before Storage list", async () => {
  const supabase = new MockSupabase();
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles: [
      {
        original: descriptor(`pending/${TOKEN}/0-original.jpg`),
      },
    ],
  });

  assertFailure(result, "invalid_upload");
  assert.equal(supabase.listCalls.length, 0);
});

test("direct verifier rejects malformed UUID descriptors before Storage list", async () => {
  const supabase = new MockSupabase();
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles: [
      {
        original: descriptor(`pending/not-a-uuid/${TOKEN}/0-original.jpg`),
      },
    ],
  });

  assertFailure(result, "invalid_upload");
  assert.equal(supabase.listCalls.length, 0);
});

test("direct verifier isolates same-token objects from other users", async () => {
  const ownPath = directPath(0, "original");
  const foreignPath = directPathForUserAndToken(
    SECOND_USER_ID,
    TOKEN,
    0,
    "original",
  );
  const supabase = new MockSupabase();
  supabase.addObject(ownPath, metadata(1234, "image/jpeg"));
  supabase.addObject(foreignPath, metadata(9999, "image/png"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(ownPath) }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.data?.[0]?.original.size, 1234);
  assertListCalls(supabase, [directDirectory()]);
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
    ownerUserId: USER_ID,
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
  assertListCalls(supabase, [directDirectory()]);
});

test("direct verifier lists one directory for multiple same-token items", async () => {
  const itemFiles = itemFilesForDirectOrder(3);
  const supabase = new MockSupabase();
  addStoredObjects(supabase, itemFiles);
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles,
  });

  assert.equal(result.ok, true);
  assert.equal(result.data?.length, 3);
  assertListCalls(supabase, [directDirectory()]);
});

test("direct verifier lists each distinct pending-token directory once", async () => {
  const firstPath = directPath(0, "original");
  const secondPath = directPathForToken(SECOND_TOKEN, 1, "original");
  const itemFiles = [
    { original: descriptor(firstPath) },
    { original: descriptor(secondPath) },
  ];
  const supabase = new MockSupabase();
  addStoredObjects(supabase, itemFiles);
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles,
  });

  assert.equal(result.ok, true);
  assertListCalls(supabase, [
    directDirectory(),
    directDirectory(SECOND_TOKEN),
  ]);
});

test("direct verifier rejects a missing exact basename when similar objects exist", async () => {
  const requestedPath = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(`${requestedPath}.backup`, metadata(1234, "image/jpeg"));
  supabase.addObject(
    `${directDirectory()}/0-original.jpeg`,
    metadata(1234, "image/jpeg"),
  );
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(requestedPath) }],
  });

  assertFailure(result, "invalid_upload");
  assert.equal(result.status, 409);
  assertListCalls(supabase, [directDirectory()]);
});

test("direct verifier validates size and MIME from the exact directory object", async () => {
  const requestedPath = directPath(0, "original");
  const supabase = new MockSupabase();
  supabase.addObject(requestedPath, metadata(9999, "image/png"));
  supabase.addObject(`${requestedPath}.backup`, metadata(1234, "image/jpeg"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(requestedPath) }],
  });

  assertFailure(result, "invalid_upload");
  assert.equal(result.status, 400);
  assertListCalls(supabase, [directDirectory()]);
});

test("direct verifier returns storage_error when a directory list fails", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase({ listFailures: [directDirectory()] });
  supabase.addObject(path, metadata(1234, "image/jpeg"));
  const verifier = await loadVerifier();

  const result = await verifier.verifyDirectOrderUploads({
    supabase,
    ownerUserId: USER_ID,
    serviceType: "virtual-staging",
    itemFiles: [{ original: descriptor(path) }],
  });

  assertFailure(result, "storage_error");
  assert.equal(result.status, 500);
  assertListCalls(supabase, [directDirectory()]);
});

test("direct verifier rejects nonexistent pending objects", async () => {
  const verifier = await loadVerifier();
  const result = await verifier.verifyDirectOrderUploads({
    supabase: new MockSupabase(),
    ownerUserId: USER_ID,
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
    descriptor: descriptor(
      directPathForUserAndToken(
        USER_ID,
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        0,
        "original",
      ),
    ),
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
    ownerUserId: USER_ID,
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
    ownerUserId: USER_ID,
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
    ownerUserId: USER_ID,
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
    ownerUserId: USER_ID,
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
    ownerUserId: USER_ID,
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
    ownerUserId: USER_ID,
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
    ownerUserId: USER_ID,
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

test("atomic direct creation copies first, commits once, then removes pending source", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase();
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();
  const { createOrderIntentHash } = await loadOrderFingerprintModule();

  const tamperedAcceptedAt = "2000-01-01T00:00:00.000Z";
  const browserInput = orderInput({
    itemFiles,
    termsAcceptance: {
      accepted: true,
      version: TERMS_VERSION,
      acceptedAt: tamperedAcceptedAt,
    },
  });
  const beforeSubmit = Date.now();
  const result = await createProductionOrder(browserInput);
  const afterSubmit = Date.now();

  const claimCall = supabase.rpcCalls.find(
    (call) => call.name === "claim_order_submission",
  );
  const requestHash = (claimCall?.params as { p_request_hash: string })
    .p_request_hash;
  assert.equal(requestHash, createOrderIntentHash({
    ...browserInput,
    termsAcceptance: {
      accepted: true,
      version: TERMS_VERSION,
    },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.replayed, false);
  assert.equal(supabase.copies.length, 1);
  assert.equal(supabase.moves.length, 0);
  assert.equal(supabase.objects.has(directPath(0, "original")), false);
  assert.equal(supabase.objects.has(finalPath(0, "original")), true);
  assert.equal(supabase.rpcCalls.filter((call) => call.name === "commit_order_submission").length, 1);
  const commitCall = supabase.rpcCalls.find((call) => call.name === "commit_order_submission");
  const commitItems = (commitCall?.params as {
    p_items: Array<{
      subtotalCents: number;
      details: {
        terms_acceptance: {
          accepted: boolean;
          version: string;
          accepted_at: string;
        };
      };
    }>;
  }).p_items;
  assert.equal(commitItems[0].subtotalCents, result.ok ? result.pricingSnapshot.items[0].lineSubtotalCents : -1);
  const persistedTerms = commitItems[0].details.terms_acceptance;
  assert.equal(persistedTerms.accepted, true);
  assert.equal(persistedTerms.version, TERMS_VERSION);
  assert.notEqual(persistedTerms.accepted_at, tamperedAcceptedAt);
  assert.ok(Date.parse(persistedTerms.accepted_at) >= beforeSubmit);
  assert.ok(Date.parse(persistedTerms.accepted_at) <= afterSubmit);
  assert.equal(supabase.emailCalls.length, 1);
  assert.deepEqual(supabase.prefixReadCalls, [{
    path: directPath(0, "original"),
    range: "bytes=0-511",
    ifMatch: '"etag-1234-image/jpeg"',
  }]);
});

for (const [name, version] of [
  ["an arbitrary client Terms version", "attacker-controlled-version"],
  ["a stale client Terms version", "2025-01"],
  ["the unspecified Terms version", "unspecified"],
  ["a missing Terms version", undefined],
] as const) {
  test(`direct order rejects ${name} before claim, file finalization, commit, or email`, async () => {
    const supabase = new MockSupabase();
    installSupabaseMock(supabase);
    const { createProductionOrder } = await loadOrderModule();

    const result = await createProductionOrder(orderInput({
      termsAcceptance: { accepted: true, version },
    }));

    assertFailure(result, "client_upgrade_required");
    assert.equal(result.ok ? 0 : result.status, 409);
    assert.equal(
      result.ok ? "" : result.message,
      "The Terms have changed. Please review and accept the current Terms before submitting your order.",
    );
    assert.equal(supabase.rpcCalls.length, 0);
    assert.equal(supabase.copies.length, 0);
    assert.equal(supabase.moves.length, 0);
    assert.equal(supabase.removes.length, 0);
    assert.equal(supabase.emailCalls.length, 0);
  });
}

test("direct order still rejects unaccepted Terms before any side effect", async () => {
  const supabase = new MockSupabase();
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({
    termsAcceptance: { accepted: false, version: TERMS_VERSION },
  }));

  assertFailure(result, "invalid_input");
  assert.equal(result.ok ? 0 : result.status, 400);
  assert.equal(supabase.rpcCalls.length, 0);
  assert.equal(supabase.copies.length, 0);
  assert.equal(supabase.moves.length, 0);
  assert.equal(supabase.removes.length, 0);
  assert.equal(supabase.emailCalls.length, 0);
});

for (const [name, extension, mimeType, bytes] of [
  ["HTML disguised as JPEG", "jpg", "image/jpeg", new TextEncoder().encode("<html><script>alert(1)</script>")],
  ["PNG bytes declared JPEG", "jpg", "image/jpeg", defaultSignatureForMime("image/png")],
  ["JPEG bytes declared PNG", "png", "image/png", defaultSignatureForMime("image/jpeg")],
  ["unsupported random bytes", "jpg", "image/jpeg", Uint8Array.of(0x01, 0x02, 0x03, 0x04)],
] as const) {
  test(`direct order rejects ${name} before copying or atomic commit`, async () => {
    const path = directPath(0, "original", extension);
    const original = descriptor(path, { mimeType });
    const supabase = new MockSupabase();
    supabase.addObject(path, metadata(original.size, mimeType), bytes);
    installSupabaseMock(supabase);
    const { createProductionOrder } = await loadOrderModule();

    const result = await createProductionOrder(orderInput({ itemFiles: [{ original }] }));

    assertFailure(result, "invalid_upload");
    assert.equal(result.ok ? 0 : result.status, 400);
    assert.equal(supabase.copies.length, 0);
    assert.equal(supabase.objects.has(path), true);
    assert.equal(supabase.removes.length, 0);
    assert.equal(
      supabase.rpcCalls.some((call) => call.name === "commit_order_submission"),
      false,
    );
    assert.equal(
      supabase.rpcCalls.some((call) => call.name === "release_order_submission"),
      true,
    );
  });
}

for (const [name, option] of [
  ["signed prefix URL cannot be created", "signedReadFailures"],
  ["Storage prefix read fails", "prefixReadFailures"],
  ["Range response is malformed", "malformedRangeResponses"],
] as const) {
  test(`direct order fails closed when ${name}`, async () => {
    const path = directPath(0, "original");
    const supabase = new MockSupabase({ [option]: [path] });
    addStoredObjects(supabase, itemFilesForDirectOrder());
    installSupabaseMock(supabase);
    const { createProductionOrder } = await loadOrderModule();

    const result = await createProductionOrder(orderInput());

    assertFailure(result, "storage_error");
    assert.equal(result.ok ? 0 : result.status, 500);
    assert.equal(supabase.objects.has(path), true);
    assert.equal(supabase.copies.length, 0);
    assert.equal(
      supabase.rpcCalls.some((call) => call.name === "commit_order_submission"),
      false,
    );
  });
}

test("direct order verifies every multi-reference file, including allowed PDFs", async () => {
  const referencePath =
    `pending/${USER_ID}/${TOKEN}/0-reference-0-${REFERENCE_ID}.pdf`;
  const itemFiles: ItemFilesForTest[] = [{
    original: descriptor(directPath(0, "original")),
    references: [{
      ...descriptor(referencePath, {
        originalFilename: "notes.pdf",
        mimeType: "application/pdf",
      }),
      referenceId: REFERENCE_ID,
      position: 0,
    }],
  }];
  const supabase = new MockSupabase();
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assert.equal(result.ok, true);
  assert.deepEqual(
    supabase.prefixReadCalls.map((call) => call.path).sort(),
    [directPath(0, "original"), referencePath].sort(),
  );
  assert.equal(supabase.copies.length, 2);
});

test("invalid multi-reference bytes prevent the complete order commit", async () => {
  const referencePath =
    `pending/${USER_ID}/${TOKEN}/0-reference-0-${REFERENCE_ID}.pdf`;
  const itemFiles: ItemFilesForTest[] = [{
    original: descriptor(directPath(0, "original")),
    references: [{
      ...descriptor(referencePath, {
        originalFilename: "notes.pdf",
        mimeType: "application/pdf",
      }),
      referenceId: REFERENCE_ID,
      position: 0,
    }],
  }];
  const supabase = new MockSupabase();
  addStoredObjects(supabase, itemFiles);
  supabase.addObject(
    referencePath,
    metadata(1234, "application/pdf"),
    new TextEncoder().encode("%PDF-not-a-version"),
  );
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "invalid_upload");
  assert.equal(supabase.copies.length, 0);
  assert.equal(
    supabase.rpcCalls.some((call) => call.name === "commit_order_submission"),
    false,
  );
});

test("an object replaced after signature verification cannot reach copy or commit", async () => {
  const path = directPath(0, "original");
  const supabase = new MockSupabase({
    mutateOnInfoCall: {
      path,
      callNumber: 3,
      metadata: metadata(1234, "image/jpeg", '"replaced-after-verification"'),
    },
  });
  addStoredObjects(supabase, itemFilesForDirectOrder());
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput());

  assertFailure(result, "storage_error");
  assert.equal(supabase.copies.length, 0);
  assert.equal(
    supabase.rpcCalls.some((call) => call.name === "commit_order_submission"),
    false,
  );
});

test("draft finalization re-verifies source bytes instead of trusting uploaded draft state", async () => {
  const draftId = "88888888-8888-4888-8888-888888888888";
  const sourcePath = `drafts/${USER_ID}/${draftId}/${REFERENCE_ID}/room.jpg`;
  const original = descriptor(sourcePath, {
    originalFilename: "room.jpg",
    draftFileId: REFERENCE_ID,
  });
  const supabase = new MockSupabase();
  supabase.addObject(
    sourcePath,
    metadata(original.size, original.mimeType),
    new TextEncoder().encode("<html>replaced after draft completion</html>"),
  );
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({
    sourceDraftId: draftId,
    storageMode: "copy",
    itemFiles: [{ original }],
  }));

  assertFailure(result, "invalid_upload");
  assert.equal(supabase.copies.length, 0);
  assert.equal(
    supabase.rpcCalls.some((call) => call.name === "commit_order_submission"),
    false,
  );
});

test("exact committed replay returns original result without Storage or email work", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase({ claimCode: "committed" });
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.replayed, true);
  assert.equal(supabase.listCalls.length, 0);
  assert.equal(supabase.copies.length, 0);
  assert.equal(supabase.emailCalls.length, 0);
});

for (const [claimCode, expectedCode] of [
  ["in_progress", "in_progress"],
  ["payload_conflict", "payload_conflict"],
  ["pricing_changed", "pricing_changed"],
] as const) {
  test(`${claimCode} claim fails safely before Storage finalization`, async () => {
    const supabase = new MockSupabase({ claimCode });
    installSupabaseMock(supabase);
    const { createProductionOrder } = await loadOrderModule();
    const result = await createProductionOrder(orderInput());
    assertFailure(result, expectedCode);
    assert.equal(result.ok ? 0 : result.status, 409);
    assert.equal(supabase.listCalls.length, 0);
    assert.equal(supabase.emailCalls.length, 0);
  });
}

test("an unauthorized submission replay is ownership-safe and does no Storage work", async () => {
  const supabase = new MockSupabase({ claimCode: "not_found" });
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();
  const result = await createProductionOrder(orderInput());
  assertFailure(result, "not_found");
  assert.equal(result.ok ? 0 : result.status, 404);
  assert.equal(supabase.listCalls.length, 0);
  assert.equal(supabase.emailCalls.length, 0);
});

test("response loss after atomic commit recovers the committed result and preserves final files", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase({ commitError: true, recoveryCommitted: true });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.replayed, true);
  assert.equal(supabase.objects.has(finalPath(0, "original")), true);
  assert.equal(supabase.objects.has(directPath(0, "original")), false);
  assert.equal(supabase.emailCalls.length, 0);
});

test("ambiguous commit without recovery does not delete pending or prepared final files", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase({ commitError: true });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "database_error");
  assert.equal(supabase.objects.has(directPath(0, "original")), true);
  assert.equal(supabase.objects.has(finalPath(0, "original")), true);
  assert.equal(supabase.removes.length, 0);
});

test("known Storage copy failure keeps pending source and releases the claim", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const sourcePath = directPath(0, "original");
  const destination = finalPath(0, "original");
  const supabase = new MockSupabase({ copyFailures: [moveKey(sourcePath, destination)] });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "storage_error");
  assert.equal(supabase.objects.has(sourcePath), true);
  assert.equal(supabase.rpcCalls.some((call) => call.name === "release_order_submission"), true);
});

test("retry reuses an existing deterministic final object only after exact Storage ETag verification", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const sourcePath = directPath(0, "original");
  const destination = finalPath(0, "original");
  const supabase = new MockSupabase({ copyFailures: [moveKey(sourcePath, destination)] });
  addStoredObjects(supabase, itemFiles);
  supabase.addObject(destination, metadata(1234, "image/jpeg"));
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assert.equal(result.ok, true);
  assert.equal(supabase.objects.has(destination), true);
  assert.equal(supabase.objects.has(sourcePath), false);
  assert.equal(supabase.removes.some((paths) => paths.includes(destination)), false);
});

test("retry fails closed when Storage does not provide an object ETag", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const sourcePath = directPath(0, "original");
  const destination = finalPath(0, "original");
  const supabase = new MockSupabase({ copyFailures: [moveKey(sourcePath, destination)] });
  addStoredObjects(supabase, itemFiles);
  supabase.addObject(sourcePath, { size: 1234, mimetype: "image/jpeg" });
  supabase.addObject(destination, metadata(1234, "image/jpeg"));
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "storage_error");
  assert.equal(supabase.objects.has(sourcePath), true);
  assert.equal(supabase.objects.has(destination), true);
  assert.equal(supabase.copies.length, 0);
  assert.equal(supabase.removes.length, 0);
});

test("retry rejects the same size and MIME when the Storage ETag identity differs", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const sourcePath = directPath(0, "original");
  const destination = finalPath(0, "original");
  const supabase = new MockSupabase({ copyFailures: [moveKey(sourcePath, destination)] });
  addStoredObjects(supabase, itemFiles);
  supabase.addObject(
    destination,
    metadata(1234, "image/jpeg", '"different-object-etag"'),
  );
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "storage_error");
  assert.equal(supabase.objects.has(sourcePath), true);
  assert.equal(supabase.objects.has(destination), true);
  assert.equal(supabase.removes.some((paths) => paths.includes(destination)), false);
});

test("retry rejects a deterministic final object whose metadata does not match", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const sourcePath = directPath(0, "original");
  const destination = finalPath(0, "original");
  const supabase = new MockSupabase({ copyFailures: [moveKey(sourcePath, destination)] });
  addStoredObjects(supabase, itemFiles);
  supabase.addObject(destination, metadata(9999, "image/png"));
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "storage_error");
  assert.equal(supabase.objects.has(sourcePath), true);
  assert.equal(supabase.objects.has(destination), true);
  assert.equal(supabase.removes.some((paths) => paths.includes(destination)), false);
});

test("known atomic commit rejection cleans only finals created by this attempt", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase({ commitCode: "draft_conflict" });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assertFailure(result, "draft_conflict");
  assert.equal(supabase.objects.has(directPath(0, "original")), true);
  assert.equal(supabase.objects.has(finalPath(0, "original")), false);
});

test("email dispatch failure cannot roll back an atomically committed order", async () => {
  const itemFiles = itemFilesForDirectOrder();
  const supabase = new MockSupabase({
    emailResult: { claimed: 2, sent: 0, failed: 2, unknown: 0 },
  });
  addStoredObjects(supabase, itemFiles);
  installSupabaseMock(supabase);
  const { createProductionOrder } = await loadOrderModule();

  const result = await createProductionOrder(orderInput({ itemFiles }));

  assert.equal(result.ok, true);
  assert.equal(supabase.objects.has(finalPath(0, "original")), true);
  assert.equal(supabase.rpcCalls.filter((call) => call.name === "commit_order_submission").length, 1);
});
