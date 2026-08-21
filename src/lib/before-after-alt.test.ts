import assert from "node:assert/strict";
import test from "node:test";
import { getBeforeAfterAlt } from "./before-after-alt.ts";

test("preserves explicit per-image ALT values verbatim", () => {
  assert.deepEqual(
    getBeforeAfterAlt({
      beforeAlt: "Modern villa exterior photographed in daylight",
      afterAlt: "Modern villa exterior after twilight editing",
      sharedAlt: "This shared value must not replace either side",
      serviceLabel: "Day to Dusk",
    }),
    {
      beforeAlt: "Modern villa exterior photographed in daylight",
      afterAlt: "Modern villa exterior after twilight editing",
    },
  );
});

test("turns one shared scene description into distinct ALT values", () => {
  assert.deepEqual(
    getBeforeAfterAlt({
      sharedAlt: "Modern villa exterior with pool and landscaped garden",
      serviceLabel: "Day to Dusk",
    }),
    {
      beforeAlt:
        "Before day-to-dusk editing: Modern villa exterior with pool and landscaped garden",
      afterAlt:
        "After day-to-dusk editing: Modern villa exterior with pool and landscaped garden",
    },
  );
});

test("preserves an explicit Before ALT and generates only the missing After ALT", () => {
  const result = getBeforeAfterAlt({
    beforeAlt: "Modern villa exterior photographed in daylight",
    serviceLabel: "Day to Dusk",
  });

  assert.deepEqual(result, {
    beforeAlt: "Modern villa exterior photographed in daylight",
    afterAlt:
      "After day-to-dusk editing: Modern villa exterior photographed in daylight",
  });
  assert.notEqual(result.afterAlt, result.beforeAlt);
});

test("preserves an explicit After ALT and generates only the missing Before ALT", () => {
  const result = getBeforeAfterAlt({
    afterAlt: "Furnished living room with contemporary furniture",
    serviceLabel: "Virtual Staging",
  });

  assert.deepEqual(result, {
    beforeAlt:
      "Before virtual staging: Furnished living room with contemporary furniture",
    afterAlt: "Furnished living room with contemporary furniture",
  });
  assert.notEqual(result.beforeAlt, result.afterAlt);
});

test("never copies an opposite-side explicit ALT verbatim to the missing side", () => {
  const beforeOnly = getBeforeAfterAlt({
    beforeAlt: "Modern villa exterior in daylight",
    serviceLabel: "Day to Dusk",
  });
  const afterOnly = getBeforeAfterAlt({
    afterAlt: "Modern villa exterior after twilight editing",
    serviceLabel: "Day to Dusk",
  });

  assert.notEqual(beforeOnly.afterAlt, beforeOnly.beforeAlt);
  assert.notEqual(afterOnly.beforeAlt, afterOnly.afterAlt);
});

test("uses description, title, and service metadata as fallbacks", () => {
  assert.deepEqual(
    getBeforeAfterAlt({
      title: "Kitchen update",
      description: "Bright kitchen with white cabinets and a central island",
      serviceLabel: "Virtual Renovation",
    }),
    {
      beforeAlt:
        "Before virtual renovation: Bright kitchen with white cabinets and a central island",
      afterAlt:
        "After virtual renovation: Bright kitchen with white cabinets and a central island",
    },
  );
});

test("avoids repeating stage and service wording in legacy shared ALT", () => {
  assert.deepEqual(
    getBeforeAfterAlt({
      sharedAlt: "Before: Real estate day to dusk example",
      serviceLabel: "Day to Dusk",
    }),
    {
      beforeAlt: "Before: Real estate day to dusk example",
      afterAlt: "After: Real estate day to dusk example",
    },
  );
});

test("works for Before/After services besides Day to Dusk", () => {
  assert.deepEqual(
    getBeforeAfterAlt({
      sharedAlt: "Empty open-plan living area with large windows",
      serviceLabel: "Virtual Staging",
    }),
    {
      beforeAlt:
        "Before virtual staging: Empty open-plan living area with large windows",
      afterAlt:
        "After virtual staging: Empty open-plan living area with large windows",
    },
  );
});

test("supports localized generated labels without changing explicit ALT", () => {
  assert.deepEqual(
    getBeforeAfterAlt({
      beforeAlt: "Original architect sketch",
      description: "Plano de vivienda de dos dormitorios",
      serviceLabel: "Planos",
      locale: "es",
    }),
    {
      beforeAlt: "Original architect sketch",
      afterAlt: "Después de Planos: Original architect sketch",
    },
  );
});
