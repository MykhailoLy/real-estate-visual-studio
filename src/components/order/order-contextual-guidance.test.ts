import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  canShowCompletedReworkAction,
  isOneToOneImageEditingPresentation,
} from "../../lib/client-order-item-presentation.ts";

const source = (path: string) => readFileSync(path, "utf8");

const layoutSource = source("src/components/order/OrderLayout.tsx");
const guideSource = source("src/components/order/OrderGuideRail.tsx");
const actionSource = source("src/components/order/OrderReviewAction.tsx");
const imageWorkspaceSource = source(
  "src/components/order/OrderImageWorkspace.tsx",
);
const fileUploadSource = source("src/components/order/FileUpload.tsx");
const imageCardHeaderSource = source(
  "src/components/order/OrderImageCardHeader.tsx",
);

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

test("OrderLayout puts the guide above wide workspaces and preserves the non-wide fallback", () => {
  assert.match(
    layoutSource,
    /const hasInlineGuide = hasLeadingRail && isWideWorkspace/,
  );
  assert.match(
    layoutSource,
    /\{hasInlineGuide && <div className="mb-7 lg:mb-8">\{leadingRail\}<\/div>\}/,
  );
  assert.match(layoutSource, /lg:grid-cols-\[300px_minmax\(0,1fr\)\] lg:gap-6/);
  assert.match(layoutSource, /xl:grid-cols-\[320px_minmax\(0,1fr\)\] xl:gap-8/);
  assert.match(layoutSource, /<div className=\{cn\("min-w-0"/);
  assert.match(layoutSource, /hasLeadingRail && !isWideWorkspace/);
  assert.doesNotMatch(layoutSource, /grid-cols-\[[^\]]+_[^\]]+_340px\]/);
});

test("one collapsed native guide owns mobile, tablet and desktop behavior", () => {
  assert.equal((guideSource.match(/<details/g) ?? []).length, 1);
  assert.match(guideSource, /<summary className="[^"]*min-h-11/);
  assert.match(guideSource, />\s*Order guide\s*</);
  assert.match(guideSource, /md:grid-cols-3/);
  assert.match(guideSource, /grid-cols-\[2rem_minmax\(0,1fr\)\][^"]*md:block/);
  assert.doesNotMatch(guideSource, /<aside|md:hidden|lg:hidden|\sopen(?:=|>)/);
  assert.doesNotMatch(guideSource, /useState|matchMedia|resize/);
});

test("shared image workspace uses a fluid 40/60 desktop split only for previews", () => {
  assert.match(imageWorkspaceSource, /hasPreview: boolean/);
  assert.match(
    imageWorkspaceSource,
    /hasPreview &&[\s\S]*lg:grid-cols-\[minmax\(0,2fr\)_minmax\(0,3fr\)\]/,
  );
  assert.match(imageWorkspaceSource, /lg:sticky lg:top-20/);
  assert.doesNotMatch(imageWorkspaceSource, /w-\[\d+px\]|width:\s*\d/);
});

test("workspace uploads render one contained local or persisted preview with compact actions", () => {
  const workspacePreview = fileUploadSource.slice(
    fileUploadSource.indexOf("function WorkspaceImagePreview"),
    fileUploadSource.indexOf("function PersistedFilePreview"),
  );
  assert.match(fileUploadSource, /URL\.createObjectURL\(file\)/);
  assert.match(
    fileUploadSource,
    /previewUrl \?\? \(!file \? persistedImagePreviewUrl/,
  );
  assert.match(fileUploadSource, /isPreviewableImageFilename\(persistedFile\.filename\)/);
  assert.match(workspacePreview, /data-order-image-preview/);
  assert.match(workspacePreview, /aspect-\[4\/3\]/);
  assert.match(workspacePreview, /object-contain object-center/);
  assert.match(workspacePreview, /loading="lazy"/);
  assert.doesNotMatch(workspacePreview, /object-cover/);
  assert.match(
    fileUploadSource,
    /className="min-h-11[^"]*"[\s\S]*?\{replaceLabel\}/,
  );
  assert.match(fileUploadSource, /flex flex-wrap items-center justify-end gap-2/);
  assert.match(fileUploadSource, />\s*Remove\s*<\/button>/);
  assert.doesNotMatch(fileUploadSource, /col-span-2/);
});

test("image cards use one prominent count heading without filename chrome", () => {
  assert.match(imageCardHeaderSource, /Image \{index \+ 1\} of \{totalItems\}/);
  assert.match(imageCardHeaderSource, /text-xl[^\"]*font-extrabold[^\"]*uppercase/);
  assert.doesNotMatch(imageCardHeaderSource, /filename|Waiting for file|rounded-lg/);
});

test("every active image-input card uses the shared workspace without service-name branching", () => {
  const cards = [
    "src/components/order/virtual-staging/StagingItemCard.tsx",
    "src/components/order/virtual-renovation/RenovationItemCard.tsx",
    "src/components/order/photo-editing/PhotoEditItemCard.tsx",
    "src/components/order/image-enhancement/SingleExposureItemCard.tsx",
    "src/components/order/day-to-dusk/DayToDuskItemCard.tsx",
    "src/components/order/item-removal/ItemRemovalItemCard.tsx",
    "src/components/order/floor-plans/FloorPlanItemCard.tsx",
  ];

  for (const path of cards) {
    const card = source(path);
    assert.equal((card.match(/<OrderImageWorkspace/g) ?? []).length, 1, path);
    assert.match(card, /hasFileUploadPreview\(/, path);
    assert.equal(
      (card.match(/presentationVariant="workspace"/g) ?? []).length,
      1,
      path,
    );
    assert.match(card, /totalItems: number/, path);
    assert.match(card, /totalItems=\{totalItems\}/, path);
  }

  assert.doesNotMatch(
    imageWorkspaceSource + fileUploadSource,
    /Virtual Staging|Virtual Renovation|Photo Editing|Day to Dusk|Item Removal/,
  );
});

test("all scoped configure stages use the shared guide and no summary column", () => {
  for (const flow of flows) {
    const form = source(flow.path);
    const guideOwner = source("guidePath" in flow ? flow.guidePath : flow.path);
    assert.match(form, /totalItems=\{items\.length\}/, flow.name);
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
    assert.equal(
      (form.match(/<OrderReviewAction/g) ?? []).length,
      1,
      flow.name,
    );
    assert.doesNotMatch(
      form,
      /compactLeadingRail|variant="compact"/,
      flow.name,
    );
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

  assert.match(
    staging,
    /<OrderReviewAction onClick=\{goToReview\} disabled=\{!canReview\}>/,
  );
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
  assert.match(
    photoEditing,
    /<OrderReviewAction onClick=\{goToReview\} disabled=\{!canReview\}>/,
  );
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
  assert.equal(existsSync(requirementsPath), true);
  const requirements = source(requirementsPath);
  assert.match(requirements, /from "@\/components\/order\/OrderGuideRail"/);
  assert.equal((requirements.match(/<OrderGuideRail/g) ?? []).length, 1);
  assert.match(requirements, /high-resolution original image/);
  assert.match(
    requirements,
    /build changes, fixture\s+changes, furniture, materials, textures and colour direction/,
  );
  assert.match(requirements, /Reference images, links or mark-up sketches/);
  assert.match(
    requirements,
    /Complex reconstruction or unclear source material/,
  );
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

test("paired Job Detail presentation keeps item-local reference files", () => {
  assert.equal(
    isOneToOneImageEditingPresentation({
      details: { sub_service: "day-to-dusk" },
      hasOriginalSource: true,
      deliverableCount: 0,
    }),
    true,
  );
  assert.equal(
    isOneToOneImageEditingPresentation({
      details: { sub_service: "image-enhancement" },
      hasOriginalSource: true,
      deliverableCount: 1,
    }),
    true,
  );
});

test("paired Job Detail presentation leaves generic, multi-result, and incomplete items on the fallback", () => {
  const base = {
    details: { sub_service: "image-enhancement" },
    hasOriginalSource: true,
    deliverableCount: 0,
  };

  assert.equal(
    isOneToOneImageEditingPresentation({ ...base, details: {} }),
    false,
  );
  assert.equal(
    isOneToOneImageEditingPresentation({ ...base, deliverableCount: 2 }),
    false,
  );
  assert.equal(
    isOneToOneImageEditingPresentation({ ...base, hasOriginalSource: false }),
    false,
  );
});

test("Job Detail shows rework only for delivered or completed files", () => {
  assert.equal(canShowCompletedReworkAction("delivered", true), true);
  assert.equal(canShowCompletedReworkAction("completed", true), true);
  assert.equal(canShowCompletedReworkAction("in-progress", true), false);
  assert.equal(canShowCompletedReworkAction("pending", true), false);
  assert.equal(canShowCompletedReworkAction("delivered", false), false);
});

test("Order Detail leads with its summary and preserves authenticated job flows", () => {
  const detail = source(
    "src/app/(dashboard)/dashboard/jobs/[orderId]/page.tsx",
  );
  const summary = detail.indexOf("data-job-summary");
  const overview = detail.indexOf("<JobDetailsCard", summary);
  const payment = detail.indexOf("<OrderPaymentPanel");
  const workflow = detail.indexOf("data-order-workflow");
  const activity = detail.indexOf("order-activity-heading");
  assert.ok(
    summary > -1 &&
      overview > summary &&
      payment > overview &&
      workflow > payment &&
      activity > workflow,
  );
  assert.match(detail, /<JobDetailsCard \{\.\.\.jobDetailsProps\} \/>/);
  assert.match(detail, /<DeliveryCard/);
  assert.match(detail, /function PaymentDetailsUnavailableCard\(\)/);
  assert.match(detail, /Payment details unavailable/);
  assert.match(
    detail,
    /paymentSummary === null \|\| paymentSummary\?\.state === "not_available"[\s\S]*?<PaymentDetailsUnavailableCard \/>/,
  );
  assert.match(
    detail,
    /const hasPaymentAction =[\s\S]*?paymentSummary\?\.state === "payment_required" \|\| paymentSummary\?\.state === "processing"/,
  );
  assert.match(detail, /<section aria-labelledby="action-required-heading"/);
  assert.match(detail, /Action required[\s\S]*?<OrderPaymentPanel/);
  const deliveryStateStart = detail.indexOf("const deliveryPaymentState");
  const deliveryStateSource = detail.slice(
    deliveryStateStart,
    detail.indexOf("const hasSummarySideCard", deliveryStateStart),
  );
  assert.match(deliveryStateSource, /paymentSummary\?\.state === "paid"/);
  assert.match(
    deliveryStateSource,
    /paymentSummary\?\.state === "no_payment_required"/,
  );
  assert.match(
    deliveryStateSource,
    /paymentSummary\?\.state === "partially_refunded"/,
  );
  assert.match(deliveryStateSource, /paymentSummary\?\.state === "refunded"/);
  assert.doesNotMatch(deliveryStateSource, /not_available/);
  assert.doesNotMatch(detail, /label="Completed" value="—"/);
  assert.doesNotMatch(detail, /label="Job \/ service"/);
  assert.match(detail, /label="Reference"/);
  assert.match(detail, /label="Status"/);
  assert.match(detail, /label="Submitted"/);
  assert.match(detail, /label="Order total"/);
  assert.doesNotMatch(detail, /label="Completed"|label="Delivered"/);
  assert.doesNotMatch(detail, /completed_at|delivered_at/);
  assert.doesNotMatch(detail, /label="Images \/ items"/);
  assert.doesNotMatch(detail, /label="Company"/);
  assert.match(detail, /data-job-details-card/);
  assert.match(detail, /data-job-summary[\s\S]*?items-start/);
  assert.match(
    detail,
    /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/,
  );
  assert.match(detail, /showProgress: progress > 0 && progress < 100/);
  assert.match(detail, /toLocaleString\("en-GB"/);
  assert.match(detail, /hour: "2-digit"/);
  assert.match(detail, /minute: "2-digit"/);
  assert.match(detail, /orderNumber: order\.order_number/);
  assert.match(detail, /statusBadge: <StatusBadge status=\{dashStatus\} \/>/);
  assert.match(
    detail,
    /paymentSummary\?\.state === "payment_required" \|\| paymentSummary\?\.state === "processing"[\s\S]*?\? null/,
  );
  assert.match(detail, /aria-label=\{`Order progress: \$\{value\}%`\}/);
  assert.doesNotMatch(
    detail,
    /OrderDetailContext|data-order-context|deriveEstimatedCompletion|calculateOrderQuote|getPartnerClient/,
  );
  assert.match(detail, /pricing && pricing\.partnerDiscountCents > 0 &&/);
  assert.match(detail, /parsePricingSnapshot\(order\.pricing_snapshot\)/);
  assert.match(
    detail,
    /storedPricing\.totalCents === order\.estimated_total_cents/,
  );
  assert.match(detail, /pricing\.partnerDiscountCents/);
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
  assert.match(detail, /Download<\/span> a ZIP of your completed job\./);
  assert.match(detail, /Files will appear here when ready\./);
  assert.match(detail, /label="Download"/);
  assert.match(detail, /presentation="primary"/);
  assert.match(detail, /bg-secondary[^\"]*text-white/);
  assert.ok(detail.indexOf("Contact support") > workflow);
  const workflowHeader = detail.slice(
    workflow,
    detail.indexOf("{order.items.length > 0 ?"),
  );
  assert.match(workflowHeader, /Your images/);
  assert.match(workflowHeader, /Image workflow/);
  assert.doesNotMatch(workflowHeader, /BulkDownloadButton/);
  assert.match(detail, /<ClientOrderImageCard/);
  assert.match(detail, /<DeliverableReviewActions/);
  assert.match(
    detail,
    /const canShowCompletedRework = canShowCompletedReworkAction\(/,
  );
  assert.match(detail, /const reworkEligibleDeliverables = canShowCompletedRework/);
  assert.match(detail, /const singleSummaryReworkRow =/);
  assert.match(detail, /reworkAction=\{/);
  assert.match(detail, /hasMultipleReworkActions=\{hasMultipleReworkActions\}/);
  assert.match(detail, /href="#image-workflow"/);
  assert.match(detail, /id="image-workflow"/);
  assert.match(detail, /Choose a delivered file below to request adjustments\./);
  assert.match(detail, /Request changes/);
  assert.match(
    detail,
    /deliverable\.id !== singleSummaryReworkRow\?\.deliverable\.id/,
  );
  assert.match(detail, /presentation="delivery"/);
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
  assert.match(imageCard, /<WorkflowPanel title="Original">/);
  assert.match(imageCard, /<WorkflowPanel title="Delivered">/);
  assert.match(imageCard, /isOneToOneImageEditingPresentation/);
  assert.match(
    imageCard,
    /grid-cols-1 items-start gap-7 md:grid-cols-2 md:gap-6 lg:grid-cols-\[minmax\(0,7fr\)_minmax\(0,7fr\)_minmax\(16rem,6fr\)\]/,
  );
  assert.match(imageCard, /md:col-span-2 lg:col-span-1/);
  assert.match(imageCard, /Editing preferences and workflow status/);
  assert.match(imageCard, /Preferences \/ options/);
  assert.match(imageCard, /hasClientVisibleOrderItemDetails/);
  assert.match(imageCard, /<DeliveredPlaceholder \/>/);
  assert.match(imageCard, /Awaiting delivery/);
  assert.match(imageCard, /presentation="feature"/);
  assert.match(imageCard, /Reference files/);
  assert.match(imageCard, /canShowCompletedReworkAction/);
  assert.match(imageCard, /Need any changes\?/);
  assert.match(imageCard, /summaryReworkDeliverableId\?: string \| null/);
  assert.match(
    imageCard,
    /deliverable\.id !== summaryReworkDeliverableId/,
  );
  const deliveredPanel = imageCard.slice(
    imageCard.indexOf("const deliveredPanel"),
    imageCard.indexOf("return (", imageCard.indexOf("const deliveredPanel")),
  );
  assert.doesNotMatch(deliveredPanel, /actions=\{/);
  assert.ok(
    imageCard.indexOf("Preferences / options") < imageCard.indexOf("Workflow status"),
  );
  assert.doesNotMatch(imageCard, /LargePreviewFrame/);
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
  assert.match(itemDetails, /CLIENT_VISIBLE_KEYS/);
  assert.match(itemDetails, /BOOLEAN_KEYS/);
  assert.match(itemDetails, /hasClientVisibleOrderItemDetails/);

  const previewCard = source("src/components/FilePreviewCard.tsx");
  assert.match(previewCard, /presentation\?: "default" \| "feature"/);
  assert.match(
    previewCard,
    /fit=\{presentation === "feature" \? "contain" : "cover"\}/,
  );
  assert.match(previewCard, /object-contain/);
  assert.match(previewCard, /aspect-\[4\/3\]/);
  assert.match(
    previewCard,
    /usesImageOverlayDownload = presentation === "feature" && previewKind === "image"/,
  );
  assert.match(previewCard, /data-feature-image-frame/);
  assert.match(previewCard, /data-preview-control/);
  assert.match(previewCard, /data-download-control/);
  assert.match(previewCard, /bottom-4 left-1\/2/);
  assert.match(previewCard, /bg-secondary[^\"]*text-white/);
  assert.match(previewCard, />\s*Download\s*</);
  assert.ok(
    previewCard.indexOf("data-preview-control") < previewCard.indexOf("data-download-control"),
  );
  assert.match(previewCard, /\{usesImageOverlayDownload \? \(/);
  assert.match(previewCard, /data-feature-file-details/);
  assert.match(
    previewCard,
    /usesImageOverlayDownload \? \([\s\S]*?meta \|\| error \|\| actions/,
  );
  assert.doesNotMatch(previewCard, /mediaAspectRatio|onImageAspectRatio/);

  const globals = source("src/app/globals.css");
  assert.match(globals, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(globals, /\[data-feature-image-frame\]:focus-within/);
  assert.match(globals, /filter: brightness\(0\.88\)/);

  const paymentPanel = source("src/components/payments/OrderPaymentPanel.tsx");
  assert.match(paymentPanel, /fetch\("\/api\/payments\/checkout", \{/);
  assert.match(paymentPanel, /body: JSON\.stringify\(\{ orderId \}\)/);
  assert.match(paymentPanel, /getStripeCheckoutRedirectUrl\(body\?\.url\)/);
  assert.match(paymentPanel, /presentation\?: "default" \| "order-detail"/);
  assert.match(paymentPanel, /Payment required/);
  assert.match(
    paymentPanel,
    /\$\{summary\.itemCount\} \$\{summary\.itemCount === 1 \? "image" : "images"\}/,
  );

  const reviewActions = source(
    "src/components/dashboard/DeliverableReviewActions.tsx",
  );
  assert.match(
    reviewActions,
    /\/api\/client\/deliverables\/\$\{deliverableId\}\/review/,
  );
  assert.match(reviewActions, /action: "rework_requested"/);
  assert.match(
    reviewActions,
    /presentation\?: "default" \| "compact" \| "delivery"/,
  );
  assert.match(reviewActions, /isDelivery \? "Request changes" : "Request rework"/);
  assert.match(reviewActions, /!isCompact && !isDelivery/);

  const bulkDownload = source("src/components/BulkDownloadButton.tsx");
  assert.match(bulkDownload, /presentation\?: "default" \| "primary"/);
  assert.match(bulkDownload, /presentation === "primary"/);
  assert.match(bulkDownload, /bg-secondary[^\"]*text-white/);
});
