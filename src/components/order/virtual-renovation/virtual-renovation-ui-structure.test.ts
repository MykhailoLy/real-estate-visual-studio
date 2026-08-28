import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const formSource = readFileSync(
  new URL("./VirtualRenovationOrderForm.tsx", import.meta.url),
  "utf8",
);
const itemCardSource = readFileSync(
  new URL("./RenovationItemCard.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL(
    "../../../app/(dashboard)/dashboard/orders/new/virtual-renovation/page.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("Virtual Renovation uses the wide single-step workspace with one submit owner", () => {
  assert.match(pageSource, /max-w-\[1800px\]/);
  assert.match(formSource, /workspaceVariant="wide"/);
  assert.match(formSource, /\beditorial\b/);
  assert.equal(formSource.match(/<OrderSummary/g)?.length, 1);
  assert.match(formSource, /sidebar=\{[\s\S]*?<OrderSummary/);
  assert.match(formSource, /onSubmit=\{handleSubmit\}/);
  assert.doesNotMatch(formSource, /Review Order|goToReview/);
});

test("preparation guidance follows Job Title and does not duplicate the review notice", () => {
  const jobTitle = formSource.indexOf("<OrderJobTitleField");
  const preparation = formSource.indexOf("<PreparationInformation />");
  const reviewNotice = formSource.indexOf("Some renovation edits may require custom review");

  assert.ok(jobTitle > -1);
  assert.ok(preparation > jobTitle);
  assert.ok(reviewNotice > preparation);
  assert.equal(formSource.match(/Some renovation edits may require custom review/g)?.length, 1);
  assert.match(formSource, /lg:grid-cols-3/);
});

test("each image keeps the requested information hierarchy", () => {
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
});

test("renovation options use natural scrolling and available item width", () => {
  assert.match(itemCardSource, /className="@container/);
  assert.match(itemCardSource, /@min-\[58rem\]:grid-cols-2/);
  assert.doesNotMatch(itemCardSource, /max-h-64|overflow-y-auto/);
  assert.equal(itemCardSource.match(/type="checkbox"/g)?.length, 2);
  assert.equal(itemCardSource.match(/cursor-pointer/g)?.length, 2);
  assert.equal(
    itemCardSource.match(/getCatalogPrice\(opt\.priceKey, currency\)/g)?.length,
    2,
  );
  assert.match(itemCardSource, /<RegionalCentsText/);
});

test("the item reuses FileUpload without a second preview system", () => {
  assert.equal(itemCardSource.match(/<FileUpload/g)?.length, 2);
  assert.doesNotMatch(
    itemCardSource,
    /URL\.createObjectURL|CurrentPhotoPreview|activePhoto|activePreview/,
  );
  assert.doesNotMatch(itemCardSource, /presentationVariant=/);
});
