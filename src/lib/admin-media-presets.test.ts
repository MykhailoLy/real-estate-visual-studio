import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DAY_TO_DUSK_SKY_STYLE_MEDIA_PRESETS,
  ORDER_OPTION_MEDIA_PRESET_KEYS,
  SERVICE_OPTION_MEDIA_PRESET_GROUPS,
  VIRTUAL_RENOVATION_GUIDE_MEDIA_PRESETS,
  VIRTUAL_RENOVATION_OPTION_MEDIA_PRESETS,
  VIRTUAL_STAGING_ADDON_MEDIA_PRESETS,
  getServiceOptionMediaPresetDefaults,
} from "./admin-media-presets.ts";
import {
  VIRTUAL_RENOVATION_GUIDE_MEDIA_KEYS,
  VIRTUAL_RENOVATION_OPTION_MEDIA_KEYS,
} from "../data/order-options.ts";
import { PORTFOLIO_SERVICES } from "./portfolio-service-meta.ts";

const adminClient = readFileSync(
  "src/app/(public)/admin/media/MediaAdminClient.tsx",
  "utf8",
);

const DAY_TO_DUSK_SKY_STYLE_PRESETS = [
  ["Let Our Experts Decide", "day-to-dusk-style-expert-decide"],
  ["Dramatic Clouds", "day-to-dusk-style-dramatic-clouds"],
  ["Warm Sun Glow", "day-to-dusk-style-warm-sun-glow"],
  ["Purple & Pink Fantasy", "day-to-dusk-style-purple-pink-fantasy"],
  ["Orange & Yellow", "day-to-dusk-style-orange-yellow"],
  ["Cool Blue", "day-to-dusk-style-cool-blue"],
] as const;

test("Virtual Staging Day to Dusk keeps its original key with an explicit admin label", () => {
  const preset = VIRTUAL_STAGING_ADDON_MEDIA_PRESETS.find(
    (candidate) => candidate.mediaKey === "virtual-staging-addon-day-to-dusk",
  );
  assert.deepEqual(preset, {
    label: "Virtual Staging — Day to Dusk Add-on",
    mediaKey: "virtual-staging-addon-day-to-dusk",
  });
});

test("standalone Day to Dusk exposes all six canonical sky-style presets", () => {
  assert.deepEqual(
    DAY_TO_DUSK_SKY_STYLE_MEDIA_PRESETS.map((preset) => [
      preset.label,
      preset.mediaKey,
    ]),
    DAY_TO_DUSK_SKY_STYLE_PRESETS,
  );
  assert.deepEqual(
    SERVICE_OPTION_MEDIA_PRESET_GROUPS.find(
      (group) => group.label === "Day to Dusk — Sky Styles",
    )?.presets,
    DAY_TO_DUSK_SKY_STYLE_MEDIA_PRESETS,
  );
});

test("selecting any Day to Dusk preset fills Image, title and media key defaults", () => {
  for (const [title, mediaKey] of DAY_TO_DUSK_SKY_STYLE_PRESETS) {
    assert.deepEqual(getServiceOptionMediaPresetDefaults(mediaKey), {
      mediaType: "image",
      serviceSlug: mediaKey,
      title,
    });
  }
});

test("Virtual Renovation exposes all guide and option media keys to the existing admin editor", () => {
  assert.deepEqual(
    VIRTUAL_RENOVATION_GUIDE_MEDIA_PRESETS.map((preset) => preset.mediaKey),
    VIRTUAL_RENOVATION_GUIDE_MEDIA_KEYS,
  );
  assert.deepEqual(
    VIRTUAL_RENOVATION_OPTION_MEDIA_PRESETS.map((preset) => preset.mediaKey),
    VIRTUAL_RENOVATION_OPTION_MEDIA_KEYS,
  );
  assert.equal(VIRTUAL_RENOVATION_GUIDE_MEDIA_PRESETS.length, 6);
  assert.equal(VIRTUAL_RENOVATION_OPTION_MEDIA_PRESETS.length, 27);
  for (const preset of [
    ...VIRTUAL_RENOVATION_GUIDE_MEDIA_PRESETS,
    ...VIRTUAL_RENOVATION_OPTION_MEDIA_PRESETS,
  ]) {
    assert.deepEqual(getServiceOptionMediaPresetDefaults(preset.mediaKey), {
      mediaType: "image",
      serviceSlug: preset.mediaKey,
      title: preset.label,
    });
  }
});

test("service-option presets contain no duplicate or conflicting media keys", () => {
  const keys = SERVICE_OPTION_MEDIA_PRESET_GROUPS.flatMap((group) =>
    group.presets.map((preset) => preset.mediaKey),
  );
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((key) => ORDER_OPTION_MEDIA_PRESET_KEYS.includes(key)));
});

test("the existing admin editor applies preset defaults to its controlled fields", () => {
  assert.match(adminClient, /section === "service-options"/);
  assert.match(adminClient, /getServiceOptionMediaPresetDefaults\(mediaKey\)/);
  assert.match(adminClient, /setMediaType\(defaults\.mediaType\)/);
  assert.match(adminClient, /setServiceSlug\(defaults\.serviceSlug\)/);
  assert.match(adminClient, /setTitle\(defaults\.title\)/);
  assert.match(adminClient, /value=\{title\}/);
});

test("homepage and service hero media use the canonical service dropdown", () => {
  assert.match(
    adminClient,
    /section === "homepage-slider" \|\| section === "service-hero"/,
  );
  assert.match(adminClient, /<Field label="Service" htmlFor="service_slug">/);
  assert.match(adminClient, /<option value="">No service — visual only<\/option>/);
  assert.match(adminClient, /PORTFOLIO_SERVICES\.map\(\(service\) =>/);
  assert.match(adminClient, /<option key=\{service\.slug\} value=\{service\.slug\}>/);
  assert.match(adminClient, /\{service\.label\}/);
  assert.ok(PORTFOLIO_SERVICES.length > 0);
  assert.match(
    adminClient,
    /Links this slide to its service, price and pricing page on the homepage\./,
  );
  assert.match(
    adminClient,
    /Select the service page this hero media belongs to\. 360° comparison heroes use one published Before \/ after pair\./,
  );
});

test("canonical hero dropdowns preserve legacy service slugs until an explicit selection", () => {
  assert.match(adminClient, /initial\?\.service_slug \?\? ""/);
  assert.match(
    adminClient,
    /serviceSlug\.length > 0 && !isPortfolioServiceSlug\(serviceSlug\)/,
  );
  assert.match(
    adminClient,
    /hasLegacyServiceSlug && \([\s\S]*?<option value=\{serviceSlug\}>[\s\S]*?Legacy \/ custom: \{serviceSlug\}/,
  );
  assert.match(adminClient, /value=\{serviceSlug\}/);
  assert.match(adminClient, /onChange=\{\(event\) => setServiceSlug\(event\.target\.value\)\}/);

  const sectionHandler = adminClient.slice(
    adminClient.indexOf('id="section"'),
    adminClient.indexOf('className="w-full', adminClient.indexOf('id="section"')),
  );
  assert.match(sectionHandler, /setSection\(next\)/);
  assert.doesNotMatch(sectionHandler, /setServiceSlug/);
  assert.match(adminClient, /service_slug: serviceSlug \|\| null/);
});

test("service-options retains its preset picker and manual custom key input", () => {
  const nonCanonicalField = adminClient.slice(
    adminClient.indexOf('<Field label="Service slug (optional)"'),
    adminClient.indexOf('<Field label="Visibility">'),
  );

  assert.match(nonCanonicalField, /section === "service-options"/);
  assert.match(nonCanonicalField, /aria-label="Service option media key preset"/);
  assert.match(nonCanonicalField, /SERVICE_OPTION_MEDIA_PRESET_GROUPS\.map/);
  assert.match(nonCanonicalField, /<input[\s\S]*?name="service_slug"[\s\S]*?type="text"/);
  assert.match(nonCanonicalField, /Manual keys remain supported\./);
});
