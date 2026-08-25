import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test, { after } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

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
    return nextResolve(specifier, context);
  },
});

const {
  FILE_SIGNATURE_PREFIX_BYTES,
  matchesExpectedFileSignature,
  verifyOrderFileSignatures,
  verifyStoredUploadContent,
} = await import("./file-signature.ts");

const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
});

const encoder = new TextEncoder();
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0);
const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = encoder.encode("RIFF\u0018\u0000\u0000\u0000WEBPVP8 ");
const BINARY_DXF = encoder.encode("AutoCAD Binary DXF\r\n\u001a\u0000");
const BINARY_FBX = encoder.encode("Kaydara FBX Binary  \u0000\u001a\u0000");
const ASCII_FBX = encoder.encode(
  "; FBX 7.4.0 project file\n; Copyright Autodesk\nFBXHeaderExtension: {\n",
);
const PATH = "pending/11111111-1111-4111-8111-111111111111/token/room.jpg";

interface MockStoredObject {
  path: string;
  bytes: Uint8Array;
  size: number;
  mimeType: string;
  etag: string;
}

interface MockStorageOptions {
  missing?: boolean;
  missingEtag?: boolean;
  signedReadFailure?: boolean;
  fetchFailure?: boolean;
  responseStatus?: number;
  contentRange?: string;
  contentLength?: string;
  responseEtag?: string;
  truncateBody?: boolean;
  changeEtagAfterRead?: boolean;
}

class MockStorage {
  readonly object: MockStoredObject;
  readonly options: MockStorageOptions;
  readonly signedPaths: string[] = [];
  readonly requests: Array<{ range: string | null; ifMatch: string | null }> = [];
  infoCalls = 0;

  constructor(
    object: MockStoredObject,
    options: MockStorageOptions = {},
  ) {
    this.object = object;
    this.options = options;
  }

  readonly storage = {
    from: () => ({
      info: async () => {
        this.infoCalls += 1;
        if (this.options.missing) {
          return { data: null, error: { name: "NotFound" } };
        }

        const etag = this.options.changeEtagAfterRead && this.infoCalls > 1
          ? '"replaced-object"'
          : this.object.etag;
        return {
          data: {
            size: this.object.size,
            contentType: this.object.mimeType,
            etag: this.options.missingEtag ? undefined : etag,
          },
          error: null,
        };
      },
      createSignedUrl: async (path: string) => {
        this.signedPaths.push(path);
        return this.options.signedReadFailure
          ? { data: null, error: { name: "SignedReadFailed" } }
          : {
              data: { signedUrl: `https://storage.example/${encodeURIComponent(path)}` },
              error: null,
            };
      },
    }),
  };

  installFetch(): void {
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const requestHeaders = new Headers(init?.headers);
      this.requests.push({
        range: requestHeaders.get("range"),
        ifMatch: requestHeaders.get("if-match"),
      });

      if (this.options.fetchFailure) throw new Error("Storage unavailable");
      if (this.options.responseStatus && this.options.responseStatus !== 206) {
        return new Response("Storage unavailable", {
          status: this.options.responseStatus,
        });
      }

      const expectedLength = Math.min(FILE_SIGNATURE_PREFIX_BYTES, this.object.size);
      const bytes = new Uint8Array(expectedLength);
      bytes.set(this.object.bytes.subarray(0, expectedLength));
      const body = this.options.truncateBody
        ? bytes.subarray(0, Math.max(0, bytes.length - 1))
        : bytes;
      const headers: Record<string, string> = {
        "content-range": this.options.contentRange ??
          `bytes 0-${expectedLength - 1}/${this.object.size}`,
        etag: this.options.responseEtag ?? this.object.etag,
      };
      if (this.options.contentLength !== undefined) {
        headers["content-length"] = this.options.contentLength;
      }
      return new Response(body, { status: 206, headers });
    };
  }

  get supabase(): SupabaseClient {
    return this as unknown as SupabaseClient;
  }
}

function storedObject(overrides: Partial<MockStoredObject> = {}): MockStoredObject {
  return {
    path: PATH,
    bytes: JPEG,
    size: 1_234,
    mimeType: "image/jpeg",
    etag: '"verified-object"',
    ...overrides,
  };
}

function descriptor(object: MockStoredObject) {
  return {
    path: object.path,
    originalFilename: object.path.split("/").pop() ?? "room.jpg",
    size: object.size,
    mimeType: object.mimeType,
  };
}

for (const [name, bytes, mimeType, extension] of [
  ["JPEG .jpg", JPEG, "image/jpeg", "jpg"],
  ["JPEG .jpeg", JPEG, "image/jpeg", "jpeg"],
  ["PNG", PNG, "image/png", "png"],
  ["WebP VP8", WEBP, "image/webp", "webp"],
  ["WebP VP8L", encoder.encode("RIFF\u0018\u0000\u0000\u0000WEBPVP8L"), "image/webp", "webp"],
  ["WebP VP8X", encoder.encode("RIFF\u0018\u0000\u0000\u0000WEBPVP8X"), "image/webp", "webp"],
  ["GIF87a", encoder.encode("GIF87a"), "image/gif", "gif"],
  ["GIF89a", encoder.encode("GIF89a"), "image/gif", "gif"],
  ["PDF 1.0", encoder.encode("%PDF-1.0\r\n"), "application/pdf", "pdf"],
  ["PDF 1.7", encoder.encode("%PDF-1.7\n"), "application/pdf", "pdf"],
  ["PDF 2.0", encoder.encode("%PDF-2.0\n"), "application/pdf", "pdf"],
  ["DWG version header", encoder.encode("AC1032"), "application/octet-stream", "dwg"],
  ["binary DXF", BINARY_DXF, "application/octet-stream", "dxf"],
  ["ASCII DXF", encoder.encode("  0\r\nSECTION\r\n  2\r\nHEADER\r\n"), "application/octet-stream", "dxf"],
  ["UTF-8 BOM ASCII DXF", Uint8Array.of(0xef, 0xbb, 0xbf, ...encoder.encode("0\nSECTION\n2\nENTITIES\n")), "application/octet-stream", "dxf"],
  ["binary FBX", BINARY_FBX, "application/octet-stream", "fbx"],
  ["ASCII FBX", ASCII_FBX, "application/octet-stream", "fbx"],
] as const) {
  test(`accepts the authoritative ${name} signature`, () => {
    assert.equal(matchesExpectedFileSignature(bytes, mimeType, extension), true);
  });
}

for (const [name, bytes, mimeType, extension] of [
  ["HTML disguised as JPEG", encoder.encode("<html>spoofed</html>"), "image/jpeg", "jpg"],
  ["PNG declared JPEG", PNG, "image/jpeg", "jpg"],
  ["JPEG declared PNG", JPEG, "image/png", "png"],
  ["random bytes", Uint8Array.of(0x01, 0x02, 0x03), "image/jpeg", "jpg"],
  ["zero-byte header", new Uint8Array(), "image/jpeg", "jpg"],
  ["truncated JPEG", Uint8Array.of(0xff, 0xd8), "image/jpeg", "jpg"],
  ["truncated PNG", PNG.subarray(0, 7), "image/png", "png"],
  ["RIFF without WEBP", encoder.encode("RIFF\u0018\u0000\u0000\u0000AVI VP8 "), "image/webp", "webp"],
  ["WEBP without valid image chunk", encoder.encode("RIFF\u0018\u0000\u0000\u0000WEBPFAKE"), "image/webp", "webp"],
  ["PDF without a version", encoder.encode("%PDF-fake"), "application/pdf", "pdf"],
  ["PDF with unsupported version", encoder.encode("%PDF-9.9\n"), "application/pdf", "pdf"],
  ["PDF with malformed suffix", encoder.encode("%PDF-1.7evil"), "application/pdf", "pdf"],
  ["DWG with truncated version", encoder.encode("AC10"), "application/octet-stream", "dwg"],
  ["DXF without section group", encoder.encode("0\nSECTION\n<html>"), "application/octet-stream", "dxf"],
  ["FBX comment without structural header", encoder.encode("; FBX\n<html>"), "application/octet-stream", "fbx"],
  ["generic octet-stream", JPEG, "application/octet-stream", "jpg"],
  ["new unapproved CAD MIME", BINARY_DXF, "application/dxf", "dxf"],
  ["mismatched extension", PNG, "image/png", "jpg"],
] as const) {
  test(`rejects ${name}`, () => {
    assert.equal(matchesExpectedFileSignature(bytes, mimeType, extension), false);
  });
}

test("requests exactly 512 bytes and binds the read to the authoritative ETag", async () => {
  const object = storedObject();
  const mock = new MockStorage(object);
  mock.installFetch();

  const result = await verifyStoredUploadContent({
    supabase: mock.supabase,
    file: descriptor(object),
  });

  assert.equal(result.ok, true);
  assert.equal(FILE_SIGNATURE_PREFIX_BYTES, 512);
  assert.deepEqual(mock.requests, [{
    range: "bytes=0-511",
    ifMatch: object.etag,
  }]);
  assert.equal(mock.infoCalls, 2);
  if (result.ok) assert.equal(result.identity.etag, object.etag);
});

test("cancels a 20 MB response after the bounded prefix when Storage ignores Range", async () => {
  const object = storedObject({ size: 20 * 1024 * 1024 });
  const mock = new MockStorage(object);
  let canceled = false;
  let pullCount = 0;

  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("range"), "bytes=0-511");
    const prefix = new Uint8Array(1_024);
    prefix.set(JPEG);

    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        controller.enqueue(prefix);
      },
      cancel() {
        canceled = true;
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "content-length": String(object.size),
        etag: object.etag,
      },
    });
  };

  const result = await verifyStoredUploadContent({
    supabase: mock.supabase,
    file: descriptor(object),
  });

  assert.equal(result.ok, true);
  assert.equal(canceled, true);
  assert.ok(pullCount <= 2);
});

for (const [name, options] of [
  ["the object is missing", { missing: true }],
  ["the object has no authoritative ETag", { missingEtag: true }],
  ["signed read URL creation fails", { signedReadFailure: true }],
  ["the prefix request throws", { fetchFailure: true }],
  ["Storage responds with an error", { responseStatus: 503 }],
  ["the Range response does not start at zero", { contentRange: "bytes 1-512/1234" }],
  ["the Range response reports the wrong object size", { contentRange: "bytes 0-511/4321" }],
  ["the Range response reports the wrong prefix size", { contentRange: "bytes 0-510/1234" }],
  ["the response Content-Length is malformed", { contentLength: "NaN" }],
  ["the partial response ends early", { truncateBody: true }],
] satisfies Array<[string, MockStorageOptions]>) {
  test(`fails closed with storage_error when ${name}`, async () => {
    const object = storedObject();
    const mock = new MockStorage(object, options);
    mock.installFetch();

    const result = await verifyStoredUploadContent({
      supabase: mock.supabase,
      file: descriptor(object),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "storage_error");
      assert.equal(result.status, 500);
    }
  });
}

test("rejects content read from an unexpected response ETag", async () => {
  const object = storedObject();
  const mock = new MockStorage(object, { responseEtag: '"different-response"' });
  mock.installFetch();

  const result = await verifyStoredUploadContent({
    supabase: mock.supabase,
    file: descriptor(object),
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_upload");
});

test("rejects an object replaced during prefix verification", async () => {
  const object = storedObject();
  const mock = new MockStorage(object, { changeEtagAfterRead: true });
  mock.installFetch();

  const result = await verifyStoredUploadContent({
    supabase: mock.supabase,
    file: descriptor(object),
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_upload");
});

test("rejects mismatched trusted filename and Storage path extensions", async () => {
  const object = storedObject();
  const mock = new MockStorage(object);
  mock.installFetch();

  const result = await verifyStoredUploadContent({
    supabase: mock.supabase,
    file: { ...descriptor(object), originalFilename: "room.png" },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_upload");
  assert.equal(mock.signedPaths.length, 0);
});

test("rejects descriptor size and MIME mismatches before reading bytes", async () => {
  for (const mismatch of [
    { size: 1_235 },
    { mimeType: "image/png" },
  ]) {
    const object = storedObject();
    const mock = new MockStorage(object);
    mock.installFetch();

    const result = await verifyStoredUploadContent({
      supabase: mock.supabase,
      file: { ...descriptor(object), ...mismatch },
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_upload");
    assert.equal(mock.signedPaths.length, 0);
  }
});

test("deduplicates mirrored reference paths before bounded signature reads", async () => {
  const object = storedObject();
  const mock = new MockStorage(object);
  mock.installFetch();

  const result = await verifyOrderFileSignatures({
    supabase: mock.supabase,
    files: [descriptor(object), descriptor(object)],
  });

  assert.equal(result.ok, true);
  assert.equal(mock.signedPaths.length, 1);
  if (result.ok) assert.equal(result.identities.size, 1);
});
