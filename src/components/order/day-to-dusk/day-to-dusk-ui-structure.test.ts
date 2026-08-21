import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DAY_TO_DUSK_OPTION_ID,
  DUSK_STYLE_DEFAULT,
  DUSK_STYLE_ID_VALUES,
} from "../../../lib/day-to-dusk.ts";

const form = readFileSync(
  "src/components/order/day-to-dusk/DayToDuskOrderForm.tsx",
  "utf8",
);
const selector = readFileSync(
  "src/components/order/day-to-dusk/DuskSkyStyleSelector.tsx",
  "utf8",
);
const layout = readFileSync("src/components/order/OrderLayout.tsx", "utf8");
const guide = readFileSync("src/components/order/OrderGuideRail.tsx", "utf8");
const page = readFileSync(
  "src/app/(dashboard)/dashboard/orders/new/day-to-dusk/page.tsx",
  "utf8",
);

test("Day to Dusk transactional option values and default remain unchanged", () => {
  assert.equal(DAY_TO_DUSK_OPTION_ID, "day-to-dusk-pe");
  assert.equal(DUSK_STYLE_DEFAULT, "expert-decide");
  assert.deepEqual(DUSK_STYLE_ID_VALUES, [
    "expert-decide",
    "dramatic-clouds",
    "warm-sun-glow",
    "purple-pink-fantasy",
    "orange-yellow",
    "cool-blue",
  ]);
});

test("configure uses the guide and local Review action while Review keeps one summary", () => {
  assert.equal((form.match(/<OrderSummary/g) ?? []).length, 1);
  assert.match(form, /const sidebar = isReview/);
  assert.match(form, /const guide = !isReview/);
  assert.match(form, /leadingRail=\{guide\}/);
  assert.match(form, /onClick=\{goToReview\}[\s\S]+Review Order/);
  assert.match(form, /if \(submittingRef\.current \|\| step !== "review"\) return/);
});

test("the reusable guide consumes no tablet or mobile width", () => {
  assert.match(layout, /hidden min-w-0 xl:block/);
  assert.match(layout, /minmax\(220px,260px\)/);
  assert.match(guide, /hidden min-\[1400px\]:block/);
  assert.match(page, /max-w-\[1600px\]/);
});

test("sky cards are responsive and the zoom control is separate from selection", () => {
  assert.match(
    selector,
    /grid-cols-1 gap-5 sm:grid-cols-2 min-\[1400px\]:grid-cols-3/,
  );
  assert.match(selector, /aria-label=\{`View \$\{style\.label\} example larger`\}/);
  assert.match(selector, /<ImageLightbox/);
  assert.match(selector, /variant="photo"/);

  const firstLabelClose = selector.indexOf("</label>");
  const zoomControl = selector.indexOf("aria-label={`View ${style.label}");
  assert.ok(firstLabelClose >= 0 && zoomControl > firstLabelClose);
});
