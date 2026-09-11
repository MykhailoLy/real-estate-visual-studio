import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DAY_TO_DUSK_OPTION_ID,
  DAY_TO_DUSK_MEDIA_KEYS,
  DUSK_STYLES,
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
const itemCard = readFileSync(
  "src/components/order/day-to-dusk/DayToDuskItemCard.tsx",
  "utf8",
);
const fileUpload = readFileSync("src/components/order/FileUpload.tsx", "utf8");
const deliveryFields = readFileSync(
  "src/components/order/ItemDeliveryFields.tsx",
  "utf8",
);
const layout = readFileSync("src/components/order/OrderLayout.tsx", "utf8");
const guide = readFileSync("src/components/order/OrderGuideRail.tsx", "utf8");
const page = readFileSync(
  "src/app/(dashboard)/dashboard/orders/new/day-to-dusk/page.tsx",
  "utf8",
);
const clientWorkspace = readFileSync(
  "src/components/dashboard/client-portal-workspace.ts",
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

test("the selector resolves the exact six canonical admin media keys", () => {
  assert.deepEqual(DAY_TO_DUSK_MEDIA_KEYS, [
    "day-to-dusk-style-expert-decide",
    "day-to-dusk-style-dramatic-clouds",
    "day-to-dusk-style-warm-sun-glow",
    "day-to-dusk-style-purple-pink-fantasy",
    "day-to-dusk-style-orange-yellow",
    "day-to-dusk-style-cool-blue",
  ]);
  assert.equal(DUSK_STYLES[0].label, "Let Our Experts Decide");
  assert.equal(DUSK_STYLES[0].mediaKey, DAY_TO_DUSK_MEDIA_KEYS[0]);
  assert.match(selector, /images\[style\.mediaKey\]/);
  assert.match(page, /getServiceOptionImagesByKeys\(DAY_TO_DUSK_MEDIA_KEYS\)/);
});

test("configure uses the guide and local Review action while Review keeps one summary", () => {
  assert.equal((form.match(/<OrderSummary/g) ?? []).length, 1);
  assert.match(form, /const sidebar = isReview/);
  assert.match(form, /const guide = !isReview/);
  assert.match(form, /leadingRail=\{guide\}/);
  assert.match(
    form,
    /<OrderReviewAction[\s\S]*?onClick=\{goToReview\}[\s\S]*?disabled=\{!configureValid \|\| fileOperationActive\}/,
  );
  assert.match(
    form,
    /if \(submittingRef\.current \|\| step !== "review"\) return/,
  );
});

test("the reusable guide is a full-width collapsed section in wide workspaces", () => {
  assert.match(
    layout,
    /const hasInlineGuide = hasLeadingRail && isWideWorkspace/,
  );
  assert.match(layout, /\{hasInlineGuide &&/);
  assert.equal((guide.match(/<details/g) ?? []).length, 1);
  assert.match(guide, /<summary className="[^"]*min-h-11/);
  assert.match(guide, />\s*Order guide\s*</);
  assert.match(guide, /md:grid-cols-3/);
  assert.doesNotMatch(guide, /<aside|md:hidden|lg:hidden/);
  assert.doesNotMatch(form, /compactLeadingRail/);
});

test("configure opts into the wide dashboard workspace while Review stays default", () => {
  assert.match(form, /workspaceVariant=\{isReview \? undefined : "wide"\}/);
  assert.match(layout, /workspaceVariant\?: "wide"/);
  assert.match(layout, /max-w-\[1800px\]/);
  assert.match(layout, /hasLeadingRail && !isWideWorkspace/);
  assert.match(clientWorkspace, /max-w-\[1800px\]/);
  assert.match(page, /<ClientDashboardLayout flush>/);
});

test("each uploaded photo uses the shared left-preview workspace", () => {
  assert.match(itemCard, /presentationVariant="workspace"/);
  assert.match(itemCard, /<OrderImageWorkspace/);
  assert.match(itemCard, /hasPreview=\{hasOriginalPreview\}/);
  assert.match(itemCard, /hasFileUploadPreview\(/);
  assert.doesNotMatch(itemCard, /CurrentPhotoPreview|URL\.createObjectURL/);
  assert.match(fileUpload, /isWorkspacePresentation/);
  assert.match(fileUpload, /data-order-image-preview/);
  assert.match(fileUpload, /object-contain object-center/);
  assert.match(fileUpload, /\{replaceLabel\}/);
});

test("wide configuration controls use intentional desktop grids", () => {
  assert.match(itemCard, /min-\[1180px\]:grid-cols-3/);
  assert.match(itemCard, /layoutVariant="desktop-columns"/);
  assert.match(deliveryFields, /lg:grid-cols-2/);
});

test("sky cards are responsive and the zoom control is separate from selection", () => {
  assert.match(selector, /grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3/);
  assert.match(selector, /line-clamp-2/);
  assert.match(
    selector,
    /aria-label=\{`View \$\{style\.label\} example larger`\}/,
  );
  assert.match(selector, /<ImageLightbox/);
  assert.match(selector, /variant="photo"/);

  const firstLabelClose = selector.indexOf("</label>");
  const zoomControl = selector.indexOf("aria-label={`View ${style.label}");
  assert.ok(firstLabelClose >= 0 && zoomControl > firstLabelClose);
});

test("the configure layout does not change submitted Day to Dusk metadata", () => {
  assert.match(form, /selectedOptions: \[DAY_TO_DUSK_OPTION_ID\]/);
  assert.match(form, /duskStyle: item\.duskStyle/);
  assert.match(form, /turnOnInteriorLights: item\.turnOnInteriorLights/);
  assert.match(form, /turnOnExteriorLights: item\.turnOnExteriorLights/);
  assert.match(form, /addPoolLights: item\.addPoolLights/);
});
