import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RENOVATION_EXTERNAL_OPTIONS,
  RENOVATION_INTERNAL_OPTIONS,
  VIRTUAL_RENOVATION_GUIDE_MEDIA_KEYS,
  VIRTUAL_RENOVATION_MEDIA_KEYS,
  VIRTUAL_RENOVATION_OPTION_MEDIA_KEYS,
  VIRTUAL_RENOVATION_STYLE_MEDIA_KEYS,
} from "../../../data/order-options.ts";
import {
  VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION,
  VIRTUAL_RENOVATION_DRAFT_STEP,
} from "../../../lib/order-drafts/virtual-renovation.ts";
import { getInitialVirtualRenovationScreen } from "./virtual-renovation-flow.ts";

const formSource = readFileSync(
  new URL("./VirtualRenovationOrderForm.tsx", import.meta.url),
  "utf8",
);
const itemCardSource = readFileSync(
  new URL("./RenovationItemCard.tsx", import.meta.url),
  "utf8",
);
const overviewSource = readFileSync(
  new URL("./VirtualRenovationOverview.tsx", import.meta.url),
  "utf8",
);
const reviewSource = readFileSync(
  new URL("./VirtualRenovationReview.tsx", import.meta.url),
  "utf8",
);
const reviewRowsSource = readFileSync(
  new URL("./virtual-renovation-review.ts", import.meta.url),
  "utf8",
);
const requirementsSource = readFileSync(
  new URL("./VirtualRenovationRequirements.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL(
    "../../../app/(dashboard)/dashboard/orders/new/virtual-renovation/page.tsx",
    import.meta.url,
  ),
  "utf8",
);

const EXPECTED_INTERNAL_IDENTITIES = [
  ["replace-flooring", "renovation-replace-flooring"],
  ["replace-walls", "renovation-replace-walls"],
  ["replace-ceiling", "renovation-replace-ceiling"],
  ["item-removal-cleaning", "renovation-item-removal-cleaning"],
  ["add-remove-walls", "renovation-add-remove-walls"],
  ["kitchen-fit-out", "renovation-kitchen-fit-out"],
  ["bathroom-fit-out", "renovation-bathroom-fit-out"],
  ["add-fixtures", "renovation-add-fixtures"],
  ["staging-residential", "renovation-staging-residential"],
  ["staging-commercial-office", "renovation-staging-commercial-office"],
  [
    "staging-commercial-non-office",
    "renovation-staging-commercial-non-office",
  ],
  ["color-change-interior", "renovation-colour-change-interior"],
] as const;

const EXPECTED_EXTERNAL_IDENTITIES = [
  ["add-pool", "renovation-add-pool"],
  ["add-pool-surrounds", "renovation-pool-surrounds"],
  ["remove-pool-cover", "renovation-remove-pool-cover"],
  ["add-leaves", "renovation-add-leaves"],
  ["basic-landscaping", "renovation-basic-landscaping"],
  ["full-landscaping", "renovation-full-landscaping"],
  ["season-change-landscaping", "renovation-season-change-landscaping"],
  ["ext-staging", "renovation-exterior-staging"],
  ["ext-item-removal", "renovation-item-removal-cleaning"],
  ["ext-add-fixtures", "renovation-add-fixtures"],
  ["replace-driveway", "renovation-replace-driveway"],
  ["replace-roof", "renovation-replace-roof"],
  ["replace-exterior-walls", "renovation-replace-exterior-walls"],
  ["add-patio-balcony", "renovation-add-patio-balcony"],
  ["color-change-exterior", "renovation-colour-change-exterior"],
] as const;

test("a fresh order opens the overview while draft URLs restore Configure", () => {
  assert.equal(getInitialVirtualRenovationScreen(null), "overview");
  assert.equal(
    getInitialVirtualRenovationScreen("f4e162a3-92e1-4abc-93b3-91efb823b79d"),
    "configure",
  );
  assert.match(formSource, /screen === "overview"/);
  assert.match(formSource, /<VirtualRenovationOverview/);
  assert.match(overviewSource, /Start Virtual Renovation Order/);
  assert.match(overviewSource, /External Renovation/);
  assert.match(overviewSource, /Internal Renovation/);
  assert.match(overviewSource, /md:grid-cols-2 lg:grid-cols-3/);
});

test("guide and option metadata use one server-side media batch", () => {
  assert.equal(VIRTUAL_RENOVATION_GUIDE_MEDIA_KEYS.length, 6);
  assert.equal(VIRTUAL_RENOVATION_OPTION_MEDIA_KEYS.length, 27);
  assert.equal(VIRTUAL_RENOVATION_STYLE_MEDIA_KEYS.length, 8);
  assert.equal(VIRTUAL_RENOVATION_MEDIA_KEYS.length, 41);
  assert.equal(new Set(VIRTUAL_RENOVATION_MEDIA_KEYS).size, 41);
  assert.match(
    pageSource,
    /getServiceOptionMediaByKeys\(VIRTUAL_RENOVATION_MEDIA_KEYS\)/,
  );
  assert.equal(pageSource.match(/getServiceOptionMediaByKeys\(/g)?.length, 1);
  assert.match(
    pageSource,
    /<VirtualRenovationMediaProvider mediaByKey=\{Object\.fromEntries\(media\)\}>/,
  );
});

test("Configure and Review use the shared two-step order language", () => {
  assert.match(formSource, /const STEPS = TWO_STEP_ORDER_STEPS/);
  assert.match(
    formSource,
    /<OrderStepIndicator steps=\{STEPS\} currentStepId=\{screen\}/,
  );
  assert.match(formSource, /editorial=\{!isReview\}/);
  assert.match(
    formSource,
    /workspaceVariant=\{isReview \? undefined : "wide"\}/,
  );
});

test("Configure composes service-specific requirements through the shared guide", () => {
  assert.match(
    formSource,
    /const requirementsRail = !isReview \? \(\s*<VirtualRenovationRequirements \/>/,
  );
  assert.match(formSource, /leadingRail=\{requirementsRail\}/);
  assert.equal(requirementsSource.match(/<OrderGuideRail/g)?.length, 1);
  assert.doesNotMatch(formSource, /compactLeadingRail|<OrderGuideRail/);
  assert.doesNotMatch(requirementsSource, /<details|<aside|compact|useState/);
  assert.match(requirementsSource, /high-resolution original image/);
  assert.match(requirementsSource, /style\/design brief/);
  assert.match(requirementsSource, /build changes, fixture\s+changes/);
  assert.match(requirementsSource, /furniture, materials, textures/);
  assert.match(requirementsSource, /colour direction/);
  assert.match(requirementsSource, /Reference images, links or mark-up sketches/);
  assert.match(requirementsSource, /Use Virtual Renovation to visualise/);
  assert.match(requirementsSource, /Complex reconstruction or unclear source material/);
  assert.match(requirementsSource, /JPG, JPEG or PNG/);
  assert.match(requirementsSource, /JPG, JPEG, PNG, WebP or PDF/);
});

test("Review alone owns the unchanged Order Summary sidebar", () => {
  assert.match(
    formSource,
    /sidebar=\{\s*isReview \? \([\s\S]*?<OrderSummary[\s\S]*?\) : undefined\s*\}/,
  );
  assert.equal(formSource.match(/<OrderSummary/g)?.length, 1);
  assert.match(formSource, /<VirtualRenovationReview/);
  assert.match(reviewSource, /<OrderReviewHeader/);
  assert.match(reviewSource, /<OrderReviewItem/);
  assert.match(reviewSource, /<ReferenceFilesReview/);
  assert.match(reviewSource, /<OrderTermsBlock/);
  assert.doesNotMatch(reviewSource, /<OrderSummary|Submit Order|handleSubmit/);
  assert.match(formSource, /onSubmit=\{handleSubmit\}/);
  assert.match(formSource, /screen !== "review"/);
  assert.equal(formSource.match(/onSubmit=\{handleSubmit\}/g)?.length, 1);
});

test("ReferenceFilesReview exclusively owns Renovation links and files", () => {
  assert.equal(reviewSource.match(/<ReferenceFilesReview/g)?.length, 1);
  assert.equal(
    reviewSource.match(/referenceLink=\{item\.referenceLink\}/g)?.length,
    1,
  );
  assert.doesNotMatch(reviewRowsSource, /label:\s*"Reference Link"/);
  assert.doesNotMatch(reviewRowsSource, /label:\s*"Reference Files"/);
});

test("Review Order persists the draft and never invokes final submission", () => {
  const start = formSource.indexOf("const goToReview = async () =>");
  const end = formSource.indexOf("const goToConfigureTop", start);
  assert.ok(start > -1);
  assert.ok(end > start);
  const transitionSource = formSource.slice(start, end);
  const save = transitionSource.indexOf(
    "await enqueueDraftSave(buildDraftSource(), true)",
  );
  const review = transitionSource.indexOf('setScreen("review")');
  assert.ok(save > -1);
  assert.ok(review > save);
  assert.doesNotMatch(
    transitionSource,
    /submitOrderDraft|submitWithContext|handleSubmit/,
  );
  assert.match(formSource, /onClick=\{\(\) => void goToReview\(\)\}/);
});

test("retry submission is outside the disabled Configure fieldset", () => {
  const fieldsetStart = formSource.indexOf("<fieldset");
  const fieldsetEnd = formSource.indexOf("</fieldset>", fieldsetStart);
  assert.ok(fieldsetStart > -1);
  assert.ok(fieldsetEnd > fieldsetStart);
  const fieldsetSource = formSource.slice(fieldsetStart, fieldsetEnd);
  assert.doesNotMatch(
    fieldsetSource,
    /OrderSummary|handleSubmit|Retry submission/,
  );
  assert.match(
    formSource,
    /hasFinalizationRetryContext \|\|\s*\(configurationValid &&\s*orderTerms\.accepted &&\s*orderTerms\.earlyPerformanceRequested\)/,
  );
});

test("renovation IDs and priceKeys remain transactionally identical", () => {
  assert.deepEqual(
    RENOVATION_INTERNAL_OPTIONS.map((option) => [option.id, option.priceKey]),
    EXPECTED_INTERNAL_IDENTITIES,
  );
  assert.deepEqual(
    RENOVATION_EXTERNAL_OPTIONS.map((option) => [option.id, option.priceKey]),
    EXPECTED_EXTERNAL_IDENTITIES,
  );
});

test("every renovation option has presentation metadata and one Info action", () => {
  const options = [
    ...RENOVATION_INTERNAL_OPTIONS,
    ...RENOVATION_EXTERNAL_OPTIONS,
  ];
  assert.equal(options.length, 27);
  assert.equal(new Set(options.map((option) => option.mediaKey)).size, 27);
  for (const option of options) {
    assert.equal(option.mediaKey, `virtual-renovation-option-${option.id}`);
    assert.ok(option.description.trim().length > 0);
  }
  assert.equal(itemCardSource.match(/options\.map\(/g)?.length, 1);
  assert.match(itemCardSource, /onPreview\(option\.id\)/);
  assert.match(
    itemCardSource,
    /aria-label={`View \$\{option\.label\} information and example`}/,
  );
  assert.match(itemCardSource, /<ExampleDialog/);
  assert.match(itemCardSource, /showMissingMediaPlaceholder/);
});

test("each item keeps existing uploads and hierarchy without nested scrolling", () => {
  const originalPhoto = itemCardSource.indexOf('label="Upload Original Photo"');
  const selection = itemCardSource.indexOf("Renovation Selection");
  const details = itemCardSource.indexOf("Renovation Details");
  const references = itemCardSource.indexOf("References");
  const additionalInformation = itemCardSource.indexOf("Additional Information");
  const subtotal = itemCardSource.indexOf("<ItemSubtotal");
  assert.ok(originalPhoto > -1);
  assert.ok(selection > originalPhoto);
  assert.ok(details > selection);
  assert.ok(references > details);
  assert.ok(additionalInformation > references);
  assert.ok(subtotal > additionalInformation);
  assert.equal(itemCardSource.match(/<FileUpload/g)?.length, 1);
  assert.match(itemCardSource, /<ReferenceFilesUploader/);
  assert.match(itemCardSource, /files=\{displayedReferenceFiles\}/);
  assert.doesNotMatch(itemCardSource, /max-h-64|overflow-y-auto/);
  assert.doesNotMatch(
    itemCardSource,
    /URL\.createObjectURL|CurrentPhotoPreview|activePhoto|activePreview/,
  );
});

test("renovation rows and style choices use the compact shared visual language", () => {
  assert.match(itemCardSource, /min-h-11/);
  assert.match(itemCardSource, /@min-\[42rem\]:grid-cols-2/);
  assert.doesNotMatch(itemCardSource, /min-h-16/);
  assert.match(itemCardSource, /<StyleSelector/);
  assert.match(itemCardSource, /cards=\{RENOVATION_VISUAL_STYLE_CARDS\}/);
  assert.match(itemCardSource, /compact/);
  assert.match(itemCardSource, /STAGING_STYLE_CARDS\.find/);
  assert.match(
    formSource,
    /<div className="space-y-7">[\s\S]*?<RenovationItemCard/,
  );
  assert.match(
    formSource,
    /<OrderReviewAction[\s\S]*?onClick=\{\(\) => void goToReview\(\)\}[\s\S]*?disabled=\{!canReview\}/,
  );
});

test("Review remains UI-only and does not change the Renovation draft schema", () => {
  assert.equal(VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION, 1);
  assert.equal(VIRTUAL_RENOVATION_DRAFT_STEP, "configure");
});
