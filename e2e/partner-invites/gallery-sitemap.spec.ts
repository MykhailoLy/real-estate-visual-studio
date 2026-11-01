import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PORTFOLIO_SERVICE_SLUGS } from "../../src/lib/portfolio-service-meta";

test("gallery sitemap follows publication, survives a read failure and handles capped results", async ({ request }) => {
  const floorId = "11111111-aaaa-4444-8888-111111111111";
  const en = "/gallery/floor-plans";
  const es = "/es/gallery/floor-plans";
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const sig = createHmac("sha256", "isolated-partner-invite-test-password").update(`${expiry}:picchu:admin`).digest("hex");
  async function publish(published: boolean) {
    const result = await request.patch(`/api/admin/portfolio/${floorId}`, {
      headers: { cookie: `picchu_admin_session=${expiry}.${sig}` }, data: { published },
    });
    expect(result.status()).toBe(200);
  }
  async function entries() {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(new Set(urls).size).toBe(urls.length);
    return urls.sort();
  }

  async function failedReads(): Promise<number> {
    return (await (await request.get("/__fixture/gallery")).json()).failedReads;
  }

  // The isolated build starts without confirmed gallery data. Compare paths so new blog
  // articles do not invalidate this test or hide a missing gallery.
  const base = await entries();
  expect(base).toContain("/pricing/floor-plans");
  expect(base.filter((url) => url.includes("/gallery/"))).toEqual([]);
  const full = [...base, ...PORTFOLIO_SERVICE_SLUGS.flatMap((slug) => [
    `/gallery/${slug}`, `/es/gallery/${slug}`,
  ])].sort();
  const withoutFloor = full.filter((url) => url !== en && url !== es);

  const row = (service_slug: string) => ({
    service_slug, before_image_path: "before.jpg", after_image_path: "after.jpg",
    published: true, show_in_gallery: true,
  });
  const others = PORTFOLIO_SERVICE_SLUGS.filter((s) => s !== "floor-plans");
  const rows = [
    ...Array.from({ length: 1000 }, (_, i) => row(others[i % others.length])),
    { ...row("floor-plans"), id: floorId },
    { ...row("floor-plans"), before_image_path: "" },
    { ...row("floor-plans"), after_image_path: null },
    { ...row("floor-plans"), show_in_gallery: false },
    row("unknown-service"),
  ];
  expect((await request.post("/__fixture/gallery", { data: { rows, failReads: false } })).ok()).toBe(true);
  await publish(true);
  await expect.poll(entries).toEqual(full);
  await publish(false);
  await expect.poll(entries).toEqual(withoutFloor);

  const failuresBeforeRefresh = await failedReads();
  await request.post("/__fixture/gallery", { data: { failReads: true } });
  await publish(true);
  // Force a real attempted refresh. Simply observing a stale response before
  // the request reaches Supabase would let a broken cache pass.
  await expect.poll(async () => {
    expect(await entries()).toEqual(withoutFloor);
    return failedReads();
  }).toBeGreaterThan(failuresBeforeRefresh);
  expect(await entries()).toEqual(withoutFloor);

  await request.post("/__fixture/gallery", { data: { failReads: false } });
  await publish(true);
  await expect.poll(entries).toEqual(full);

  // A successful empty result must replace the previous snapshot too.
  const inactive = { ...row("floor-plans"), id: floorId, published: false };
  await request.post("/__fixture/gallery", { data: { rows: [inactive] } });
  await publish(false);
  await expect.poll(entries).toEqual(base);
  await request.post("/__fixture/gallery", { data: { rows: [] } });
});
