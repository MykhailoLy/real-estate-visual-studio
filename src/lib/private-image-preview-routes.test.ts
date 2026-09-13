import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

const userId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";
const referenceId = "44444444-4444-4444-8444-444444444444";
const deliverableId = "55555555-5555-4555-8555-555555555555";
const replacementId = "66666666-6666-4666-8666-666666666666";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://preview-tests.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

interface SignedCall {
  bucket: string;
  path: string;
  options: unknown;
}

interface RouteFixture {
  owner: "owned" | "wrong";
  previewAvailability: "exists" | "missing-original";
  signedCalls: SignedCall[];
  selections: string[];
}

const fixture: RouteFixture = {
  owner: "owned",
  previewAvailability: "exists",
  signedCalls: [],
  selections: [],
};

const sourceItem = {
  id: itemId,
  item_index: 0,
  original_photo_path: "PS-0042/0-original.jpg",
  reference_image_path: "PS-0042/0-reference.png",
  details: {
    uploaded_files: {
      original: {
        original_filename: "living-room.jpg",
        size_bytes: 1024,
        mime_type: "image/jpeg",
      },
      reference: {
        original_filename: "style-reference.png",
        size_bytes: 512,
        mime_type: "image/png",
      },
    },
  },
};

const deliverables = new Map([
  [
    deliverableId,
    {
      storage_path: "PS-0042/1700000000000-delivered.jpg",
      filename: "delivered.jpg",
      file_size: 2048,
      mime_type: "image/jpeg",
    },
  ],
  [
    replacementId,
    {
      storage_path: "PS-0042/1700000001000-replacement.jpg",
      filename: "replacement.jpg",
      file_size: 3072,
      mime_type: "image/jpeg",
    },
  ],
]);

class Query {
  private readonly filters = new Map<string, unknown>();
  private readonly table: string;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string) {
    if (this.table === "order_deliverables") fixture.selections.push(columns);
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  async maybeSingle() {
    if (this.table === "orders") {
      return {
        data: {
          id: orderId,
          user_id: fixture.owner === "owned" ? userId : "other-user",
          client_email: "client@example.com",
        },
        error: null,
      };
    }
    if (this.table === "order_items") {
      return { data: sourceItem, error: null };
    }
    if (this.table === "order_item_reference_files") {
      return {
        data: {
          storage_path: "PS-0042/0-reference-0-normalized.png",
          original_filename: "normalized-reference.png",
          file_size: 768,
          mime_type: "image/png",
        },
        error: null,
      };
    }
    if (this.table === "order_deliverables") {
      const row = deliverables.get(String(this.filters.get("id")));
      return {
        data: row
          ? {
              ...row,
              orders: {
                user_id: fixture.owner === "owned" ? userId : "other-user",
                client_email: "client@example.com",
              },
            }
          : null,
        error: null,
      };
    }
    return { data: null, error: new Error("Unexpected table") };
  }
}

const fakeClient = {
  from: (table: string) => new Query(table),
  storage: {
    from: (bucket: string) => ({
      exists: async () => ({
        data: fixture.previewAvailability === "exists",
        error: null,
      }),
      info: async () => ({ data: null, error: new Error("original unavailable") }),
      download: async () => ({ data: null, error: new Error("unexpected download") }),
      upload: async () => ({ data: null, error: new Error("unexpected upload") }),
      createSignedUrl: async (path: string, _ttl: number, options?: unknown) => {
        fixture.signedCalls.push({ bucket, path, options });
        return { data: { signedUrl: `https://signed.test/${path}` }, error: null };
      },
    }),
  },
};

Object.assign(globalThis, { __privatePreviewRouteFixtureClient: fakeClient });

const mockModule = (source: string) => ({
  url: `data:text/javascript,${encodeURIComponent(source)}`,
  shortCircuit: true,
});

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return mockModule("export default undefined;");
    if (specifier === "next/server") {
      return mockModule(
        "export const NextResponse = { json: (body, init) => Response.json(body, init) };",
      );
    }
    if (specifier === "@supabase/supabase-js") {
      return mockModule(
        "export const createClient = () => globalThis.__privatePreviewRouteFixtureClient;",
      );
    }
    if (specifier === "@/lib/client-auth") {
      return mockModule(
        `export const getClientUser = async () => ({ id: "${userId}", email: "client@example.com" });`,
      );
    }
    if (specifier === "@/lib/supabase") {
      return mockModule(
        "export const createServerClient = () => globalThis.__privatePreviewRouteFixtureClient;",
      );
    }
    if (specifier.startsWith("@/")) {
      return {
        url: new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { getPrivateImagePreviewPath } = await import("./private-image-preview-path.ts");
const { POST: sourcePost } = await import(
  "../app/api/client/orders/[orderId]/source-files/[fileId]/download-url/route.ts"
);
const { POST: deliverablePost } = await import(
  "../app/api/client/deliverables/[deliverableId]/download-url/route.ts"
);

function resetFixture(): void {
  fixture.owner = "owned";
  fixture.previewAvailability = "exists";
  fixture.signedCalls.length = 0;
  fixture.selections.length = 0;
}

function postRequest(intent: "preview" | "download", url = "https://picchuspot.com/api/test") {
  const request = new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent }),
  });
  Object.defineProperty(request, "nextUrl", { value: new URL(url) });
  return request;
}

test("source preview signs the derivative while download signs the original attachment", async () => {
  resetFixture();
  const previewResponse = await sourcePost(
    postRequest("preview") as never,
    { params: Promise.resolve({ orderId, fileId: `${itemId}-original` }) },
  );
  assert.equal(previewResponse.status, 200);
  assert.equal(
    fixture.signedCalls[0]?.path,
    getPrivateImagePreviewPath(sourceItem.original_photo_path),
  );
  assert.equal(fixture.signedCalls[0]?.path.includes(sourceItem.original_photo_path), false);
  assert.equal(fixture.signedCalls[0]?.path.includes("0-original.jpg"), false);
  assert.equal(fixture.signedCalls[0]?.options, undefined);

  fixture.signedCalls.length = 0;
  const downloadResponse = await sourcePost(
    postRequest("download") as never,
    { params: Promise.resolve({ orderId, fileId: `${itemId}-original` }) },
  );
  assert.equal(downloadResponse.status, 200);
  assert.deepEqual(fixture.signedCalls[0], {
    bucket: "order-files",
    path: sourceItem.original_photo_path,
    options: { download: "living-room.jpg" },
  });
});

test("source preview failure falls back to the original non-download URL", async () => {
  resetFixture();
  fixture.previewAvailability = "missing-original";
  const response = await sourcePost(
    postRequest("preview") as never,
    { params: Promise.resolve({ orderId, fileId: `${itemId}-original` }) },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.signedCalls[0], {
    bucket: "order-files",
    path: sourceItem.original_photo_path,
    options: undefined,
  });
});

test("source ownership, normalized references, and legacy slots remain supported", async () => {
  resetFixture();
  fixture.owner = "wrong";
  const wrongOwner = await sourcePost(
    postRequest("preview") as never,
    { params: Promise.resolve({ orderId, fileId: `${itemId}-original` }) },
  );
  assert.equal(wrongOwner.status, 404);
  assert.equal(fixture.signedCalls.length, 0);

  resetFixture();
  const normalized = await sourcePost(
    postRequest("preview") as never,
    { params: Promise.resolve({ orderId, fileId: `${itemId}-reference-${referenceId}` }) },
  );
  assert.equal(normalized.status, 200);
  assert.equal(
    fixture.signedCalls[0]?.path,
    getPrivateImagePreviewPath("PS-0042/0-reference-0-normalized.png"),
  );

  resetFixture();
  const legacy = await sourcePost(
    postRequest("preview") as never,
    { params: Promise.resolve({ orderId, fileId: `${itemId}-reference` }) },
  );
  assert.equal(legacy.status, 200);
  assert.equal(
    fixture.signedCalls[0]?.path,
    getPrivateImagePreviewPath(sourceItem.reference_image_path),
  );
});

test("deliverable preview uses its derivative and download remains the original", async () => {
  resetFixture();
  const previewResponse = await deliverablePost(
    postRequest("preview") as never,
    { params: Promise.resolve({ deliverableId }) },
  );
  assert.equal(previewResponse.status, 200);
  const previewJson = await previewResponse.json() as Record<string, unknown>;
  assert.equal("storage_path" in previewJson, false);
  assert.equal(
    fixture.signedCalls[0]?.path,
    getPrivateImagePreviewPath(deliverables.get(deliverableId)!.storage_path),
  );
  assert.ok(fixture.selections.some((selection) => selection.includes("file_size, mime_type")));

  fixture.signedCalls.length = 0;
  const downloadResponse = await deliverablePost(
    postRequest("download") as never,
    { params: Promise.resolve({ deliverableId }) },
  );
  assert.equal(downloadResponse.status, 200);
  assert.deepEqual(fixture.signedCalls[0], {
    bucket: "deliverables",
    path: deliverables.get(deliverableId)!.storage_path,
    options: { download: "delivered.jpg" },
  });
});

test("replacement deliverables derive distinct previews and wrong owners still receive 404", async () => {
  resetFixture();
  for (const id of [deliverableId, replacementId]) {
    const response = await deliverablePost(
      postRequest("preview") as never,
      { params: Promise.resolve({ deliverableId: id }) },
    );
    assert.equal(response.status, 200);
  }
  assert.notEqual(fixture.signedCalls[0]?.path, fixture.signedCalls[1]?.path);

  resetFixture();
  fixture.owner = "wrong";
  const wrongOwner = await deliverablePost(
    postRequest("preview") as never,
    { params: Promise.resolve({ deliverableId }) },
  );
  assert.equal(wrongOwner.status, 404);
  assert.equal(fixture.signedCalls.length, 0);
});

test("viewer navigation and bulk ZIP stay on their existing contracts", () => {
  const filePreview = readFileSync("src/components/FilePreviewCard.tsx", "utf8");
  const bulkZip = readFileSync(
    "src/app/api/client/orders/[orderId]/deliverables/bulk-download/route.ts",
    "utf8",
  );
  const cleanupRoute = readFileSync(
    "src/app/(public)/api/admin/orders/[orderId]/deliverables/route.ts",
    "utf8",
  );
  const pathHelper = readFileSync("src/lib/private-image-preview-path.ts", "utf8");

  assert.match(filePreview, /requestSignedUrl\(adjacentItem\.signedUrlEndpoint, "preview"\)/);
  assert.match(filePreview, /requestSignedUrl\(signedUrlEndpoint, "download"\)/);
  assert.match(filePreview, /presentation === "feature" \? "contain" : "cover"/);
  assert.doesNotMatch(bulkZip, /private-image-preview|_previews/);
  assert.match(cleanupRoute, /\[existingRow\.storage_path, previewPath\]/);
  assert.match(
    cleanupRoute,
    /from "@\/lib\/private-image-preview-path"/,
  );
  assert.doesNotMatch(
    cleanupRoute,
    /from "@\/lib\/private-image-preview";/,
  );
  assert.match(pathHelper, /from "node:crypto"/);
  assert.doesNotMatch(pathHelper, /sharp/i);
});
