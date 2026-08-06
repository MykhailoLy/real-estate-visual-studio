import assert from "node:assert/strict";
import test from "node:test";
import { loadPropertySocialImageSource } from "./social-image-source.ts";

const property = { slug: "sea-view-residence" };

test("fetches trusted JPEG, PNG and WebP property sources as bounded bytes", async () => {
  for (const contentType of ["image/jpeg", "image/png", "image/webp"]) {
    const calls: Array<{ url: string; redirect?: RequestRedirect }> = [];
    const result = await loadPropertySocialImageSource(
      property,
      "https://picchuspot.com/non-local/social-source.webp",
      "photo",
      {
        fetchImpl: async (url, init) => {
          calls.push({ url, redirect: init?.redirect });
          return new Response(Buffer.from("safe-image"), {
            status: 200,
            headers: { "Content-Type": contentType },
          });
        },
      },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.source.contentType, contentType);
      assert.equal(result.source.bytes.toString(), "safe-image");
    }
    assert.deepEqual(calls, [
      {
        url: "https://picchuspot.com/non-local/social-source.webp",
        redirect: "error",
      },
    ]);
  }
});

test("fetches only a property-owned object on the exact Supabase origin", async () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  try {
    const trusted =
      "https://project.supabase.co/storage/v1/object/public/site-media/property-showcases/sea-view-residence/photo.webp";
    const result = await loadPropertySocialImageSource(
      property,
      trusted,
      "photo",
      {
        fetchImpl: async () =>
          new Response(Buffer.from("photo"), {
            headers: { "Content-Type": "image/webp" },
          }),
      },
    );
    assert.equal(result.ok, true);

    let called = false;
    const lookalike = await loadPropertySocialImageSource(
      property,
      "https://project.supabase.co.evil.example/storage/v1/object/public/site-media/property-showcases/sea-view-residence/photo.webp",
      "photo",
      {
        fetchImpl: async () => {
          called = true;
          return new Response();
        },
      },
    );
    assert.deepEqual(lookalike, { ok: false, reason: "untrusted-url" });
    assert.equal(called, false);
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  }
});

test("rejects failed responses, unsafe types and oversized source bodies", async () => {
  const url = "https://picchuspot.com/non-local/social-source.webp";
  assert.deepEqual(
    await loadPropertySocialImageSource(property, url, "photo", {
      fetchImpl: async () => new Response("missing", { status: 404 }),
    }),
    { ok: false, reason: "http-error" },
  );
  assert.deepEqual(
    await loadPropertySocialImageSource(property, url, "photo", {
      fetchImpl: async () =>
        new Response("<html></html>", {
          headers: { "Content-Type": "text/html" },
        }),
    }),
    { ok: false, reason: "unsupported-content-type" },
  );
  assert.deepEqual(
    await loadPropertySocialImageSource(property, url, "photo", {
      maxSourceBytes: 4,
      fetchImpl: async () =>
        new Response(Buffer.from("too-large"), {
          headers: { "Content-Type": "image/png" },
        }),
    }),
    { ok: false, reason: "source-too-large" },
  );
});

test("aborts a timed-out remote image fetch", async () => {
  const result = await loadPropertySocialImageSource(
    property,
    "https://picchuspot.com/non-local/slow-source.webp",
    "photo",
    {
      timeoutMs: 5,
      fetchImpl: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    },
  );

  assert.deepEqual(result, { ok: false, reason: "fetch-timeout" });
});

test("accepts SVG logos but never SVG property photographs", async () => {
  const fetchImpl = async () =>
    new Response("<svg xmlns='http://www.w3.org/2000/svg'></svg>", {
      headers: { "Content-Type": "image/svg+xml" },
    });
  const photo = await loadPropertySocialImageSource(
    property,
    "https://picchuspot.com/non-local/logo.svg",
    "photo",
    { fetchImpl },
  );
  const logo = await loadPropertySocialImageSource(
    property,
    "https://picchuspot.com/non-local/logo.svg",
    "logo",
    { fetchImpl },
  );

  assert.deepEqual(photo, { ok: false, reason: "unsupported-content-type" });
  assert.equal(logo.ok, true);
});
