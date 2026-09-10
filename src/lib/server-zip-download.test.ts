import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { unzipSync } from "fflate";
import type { NextRequest } from "next/server";

type Row = Record<string, unknown>;

const orderId = "11111111-1111-4111-8111-111111111111";
const staleDeliverableId = "22222222-2222-4222-8222-222222222222";
const replacementDeliverableId = "33333333-3333-4333-8333-333333333333";

const deliverables: Row[] = [
  {
    id: replacementDeliverableId,
    order_id: orderId,
    order_number: "PS-0042",
    item_index: 0,
    filename: "living-room.jpg",
    file_size: 1,
    mime_type: "image/jpeg",
    uploaded_at: "2026-09-10T12:07:00.000Z",
    storage_path: "PS-0042/private-uuid/replacement.jpg",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    order_id: orderId,
    order_number: "PS-0042",
    item_index: 1,
    filename: "living-room.jpg",
    file_size: 1,
    mime_type: "image/jpeg",
    uploaded_at: "2026-09-10T12:06:00.000Z",
    storage_path: "PS-0042/private-uuid/second.jpg",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    order_id: orderId,
    order_number: "PS-0042",
    item_index: 1,
    filename: "bedroom.png",
    file_size: 1,
    mime_type: "image/png",
    uploaded_at: "2026-09-10T12:05:00.000Z",
    storage_path: "PS-0042/private-uuid/multi-output.png",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    order_id: orderId,
    order_number: "PS-0042",
    item_index: 2,
    filename: "kitchen.webp",
    file_size: 1,
    mime_type: "image/webp",
    uploaded_at: "2026-09-10T12:04:00.000Z",
    storage_path: "PS-0042/private-uuid/kitchen.webp",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    order_id: orderId,
    order_number: "PS-0042",
    item_index: null,
    filename: "exterior.tif",
    file_size: 1,
    mime_type: "image/tiff",
    uploaded_at: "2026-09-10T12:03:00.000Z",
    storage_path: "PS-0042/private-uuid/exterior.tif",
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    order_id: orderId,
    order_number: "PS-0042",
    item_index: 3,
    filename: "floor-plan.pdf",
    file_size: 1,
    mime_type: "application/pdf",
    uploaded_at: "2026-09-10T12:02:00.000Z",
    storage_path: "PS-0042/private-uuid/floor-plan.pdf",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    order_id: orderId,
    order_number: "PS-0042",
    item_index: 4,
    filename: null,
    file_size: 1,
    mime_type: "application/octet-stream",
    uploaded_at: "2026-09-10T12:01:00.000Z",
    storage_path: "PS-0042/private-secret-uuid/internal-name.jpg",
  },
  {
    id: staleDeliverableId,
    order_id: orderId,
    order_number: "PS-0042",
    item_index: 0,
    filename: "stale-original.jpg",
    file_size: 1,
    mime_type: "image/jpeg",
    uploaded_at: "2026-09-10T12:00:00.000Z",
    storage_path: "PS-0042/private-uuid/stale-original.jpg",
  },
];

const reviews: Row[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    deliverable_id: staleDeliverableId,
    order_id: orderId,
    order_number: "PS-0042",
    item_index: 0,
    client_email: "client@example.com",
    status: "rework_delivered",
    comment: null,
    created_at: "2026-09-10T12:08:00.000Z",
    updated_at: "2026-09-10T12:08:00.000Z",
    replacement_deliverable_id: replacementDeliverableId,
  },
];

const downloadedPaths: string[] = [];

class Query {
  private readonly table: string;

  constructor(table: string) {
    this.table = table;
  }

  select() {
    return this;
  }

  eq() {
    return this;
  }

  order() {
    return Promise.resolve({
      data: this.table === "order_deliverables" ? deliverables : reviews,
      error: null,
    });
  }

  maybeSingle() {
    return Promise.resolve({
      data: {
        id: orderId,
        order_number: "PS-0042",
        user_id: "user-1",
        client_email: "client@example.com",
      },
      error: null,
    });
  }
}

const fixture = {
  supabase: {
    from: (table: string) => new Query(table),
    storage: {
      from: () => ({
        download: async (storagePath: string) => {
          downloadedPaths.push(storagePath);
          return { data: new Blob([new Uint8Array([1])]), error: null };
        },
      }),
    },
  },
};

Object.assign(globalThis, { __deliveredZipFixture: fixture });

const mockModule = (source: string) => ({
  url: `data:text/javascript,${encodeURIComponent(source)}`,
  shortCircuit: true,
});

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return mockModule("export default undefined;");
    if (specifier === "next/server") {
      return mockModule(
        "export const NextResponse = { json: Response.json.bind(Response) };"
      );
    }
    if (specifier === "@/lib/client-auth") {
      return mockModule(`export const getClientUser = async () => ({
        id: "user-1",
        email: "client@example.com"
      });`);
    }
    if (specifier === "@/lib/supabase") {
      return mockModule(
        "export const createServerClient = () => globalThis.__deliveredZipFixture.supabase;"
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

const { POST } = await import(
  "../app/api/client/orders/[orderId]/deliverables/bulk-download/route.ts"
);
const { safeZipFilename, uniqueZipPath } = await import("./server-zip-download.ts");

test("ZIP filenames neutralize dangerous paths and resolve case-insensitive collisions", () => {
  const usedPaths = new Set<string>();

  assert.equal(uniqueZipPath(safeZipFilename("../photo.JPG"), usedPaths), "..-photo.JPG");
  assert.equal(uniqueZipPath(safeZipFilename("..\\photo.jpg"), usedPaths), "..-photo-2.jpg");
  assert.equal(safeZipFilename("C:\\private\\photo.jpg"), "C--private-photo.jpg");
  assert.equal(safeZipFilename(undefined), "file");
});

test("client delivered ZIP keeps every current file at the archive root", async () => {
  downloadedPaths.length = 0;

  const response = await POST(
    new Request("https://picchuspot.com/api/test", { method: "POST" }) as NextRequest,
    { params: Promise.resolve({ orderId }) }
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/zip");

  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const entries = Object.keys(archive).sort();

  assert.deepEqual(entries, [
    "bedroom.png",
    "exterior.tif",
    "file",
    "floor-plan.pdf",
    "kitchen.webp",
    "living-room-2.jpg",
    "living-room.jpg",
  ]);
  assert.equal(entries.length, 7);
  assert.ok(entries.every((entry) => !entry.includes("/")));
  assert.ok(entries.every((entry) => !/^Image-\d+/i.test(entry)));
  assert.ok(entries.includes("living-room-2.jpg"));
  assert.ok(entries.includes("bedroom.png"));
  assert.ok(entries.includes("floor-plan.pdf"));
  assert.ok(entries.includes("file"));
  assert.ok(entries.every((entry) => !entry.includes("private-secret-uuid")));
  assert.ok(entries.every((entry) => !entry.includes("stale-original")));
  assert.equal(downloadedPaths.length, 7);
  assert.ok(downloadedPaths.every((path) => !path.includes("stale-original")));
});
