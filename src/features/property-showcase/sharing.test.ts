import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalPropertyUrl, propertyShareData } from "./sharing.ts";

const actionsSource = readFileSync(
  new URL(
    "../../app/(default)/(showcase)/property/PropertyShowcaseActions.tsx",
    import.meta.url,
  ),
  "utf8",
);
const publicPageSource = readFileSync(
  new URL("../../app/(default)/(showcase)/property/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const adminPreviewSource = readFileSync(
  new URL(
    "../../app/(default)/(showcase)/admin/properties/[id]/preview/page.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("property share payload always uses the canonical public property URL", () => {
  assert.equal(
    canonicalPropertyUrl("sea-view-residence"),
    "https://picchuspot.com/property/sea-view-residence",
  );
  assert.deepEqual(
    propertyShareData({
      slug: "sea-view-residence",
      title: "Sea View Residence",
      text: "Altea | EUR 695,000",
    }),
    {
      title: "Sea View Residence",
      text: "Altea | EUR 695,000",
      url: "https://picchuspot.com/property/sea-view-residence",
    },
  );
});

test("native sharing uses the canonical URL and fallback copies the useful share payload", () => {
  assert.equal(actionsSource.includes("window.location.href"), false);
  assert.equal(actionsSource.includes("url: canonicalUrl"), true);
  assert.equal(
    actionsSource.includes('[text, canonicalUrl].filter(Boolean).join("\\n")'),
    true,
  );
});

test("public and admin preview routes pass the same canonical property URL", () => {
  assert.equal(
    publicPageSource.includes("absoluteUrl(`/property/${property.slug}`)"),
    true,
  );
  assert.equal(
    adminPreviewSource.includes(
      "absoluteUrl(`/property/${record.property.slug}`)",
    ),
    true,
  );
  assert.equal(adminPreviewSource.includes("window.location"), false);
});
