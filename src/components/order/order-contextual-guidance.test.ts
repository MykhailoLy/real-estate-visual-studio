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
    guidePath:
      "src/components/order/virtual-renovation/VirtualRenovationRequirements.tsx",
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
    const guideOwner = source(
      "guidePath" in flow ? flow.guidePath : flow.path,
    );
    assert.equal(
      (guideOwner.match(/<OrderGuideRail/g) ?? []).length,
      1,
      flow.name,
    );
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
  const workspace = source(
    "src/components/dashboard/client-portal-workspace.ts",
  );
  const pages = [
    "src/app/(dashboard)/dashboard/orders/new/virtual-staging/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/virtual-renovation/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/day-to-dusk/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/image-enhancement/single-exposure/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/item-removal-virtual-cleaning/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/photo-editing/page.tsx",
    "src/app/(dashboard)/dashboard/orders/new/3d-floor-plans/page.tsx",
  ];

  assert.match(workspace, /max-w-\[1800px\]/);
  for (const path of pages) {
    assert.match(source(path), /<ClientDashboardLayout flush>/, path);
  }
});

test("Virtual Renovation preserves its requirements through the shared guide", () => {
  const requirementsPath =
    "src/components/order/virtual-renovation/VirtualRenovationRequirements.tsx";
  assert.equal(
    existsSync(requirementsPath),
    true,
  );
  const requirements = source(requirementsPath);
  assert.match(requirements, /from "@\/components\/order\/OrderGuideRail"/);
  assert.equal((requirements.match(/<OrderGuideRail/g) ?? []).length, 1);
  assert.match(requirements, /high-resolution original image/);
  assert.match(requirements, /build changes, fixture\s+changes, furniture, materials, textures and colour direction/);
  assert.match(requirements, /Reference images, links or mark-up sketches/);
  assert.match(requirements, /Complex reconstruction or unclear source material/);
  assert.match(requirements, /JPG, JPEG or PNG/);
  assert.match(requirements, /JPG, JPEG, PNG, WebP or PDF/);
  assert.doesNotMatch(
    requirements,
    /<details|<aside|compact|md:hidden|lg:hidden|useState|matchMedia/,
  );
});

test("Floor Plans uses the guide while preserving one direct-submit summary", () => {
  const form = source(
    "src/components/order/floor-plans/FloorPlansOrderForm.tsx",
  );
  assert.equal((form.match(/<OrderGuideRail/g) ?? []).length, 1);
  assert.match(form, /title: "Upload"/);
  assert.match(form, /title: "Configure"/);
  assert.match(form, /title: "Submit"/);
  assert.match(form, /leadingRail=\{guide\}/);
  assert.match(form, /workspaceVariant="wide"/);
  assert.equal((form.match(/<OrderSummary/g) ?? []).length, 1);
  assert.match(form, /onSubmit=\{handleSubmit\}/);
  assert.match(form, /serviceType: "3d-floor-plans"/);
  assert.match(
    form,
    /canSubmit=\{canSubmit \|\| finalizationRetryContext !== null\}/,
  );
  assert.ok(form.indexOf("</fieldset>") < form.indexOf("<OrderSummary"));
  assert.doesNotMatch(
    form,
    /OrderReviewAction|OrderStepIndicator|TWO_STEP_ORDER_STEPS|setStep/,
  );
});

test("Order Detail uses a factual overview and preserves authenticated job flows", () => {
  const detail = source(
    "src/app/(dashboard)/dashboard/jobs/[orderId]/page.tsx",
  );
  const overview = detail.indexOf("<JobDetailsCard");
  const payment = detail.indexOf("<OrderPaymentPanel");
  const workspace = detail.indexOf("data-order-detail-workspace");
  assert.ok(overview > -1 && payment > overview && workspace === -1);
  assert.match(detail, /grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6/);
  assert.match(detail, /<JobDetailsCard \{\.\.\.jobDetailsProps\} \/>/);
  assert.match(detail, /<DeliveryCard/);
  assert.match(detail, /label="Completed" value="—"/);
  assert.match(detail, /label="Cost" value=\{totalValue\} strong/);
  assert.match(detail, /aria-label=\{`Order progress: \$\{value\}%`\}/);
  assert.doesNotMatch(detail, /OrderDetailContext|data-order-context|deriveEstimatedCompletion|parsePricingSnapshot/);
  assert.equal((detail.match(/<OrderPaymentPanel/g) ?? []).length, 1);
  assert.doesNotMatch(detail, /secondaryHref="\/dashboard\/jobs"/);
  assert.match(
    detail,
    /const authoritativeTotal =[\s\S]*?paymentSummary\?\.finalTotalCents != null && paymentSummary\.currency != null[\s\S]*?cents: paymentSummary\.finalTotalCents[\s\S]*?currency: paymentSummary\.currency/,
  );
  assert.match(
    detail,
    /authoritativeTotal[\s\S]*?formatStoredMoney\(authoritativeTotal\.cents, authoritativeTotal\.currency\)[\s\S]*?formatStoredMoney\(order\.estimated_total_cents, order\.currency\)/,
  );
  assert.match(detail, /label="Download completed job"/);
  assert.match(detail, /Download the available delivered files as a ZIP\./);
  assert.match(detail, /Files will appear here when ready\./);
  assert.match(detail, /<ClientOrderImageCard/);
  assert.match(detail, /<DeliverableReviewActions/);
  assert.match(detail, /getDashboardRequestUser\(\)/);
  assert.match(detail, /if \(!user \|\| user\.isQaPreview\) notFound\(\);/);
  assert.match(detail, /toOrderOwnership\(user\)/);
  assert.match(detail, /getOrderForClient\(orderId, ownership\)/);
  assert.match(detail, /getClientSourceFilesForOrder\(order\.id, ownership\)/);
  assert.match(detail, /getDeliverablesForClient\(ownership\)/);
  assert.match(detail, /getReviewsForClient\(ownership\)/);
  assert.match(detail, /getAuthoritativePaymentSummary\(order\.id, user\.id/);
  assert.match(detail, /expectedStripeLivemode/);

  const imageCard = source("src/components/dashboard/ClientOrderImageCard.tsx");
  assert.match(imageCard, /Original \/ Before/);
  assert.match(imageCard, /Delivered \/ After/);
  assert.match(imageCard, /Edits \/ options/);
  assert.match(
    imageCard,
    /\/api\/client\/orders\/\$\{orderId\}\/source-files\/\$\{originalSource\.id\}\/download-url/,
  );
  assert.match(
    imageCard,
    /\/api\/client\/deliverables\/\$\{deliverable\.id\}\/download-url/,
  );
  assert.match(imageCard, /<DeliverableReviewActions/);

  const itemDetails = source("src/components/order/OrderItemDetails.tsx");
  assert.match(itemDetails, /variant\?: "default" \| "specification"/);
  assert.match(itemDetails, /variant === "specification"/);

  const paymentPanel = source("src/components/payments/OrderPaymentPanel.tsx");
  assert.match(paymentPanel, /fetch\("\/api\/payments\/checkout", \{/);
  assert.match(paymentPanel, /body: JSON\.stringify\(\{ orderId \}\)/);
  assert.match(paymentPanel, /getStripeCheckoutRedirectUrl\(body\?\.url\)/);
  assert.match(paymentPanel, /presentation\?: "default" \| "order-detail"/);

  const reviewActions = source(
    "src/components/dashboard/DeliverableReviewActions.tsx",
  );
  assert.match(
    reviewActions,
    /\/api\/client\/deliverables\/\$\{deliverableId\}\/review/,
  );
  assert.match(reviewActions, /action: "rework_requested"/);
});
