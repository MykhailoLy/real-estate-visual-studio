import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

const layoutSource = source("src/components/order/OrderLayout.tsx");
const guideSource = source("src/components/order/OrderGuideRail.tsx");
const actionSource = source("src/components/order/OrderReviewAction.tsx");

const flows = [
  {
    name: "Virtual Staging",
    path: "src/components/order/virtual-staging/VirtualStagingOrderForm.tsx",
    guideVariable: "guide",
  },
  {
    name: "Virtual Renovation",
    path: "src/components/order/virtual-renovation/VirtualRenovationOrderForm.tsx",
    guideVariable: "requirementsRail",
  },
  {
    name: "Day to Dusk",
    path: "src/components/order/day-to-dusk/DayToDuskOrderForm.tsx",
    guideVariable: "guide",
  },
  {
    name: "Single Exposure",
    path: "src/components/order/image-enhancement/SingleExposureOrderForm.tsx",
    guideVariable: "guide",
  },
  {
    name: "Item Removal",
    path: "src/components/order/item-removal/ItemRemovalOrderForm.tsx",
    guideVariable: "guide",
  },
  {
    name: "Photo Editing",
    path: "src/components/order/photo-editing/PhotoEditingOrderForm.tsx",
    guideVariable: "guide",
  },
] as const;

test("OrderLayout uses one bounded guide column and a flexible form", () => {
  assert.match(
    layoutSource,
    /lg:grid-cols-\[300px_minmax\(0,1fr\)\] lg:gap-6/,
  );
  assert.match(
    layoutSource,
    /xl:grid-cols-\[320px_minmax\(0,1fr\)\] xl:gap-8/,
  );
  assert.match(layoutSource, /<div className=\{cn\("min-w-0"/);
  assert.match(layoutSource, /lg:sticky lg:top-8/);
  assert.doesNotMatch(layoutSource, /grid-cols-\[[^\]]+_[^\]]+_340px\]/);
});

test("one shared guide owns mobile, tablet and desktop behavior", () => {
  assert.match(guideSource, /<details className="[^"]*md:hidden/);
  assert.match(guideSource, /<summary className="[^"]*min-h-11/);
  assert.match(guideSource, /Before you start/);
  assert.match(guideSource, /md:block lg:hidden/);
  assert.match(guideSource, /hidden border-l[^"]*lg:block/);
  assert.match(guideSource, /<GuideSteps steps=\{steps\} layout="horizontal" \/>/);
  assert.equal(
    (guideSource.match(/<GuideSteps steps=\{steps\} layout="vertical" \/>/g) ?? [])
      .length,
    2,
  );
  assert.doesNotMatch(guideSource, /useState|matchMedia|resize/);
});

test("all scoped configure stages use the shared guide and no summary column", () => {
  for (const flow of flows) {
    const form = source(flow.path);
    assert.equal((form.match(/<OrderGuideRail/g) ?? []).length, 1, flow.name);
    assert.match(form, /const \w+ = !isReview \? \(/, flow.name);
    assert.match(
      form,
      new RegExp(`leadingRail=\\{${flow.guideVariable}\\}`),
      flow.name,
    );
    assert.match(
      form,
      /workspaceVariant=\{isReview \? undefined : "wide"\}/,
      flow.name,
    );
    assert.equal((form.match(/<OrderSummary/g) ?? []).length, 1, flow.name);
    assert.equal((form.match(/<OrderReviewAction/g) ?? []).length, 1, flow.name);
    assert.doesNotMatch(form, /compactLeadingRail|variant="compact"/, flow.name);
  }
});

test("Review keeps the existing summary and never receives guide space", () => {
  for (const flow of flows) {
    const form = source(flow.path);
    assert.match(form, /isReview \? \([\s\S]*?<OrderSummary/, flow.name);
    assert.match(form, /onSubmit=\{handleSubmit\}/, flow.name);
    assert.doesNotMatch(
      form,
      new RegExp(`const ${flow.guideVariable} = isReview`),
      flow.name,
    );
  }
});

test("configure Review Order actions preserve their existing handlers and gates", () => {
  assert.match(actionSource, /onClick=\{onClick\}/);
  assert.match(actionSource, /disabled=\{disabled\}/);

  const staging = source(flows[0].path);
  const renovation = source(flows[1].path);
  const dayToDusk = source(flows[2].path);
  const singleExposure = source(flows[3].path);
  const itemRemoval = source(flows[4].path);
  const photoEditing = source(flows[5].path);

  assert.match(staging, /<OrderReviewAction onClick=\{goToReview\} disabled=\{!canReview\}>/);
  assert.match(
    renovation,
    /<OrderReviewAction[\s\S]*?onClick=\{\(\) => void goToReview\(\)\}[\s\S]*?disabled=\{!canReview\}/,
  );
  assert.match(
    dayToDusk,
    /<OrderReviewAction[\s\S]*?onClick=\{goToReview\}[\s\S]*?disabled=\{!configureValid \|\| fileOperationActive\}/,
  );
  assert.match(
    singleExposure,
    /<OrderReviewAction[\s\S]*?onClick=\{goToReview\}[\s\S]*?disabled=\{!configureValid \|\| fileOperationActive\}/,
  );
  assert.match(itemRemoval, /<OrderReviewAction onClick=\{goToReview\}>/);
  assert.match(
    itemRemoval.slice(
      itemRemoval.indexOf("const goToReview = () =>"),
      itemRemoval.indexOf("const goToConfigureTop"),
    ),
    /if \(!configureValid\)/,
  );
  assert.match(photoEditing, /<OrderReviewAction onClick=\{goToReview\} disabled=\{!canReview\}>/);
});

test("all configure pages opt into the existing wide dashboard workspace", () => {
  const pages = [
    "src/app/(dashboard)/dashboard/orders/new/virtual-staging/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/virtual-renovation/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/day-to-dusk/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/image-enhancement/single-exposure/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/item-removal-virtual-cleaning/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/photo-editing/page.tsx",
  ];

  for (const path of pages) {
    assert.match(source(path), /max-w-\[1800px\]/, path);
  }
});

test("Virtual Renovation no longer carries a parallel guide implementation", () => {
  assert.equal(
    existsSync(
      "src/components/order/virtual-renovation/VirtualRenovationRequirements.tsx",
    ),
    false,
  );
});
