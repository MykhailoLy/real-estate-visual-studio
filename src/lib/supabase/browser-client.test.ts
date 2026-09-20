import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createBrowserSupabaseClient } from "./browser.ts";
import { uploadPreparedOrderDraftFile } from "../order-drafts/files-client.ts";
import { uploadPreparedDraftReferenceFile } from "../order-drafts/draft-reference-files-client.ts";
import type { PreparedOrderDraftFileUpload } from "../order-drafts/files.ts";
import type { PreparedDraftReferenceFile } from "../order-drafts/draft-reference-files.ts";

const SOURCE_DIRECTORY = fileURLToPath(new URL("../../", import.meta.url));
const browserFactoryPath = join(SOURCE_DIRECTORY, "lib", "supabase", "browser.ts");
const serviceRoleFactoryPath = join(SOURCE_DIRECTORY, "lib", "supabase.ts");

const uploadConsumerPaths = [
  "lib/order-drafts/files-client.ts",
  "lib/order-drafts/draft-reference-files-client.ts",
  "lib/submit-order.ts",
  "app/(default)/(public)/admin/media/MediaAdminClient.tsx",
  "app/(default)/(public)/admin/portfolio/PortfolioAdminClient.tsx",
  "app/(default)/(public)/admin/properties/media/PropertyMarketingConfigurator.tsx",
  "app/(default)/(public)/admin/properties/media/OptimizedPropertyMediaManagerClient.tsx",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

test("one cookie-aware SSR factory owns every browser Supabase client", () => {
  const browserFactory = readFileSync(browserFactoryPath, "utf8");
  const serviceRoleFactory = readFileSync(serviceRoleFactoryPath, "utf8");

  assert.match(browserFactory, /^"use client";/);
  assert.match(
    browserFactory,
    /import\s*\{\s*createBrowserClient\s+as\s+_createBrowserClient\s*\}\s*from\s*"@supabase\/ssr"/,
  );
  assert.match(browserFactory, /if\s*\(_client\)\s*return\s+_client/);
  assert.match(browserFactory, /_client\s*=\s*_createBrowserClient\(url,\s*anonKey\)/);

  assert.doesNotMatch(
    serviceRoleFactory,
    /getSupabaseBrowser|browserClient|NEXT_PUBLIC_SUPABASE_ANON_KEY/,
  );
  assert.match(serviceRoleFactory, /export function createServerClient\(/);
  assert.match(serviceRoleFactory, /return createClient\(url,\s*serviceRoleKey\)/);
});

test("all signed-upload consumers reuse the authoritative browser factory", () => {
  for (const path of uploadConsumerPaths) {
    const source = readFileSync(join(SOURCE_DIRECTORY, path), "utf8");

    assert.match(
      source,
      /import\s*\{\s*createBrowserSupabaseClient\s*\}\s*from\s*"(?:@\/lib\/supabase\/browser|\.\.\/supabase\/browser\.ts)"/,
      `${path} must import the shared cookie-aware browser client`,
    );
    assert.match(
      source,
      /createBrowserSupabaseClient\(\)/,
      `${path} must use the shared cookie-aware browser client`,
    );
    assert.doesNotMatch(source, /getSupabaseBrowser/);
  }
});

test("no additional browser-side Supabase client constructor is introduced", () => {
  for (const path of sourceFiles(SOURCE_DIRECTORY)) {
    if (path === browserFactoryPath) continue;

    const source = readFileSync(path, "utf8");
    const relativePath = relative(SOURCE_DIRECTORY, path).replaceAll("\\", "/");

    assert.doesNotMatch(
      source,
      /\b(?:_?createBrowserClient)\s*\(/,
      `${relativePath} must not create another browser Supabase client`,
    );

    if (/^\s*["']use client["'];?/.test(source)) {
      assert.doesNotMatch(
        source,
        /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*["']@supabase\/supabase-js["']/,
        `${relativePath} must not construct a raw browser auth client`,
      );
    }

    if (/NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(source)) {
      assert.doesNotMatch(
        source,
        /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*["']@supabase\/supabase-js["']/,
        `${relativePath} must not create an independent anon-key browser client`,
      );
    }
  }
});

test("one SSR browser singleton supports signed original and reference uploads", async (context) => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: URL; method: string }> = [];

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-public-anon-key";

  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
    if (originalAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    }
  });

  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push({ url: new URL(request.url), method: request.method });
    return Response.json({ Key: "order-files/fixture.png" });
  };

  const authClient = createBrowserSupabaseClient();
  assert.equal(createBrowserSupabaseClient(), authClient);
  assert.equal(
    typeof authClient.storage.from("order-files").uploadToSignedUrl,
    "function",
  );

  const file = new File([new Uint8Array([137, 80, 78, 71])], "fixture.png", {
    type: "image/png",
  });
  const upload = {
    bucket: "order-files" as const,
    path: "drafts/fixture/fixture.png",
    token: "fixture-signed-token",
    signedUrl: "https://fixture.supabase.invalid/storage/v1/object/upload/sign",
  };
  const timestamp = "2026-01-01T00:00:00.000Z";
  const preparedOriginal: PreparedOrderDraftFileUpload = {
    file: {
      id: "11111111-1111-4111-8111-111111111111",
      itemClientId: "22222222-2222-4222-8222-222222222222",
      itemIndex: 0,
      kind: "original",
      originalFilename: "fixture.png",
      fileSize: file.size,
      mimeType: file.type,
      uploadStatus: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    upload,
  };
  const preparedReference: PreparedDraftReferenceFile = {
    reference: {
      id: "33333333-3333-4333-8333-333333333333",
      draftFileId: "33333333-3333-4333-8333-333333333333",
      itemClientId: "22222222-2222-4222-8222-222222222222",
      position: 0,
      file: null,
      filename: "fixture.png",
      fileSize: file.size,
      mimeType: "image/png",
      lastModified: null,
      previewUrl: null,
      previewExpiresAt: null,
      storagePath: null,
    },
    upload,
  };

  assert.deepEqual(await uploadPreparedOrderDraftFile(preparedOriginal, file), {
    ok: true,
  });
  assert.deepEqual(
    await uploadPreparedDraftReferenceFile(preparedReference, file),
    { ok: true, data: true },
  );
  assert.equal(requests.length, 2);

  for (const request of requests) {
    assert.equal(request.method, "PUT");
    assert.equal(
      request.url.pathname,
      "/storage/v1/object/upload/sign/order-files/drafts/fixture/fixture.png",
    );
    assert.equal(request.url.searchParams.get("token"), "fixture-signed-token");
  }
});
