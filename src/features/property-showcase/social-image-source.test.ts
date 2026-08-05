import assert from "node:assert/strict";
import test from "node:test";
import { fetchPropertySocialImageDataUri } from "./social-image-source.ts";

const property = { slug: "sea-view-residence" };

test("fetches a trusted PicchuSpot image and embeds validated bytes", async () => {
  const calls: Array<{ url: string; redirect?: RequestRedirect }> = [];
  const result = await fetchPropertySocialImageDataUri(
    property,
    "https://picchuspot.com/property-demo/exterior.webp",
    {
      fetchImpl: async (url, init) => {
        calls.push({ url, redirect: init?.redirect });
        return new Response(Buffer.from("safe-image"), {
          status: 200,
          headers: { "Content-Type": "image/webp" },
        });
      },
    },
  );

  assert.equal(result, "data:image/webp;base64,c2FmZS1pbWFnZQ==");
  assert.deepEqual(calls, [
    {
      url: "https://picchuspot.com/property-demo/exterior.webp",
      redirect: "error",
    },
  ]);
});

test("fetches only a property-owned object on the exact Supabase origin", async () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  try {
    const trusted =
      "https://project.supabase.co/storage/v1/object/public/site-media/property-showcases/sea-view-residence/photo.webp";
    const data = await fetchPropertySocialImageDataUri(property, trusted, {
      fetchImpl: async () =>
        new Response(Buffer.from("photo"), {
          headers: { "Content-Type": "image/webp" },
        }),
    });
    assert.match(data ?? "", /^data:image\/webp;base64,/);

    let called = false;
    const lookalike = await fetchPropertySocialImageDataUri(
      property,
      "https://project.supabase.co.evil.example/storage/v1/object/public/site-media/property-showcases/sea-view-residence/photo.webp",
      {
        fetchImpl: async () => {
          called = true;
          return new Response();
        },
      },
    );
    assert.equal(lookalike, null);
    assert.equal(called, false);
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  }
});

test("rejects failed responses, unsafe content types and oversized images", async () => {
  const url = "https://picchuspot.com/property-demo/exterior.webp";
  assert.equal(
    await fetchPropertySocialImageDataUri(property, url, {
      fetchImpl: async () => new Response("missing", { status: 404 }),
    }),
    null,
  );
  assert.equal(
    await fetchPropertySocialImageDataUri(property, url, {
      fetchImpl: async () =>
        new Response("<html></html>", {
          headers: { "Content-Type": "text/html" },
        }),
    }),
    null,
  );
  assert.equal(
    await fetchPropertySocialImageDataUri(property, url, {
      maxBytes: 4,
      fetchImpl: async () =>
        new Response(Buffer.from("too-large"), {
          headers: { "Content-Type": "image/png" },
        }),
    }),
    null,
  );
});
