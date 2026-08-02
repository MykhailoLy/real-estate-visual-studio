import assert from "node:assert/strict";
import test from "node:test";
import {
  extractIframeSrc,
  getTrustedPropertyFrameOrigins,
  normalizeFloorPlanInteractiveUrl,
  normalizeInteractiveFloorPlanInput,
  normalizeTourInput,
} from "./provider-urls.ts";

test("extractIframeSrc reads iframe HTML src and decodes ampersands", () => {
  assert.equal(
    extractIframeSrc(
      '<iframe src="https://kuula.co/share/abc?fs=1&amp;vr=0"></iframe>',
    ),
    "https://kuula.co/share/abc?fs=1&vr=0",
  );
});

test("provider URL normalization rejects unsafe and non-HTTPS URLs", () => {
  assert.equal(normalizeFloorPlanInteractiveUrl("javascript:alert(1)"), null);
  assert.equal(normalizeFloorPlanInteractiveUrl("data:text/html,hi"), null);
  assert.equal(normalizeFloorPlanInteractiveUrl("http://kuula.co/share/abc"), null);
  assert.equal(normalizeFloorPlanInteractiveUrl("https://evil.example/tour"), null);
});

test("Kuula MLS URLs preserve the original fallback and produce a standard embed URL", () => {
  const normalized = normalizeTourInput("kuula", {
    embedUrl: "https://mls.kuu.la/share/collection/abc?logo=0",
  });

  assert.equal(normalized?.providerName, "Kuula");
  assert.equal(
    normalized?.externalUrl,
    "https://mls.kuu.la/share/collection/abc?logo=0",
  );
  assert.equal(
    normalized?.embedUrl,
    "https://kuula.co/share/collection/abc?logo=0&initload=1&fs=1",
  );
});

test("Matterport iframe input normalizes to the iframe src", () => {
  const normalized = normalizeTourInput("matterport", {
    embedUrl:
      '<iframe src="https://my.matterport.com/show/?m=4pYEangv54B&play=1"></iframe>',
  });

  assert.equal(
    normalized?.embedUrl,
    "https://my.matterport.com/show/?m=4pYEangv54B&play=1",
  );
  assert.equal(normalized?.inputKind, "iframe");
});

test("CubiCasa unbranded URLs are valid external interactive floor plans", () => {
  const normalized = normalizeFloorPlanInteractiveUrl(
    "https://unbranded.visithome.ai/12345",
  );

  assert.equal(normalized?.provider, "cubiCasa");
  assert.equal(normalized?.externalUrl, "https://unbranded.visithome.ai/12345");
  assert.equal(normalized?.canEmbed, false);
  assert.equal(normalized?.embedUrl, undefined);
});

test("CubiCasa iframe HTML extracts a validated embed URL separately", () => {
  const normalized = normalizeInteractiveFloorPlanInput({
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/12345",
    embedUrl:
      '<iframe src="https://unbranded.visithome.ai/12345?mode=embed&amp;lang=en"></iframe>',
  });

  assert.equal(normalized?.provider, "cubiCasa");
  assert.equal(normalized?.externalUrl, "https://unbranded.visithome.ai/12345");
  assert.equal(
    normalized?.embedUrl,
    "https://unbranded.visithome.ai/12345?mode=embed&lang=en",
  );
  assert.equal(normalized?.canEmbed, true);
});

test("interactive floor plan embed input rejects unsafe iframe sources", () => {
  const normalized = normalizeInteractiveFloorPlanInput({
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/12345",
    embedUrl: '<iframe src="https://evil.example/12345"></iframe>',
  });

  assert.equal(normalized, null);
});

test("Nodalview share URLs produce iframe-mode embed URLs", () => {
  const normalized = normalizeTourInput("nodalview", {
    externalUrl: "https://www.nodalview.com/tNKymARSrX4o24CjaNd4yYrh",
  });

  assert.equal(
    normalized?.externalUrl,
    "https://www.nodalview.com/tNKymARSrX4o24CjaNd4yYrh",
  );
  assert.equal(
    normalized?.embedUrl,
    "https://www.nodalview.com/tNKymARSrX4o24CjaNd4yYrh?iframe=true",
  );
});

test("trusted frame origins stay exact and include supported providers", () => {
  const origins = getTrustedPropertyFrameOrigins();

  for (const origin of [
    "https://kuula.co",
    "https://my.matterport.com",
    "https://unbranded.visithome.ai",
    "https://floorfy.com",
    "https://www.nodalview.com",
  ]) {
    assert.equal(origins.includes(origin), true);
  }

  assert.equal(origins.some((origin) => origin.includes("*")), false);
});
