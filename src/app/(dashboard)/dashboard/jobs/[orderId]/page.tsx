import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import {
  ArrowLeft,
  CalendarDays,
  FileArchive,
  FolderOpen,
  Layers,
  LifeBuoy,
  PlusCircle,
  RotateCcw,
} from "lucide-react";
import BulkDownloadButton from "@/components/BulkDownloadButton";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import CopyOrderNumberButton from "@/components/dashboard/CopyOrderNumberButton";
import ClientOrderReviewCard from "@/components/dashboard/ClientOrderReviewCard";
import ClientOrderImageCard, {
  type ClientImageWorkflowStatus,
} from "@/components/dashboard/ClientOrderImageCard";
import DeliverableReviewActions from "@/components/dashboard/DeliverableReviewActions";
import StatusBadge from "@/components/dashboard/StatusBadge";
import FilePreviewCard from "@/components/FilePreviewCard";
import OrderPaymentPanel from "@/components/payments/OrderPaymentPanel";
import { getDashboardRequestUser } from "@/lib/dashboard-request-context";
import { canShowCompletedReworkAction } from "@/lib/client-order-item-presentation";
import { getDeliverablesForClient } from "@/lib/client-deliverables";
import { getClientOrderReviewForClient } from "@/lib/client-order-reviews";
import {
  getCurrentDeliverableRows,
  type CurrentDeliverableRow,
} from "@/lib/client-deliverable-display";
import {
  deriveDashboardStatusFromReviews,
  getOrderForClient,
  getProgressFromStatus,
} from "@/lib/client-orders";
import { getOrderServiceLabel } from "@/lib/display/service-labels";
import {
  getReviewsForClient,
  type DeliverableReview,
  type ReviewStatus,
} from "@/lib/client-reviews";
import {
  getClientSourceFilesForOrder,
  type ClientSourceFile,
} from "@/lib/client-source-files";
import { toOrderOwnership } from "@/lib/order-ownership";
import { formatBytes, itemLabel } from "@/lib/display/file-format";
import { formatStoredMoney } from "@/lib/pricing/format";
import { parsePricingSnapshot } from "@/lib/pricing/snapshot";
import { getStaticImageViewerVariantForService } from "@/components/media/static-image-variant";
import { createSupabaseCheckoutRepository } from "@/lib/payments/checkout-repository";
import { getAuthoritativePaymentSummary } from "@/lib/payments/payment-summary";
import { getExpectedStripeLivemode } from "@/lib/payments/stripe-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildClientJobImageGalleries } from "@/lib/client-job-image-navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return {
    title: `Order ${orderId.slice(0, 8).toUpperCase()} | PicchuSpot Client Portal`,
  };
}

function formatDisplayDate(iso: string): string {
  if (!iso || iso === "-" || iso === "Delivered") return iso || "-";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function groupCurrentDeliverablesByItem(
  rows: CurrentDeliverableRow[]
): Map<number, CurrentDeliverableRow[]> {
  const grouped = new Map<number, CurrentDeliverableRow[]>();
  for (const row of rows) {
    const itemIndex = row.deliverable.item_index;
    if (itemIndex === null) continue;
    const existing = grouped.get(itemIndex) ?? [];
    existing.push(row);
    grouped.set(itemIndex, existing);
  }
  return grouped;
}

function groupSourceFilesByItem(
  files: ClientSourceFile[]
): Map<number, ClientSourceFile[]> {
  const grouped = new Map<number, ClientSourceFile[]>();
  for (const file of files) {
    const existing = grouped.get(file.itemIndex) ?? [];
    existing.push(file);
    grouped.set(file.itemIndex, existing);
  }
  return grouped;
}

function getOrderLevelDeliverables(rows: CurrentDeliverableRow[]): CurrentDeliverableRow[] {
  return rows.filter((row) => row.deliverable.item_index === null);
}

function deriveImageWorkflowStatus(
  deliverables: CurrentDeliverableRow[],
  itemReviews: DeliverableReview[]
): ClientImageWorkflowStatus {
  const statuses = deliverables
    .map((row) => row.review?.status)
    .filter((status): status is ReviewStatus => Boolean(status));

  if (statuses.length === 0 && itemReviews.length > 0) {
    statuses.push(...itemReviews.map((review) => review.status));
  }

  if (statuses.includes("rework_requested")) return "pending_rework";
  if (statuses.includes("rework_in_progress")) return "rework_in_progress";
  if (statuses.includes("rework_delivered")) return "new_version_ready";
  if (statuses.includes("approved")) return "approved";
  if (statuses.includes("resolved")) return "resolved";

  return deliverables.length > 0 ? "ready_for_review" : "awaiting_delivery";
}

function latestRelevantComment(
  itemReviews: DeliverableReview[],
  status: ClientImageWorkflowStatus
): string | null {
  const statusMap: Partial<Record<ClientImageWorkflowStatus, ReviewStatus[]>> = {
    pending_rework: ["rework_requested"],
    rework_in_progress: ["rework_in_progress", "rework_requested"],
    new_version_ready: ["rework_delivered", "rework_requested"],
  };
  const relevantStatuses = statusMap[status];
  if (!relevantStatuses) return null;

  return itemReviews.find((review) =>
    review.comment &&
    relevantStatuses.includes(review.status)
  )?.comment ?? null;
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const fill =
    value === 100
      ? "bg-emerald-500"
      : value > 0
        ? "bg-blue-500"
        : "bg-slate-300";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${fill}`}
          style={{ width: `${value}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Order progress: ${value}%`}
        />
      </div>
      <span className="text-sm font-semibold text-foreground/70 tabular-nums w-10 text-right flex-shrink-0">
        {value}%
      </span>
    </div>
  );
}

interface JobDetailsCardProps {
  orderNumber: string;
  statusBadge: ReactNode;
  submittedLabel: string;
  totalValue: string | null;
  progress: number;
  progressMessage: ReactNode;
  showProgress: boolean;
}

function JobDetailsCard({
  orderNumber,
  statusBadge,
  submittedLabel,
  totalValue,
  progress,
  progressMessage,
  showProgress,
}: JobDetailsCardProps) {
  return (
    <section
      data-job-details-card
      aria-labelledby="job-details-heading"
      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <div className="border-b border-border px-4 py-2.5 sm:px-5">
        <h2
          id="job-details-heading"
          className="text-dashboard-section lg:text-lg font-bold text-primary"
        >
          Job details
        </h2>
      </div>
      <dl>
        <JobDetailsRow
          label="Reference"
          value={
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-mono">{orderNumber}</span>
              <CopyOrderNumberButton orderNumber={orderNumber} />
            </span>
          }
        />
        <JobDetailsRow label="Submitted" value={submittedLabel} />
        <JobDetailsRow label="Status" value={statusBadge} />
        {totalValue ? <JobDetailsRow label="Order total" value={totalValue} strong /> : null}
        {showProgress ? (
          <div className="grid min-w-0 grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] items-center gap-3 border-t border-border px-4 py-2.5 sm:px-5">
            <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
              Progress
            </dt>
            <dd className="min-w-0">
              <ProgressBar value={progress} />
              <p className="mt-1 text-dashboard-metadata text-muted">{progressMessage}</p>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function DeliveryCard({
  orderId,
  hasDeliverables,
  reworkAction,
  hasMultipleReworkActions,
}: {
  orderId: string;
  hasDeliverables: boolean;
  reworkAction: ReactNode;
  hasMultipleReworkActions: boolean;
}) {
  return (
    <section
      data-deliverables-card
      aria-labelledby="deliverables-heading"
      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <div className="border-b border-border px-4 py-2.5 sm:px-5">
        <h2
          id="deliverables-heading"
          className="text-dashboard-section font-bold text-primary lg:text-lg"
        >
          Deliverables
        </h2>
      </div>
      {hasDeliverables ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-4 bg-secondary/10 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 sm:px-5">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-secondary/35 bg-white text-secondary-dark shadow-sm">
            <FileArchive className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-dashboard-body text-foreground">
            <span className="font-bold">Download</span> a ZIP of your completed job.
          </p>
          <BulkDownloadButton
            endpoint={`/api/client/orders/${orderId}/deliverables/bulk-download`}
            label="Download"
            presentation="primary"
            className="col-span-2 w-full items-stretch sm:col-span-1 sm:w-auto sm:items-end"
          />
        </div>
      ) : (
        <p className="p-5 text-dashboard-body text-muted">
          Files will appear here when ready.
        </p>
      )}
      {reworkAction ? (
        <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
          <div>
            <p className="text-dashboard-action font-bold text-foreground">Need changes?</p>
            <p className="mt-1 text-dashboard-body text-muted">
              Request adjustments to the delivered result.
            </p>
          </div>
          <div className="w-full sm:w-auto">{reworkAction}</div>
        </div>
      ) : hasMultipleReworkActions ? (
        <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
          <div>
            <p className="text-dashboard-action font-bold text-foreground">Need changes?</p>
            <p className="mt-1 text-dashboard-body text-muted">
              Choose a delivered file below to request adjustments.
            </p>
          </div>
          <a
            href="#image-workflow"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-secondary bg-secondary px-5 py-2.5 text-dashboard-action font-bold uppercase tracking-[0.04em] text-white shadow-sm transition-colors hover:bg-secondary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Request changes
          </a>
        </div>
      ) : null}
    </section>
  );
}

function PaymentDetailsUnavailableCard() {
  return (
    <section
      aria-labelledby="payment-unavailable-heading"
      className="rounded-xl border border-border bg-white p-5 shadow-sm"
    >
      <h2
        id="payment-unavailable-heading"
        className="text-dashboard-section lg:text-lg font-bold text-primary"
      >
        Payment
      </h2>
      <p className="mt-5 text-sm font-semibold text-foreground">
        Payment details unavailable
      </p>
      <p className="mt-1 text-dashboard-body text-muted">
        We could not retrieve an authoritative payment status for this order.
      </p>
    </section>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getDashboardRequestUser();
  if (!user || user.isQaPreview) notFound();

  const ownership = toOrderOwnership(user);
  const order = await getOrderForClient(orderId, ownership);
  if (!order) notFound();
  const storedPricing = parsePricingSnapshot(order.pricing_snapshot);
  const pricing = storedPricing && !storedPricing.customQuote &&
    storedPricing.totalCents === order.estimated_total_cents &&
    storedPricing.currency === order.currency && storedPricing.serviceType === order.service_type
    ? storedPricing : null;

  let expectedStripeLivemode: boolean | null = null;
  try {
    expectedStripeLivemode = getExpectedStripeLivemode();
  } catch {
    console.error("[dashboard/order] Stripe mode is unavailable");
  }

  const [
    allDeliverables,
    allReviews,
    sourceFiles,
    paymentSummary,
    clientOrderReview,
  ] = await Promise.all([
    getDeliverablesForClient(ownership),
    getReviewsForClient(ownership),
    getClientSourceFilesForOrder(order.id, ownership),
    getAuthoritativePaymentSummary(order.id, user.id, {
      repository: createSupabaseCheckoutRepository(getSupabaseAdminClient()),
      expectedStripeLivemode,
    }),
    order.status === "delivered"
      ? getClientOrderReviewForClient(order.id, ownership)
      : Promise.resolve({ available: true, review: null }),
  ]);

  const orderDeliverables = allDeliverables.filter((deliverable) => deliverable.order_id === order.id);
  const orderReviews = allReviews.filter((review) => review.order_id === order.id);
  const currentDeliverables = getCurrentDeliverableRows(orderDeliverables, orderReviews);
  const imageDeliverables = groupCurrentDeliverablesByItem(currentDeliverables);
  const imageSourceFiles = groupSourceFilesByItem(sourceFiles);
  const orderLevelDeliverables = getOrderLevelDeliverables(currentDeliverables);
  const imageGalleries = buildClientJobImageGalleries({
    orderId: order.id,
    itemIndexes: order.items.map((item) => item.item_index),
    sourceFiles,
    currentDeliverables,
  });
  const canShowCompletedRework = canShowCompletedReworkAction(
    order.status,
    currentDeliverables.length > 0,
  );
  const reworkEligibleDeliverables = canShowCompletedRework
    ? currentDeliverables.filter(
        ({ review }) =>
          review?.status !== "rework_requested" && review?.status !== "rework_in_progress",
      )
    : [];
  const singleSummaryReworkRow =
    reworkEligibleDeliverables.length === 1 ? reworkEligibleDeliverables[0] : null;
  const hasMultipleReworkActions = reworkEligibleDeliverables.length > 1;

  const serviceLabel = getOrderServiceLabel(order.service_type, order.sub_service);
  const viewerVariant = getStaticImageViewerVariantForService(order.service_type);
  const jobTitle = order.job_title?.trim() || "";
  const hasDistinctJobTitle =
    jobTitle.length > 0 && jobTitle.toLocaleLowerCase() !== serviceLabel.toLocaleLowerCase();
  const dashStatus = deriveDashboardStatusFromReviews(order.status, orderReviews);
  const progress = getProgressFromStatus(order.status);
  const progressMessage = (
    <>
      {paymentSummary?.state === "payment_required" &&
        "Your order has been received. Payment is required before production can begin."}
      {paymentSummary?.state === "processing" &&
        "Your payment is processing. Production will not begin until payment is verified."}
      {paymentSummary?.state === "paid" &&
        order.status === "pending" &&
        "Payment is verified. Your order is awaiting confirmation."}
      {paymentSummary?.state === "no_payment_required" &&
        order.status === "pending" &&
        "No payment is required. Your order is awaiting confirmation and can then enter production."}
      {order.status === "pending" &&
        paymentSummary?.state !== "payment_required" &&
        paymentSummary?.state !== "processing" &&
        paymentSummary?.state !== "paid" &&
        paymentSummary?.state !== "no_payment_required" &&
        "Your order has been received and is awaiting confirmation."}
      {order.status === "confirmed" &&
        "Your order has been confirmed and will enter production soon."}
      {order.status === "in-progress" &&
        "Our team is currently working on your order."}
      {dashStatus === "pending-rework" &&
        "Your rework request is pending review by our team."}
      {dashStatus === "rework-in-progress" &&
        "Our team is working on your requested revisions."}
      {dashStatus === "new-version-ready" &&
        "A new version is ready for your review."}
      {order.status === "delivered" &&
        dashStatus === "completed" &&
        "Your order has been completed and delivered."}
      {order.status === "cancelled" && "This order has been cancelled."}
    </>
  );
  const authoritativeTotal =
    paymentSummary?.finalTotalCents != null && paymentSummary.currency != null
      ? {
          cents: paymentSummary.finalTotalCents,
          currency: paymentSummary.currency,
        }
      : null;
  const jobDetailsProps = {
    orderNumber: order.order_number,
    statusBadge: <StatusBadge status={dashStatus} />,
    submittedLabel: formatDisplayDate(order.created_at),
    totalValue:
      paymentSummary?.state === "payment_required" || paymentSummary?.state === "processing"
        ? null
        : authoritativeTotal
          ? formatStoredMoney(authoritativeTotal.cents, authoritativeTotal.currency)
          : formatStoredMoney(order.estimated_total_cents, order.currency),
    progress,
    progressMessage,
    showProgress: progress > 0 && progress < 100,
  } satisfies JobDetailsCardProps;
  const hasPaymentAction =
    paymentSummary?.state === "payment_required" || paymentSummary?.state === "processing";
  const deliveryPaymentState =
    paymentSummary?.state === "paid" ||
    paymentSummary?.state === "no_payment_required" ||
    paymentSummary?.state === "partially_refunded" ||
    paymentSummary?.state === "refunded"
      ? paymentSummary.state
      : null;
  const showReviewCard =
    order.status === "delivered" && clientOrderReview.available;
  const showPaymentUnavailableCard =
    !showReviewCard &&
    (paymentSummary === null || paymentSummary?.state === "not_available");
  const showDeliverablesCard = showReviewCard || deliveryPaymentState !== null;
  const hasSummarySideCard =
    showPaymentUnavailableCard || showDeliverablesCard;
  const summaryGridClass =
    showReviewCard && hasSummarySideCard
      ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-5"
      : hasSummarySideCard
        ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6"
        : "";

  return (
    <ClientDashboardLayout>
      <div className="mb-6">
        <ClientPortalLink
          href="/dashboard/jobs"
          className="inline-flex items-center gap-1.5 text-dashboard-action font-semibold text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to jobs
        </ClientPortalLink>
      </div>

      <div className="mb-8">
        <div>
          <p className="mb-1.5 text-dashboard-kicker uppercase font-bold text-secondary-dark">
            Order detail
          </p>
          <h1 className="text-2xl font-bold leading-tight text-primary sm:text-[28px]">
            {jobTitle || serviceLabel}
          </h1>
          {hasDistinctJobTitle && (
            <p className="mt-1 text-sm font-medium text-muted">{serviceLabel}</p>
          )}
        </div>
      </div>

      <div
        data-job-summary
        className={["mb-6 grid grid-cols-1 items-start gap-5", summaryGridClass].join(" ")}
      >
        <JobDetailsCard {...jobDetailsProps} />
        {showReviewCard ? (
          <ClientOrderReviewCard
            orderId={order.id}
            initialReview={clientOrderReview.review}
          />
        ) : null}
        {showPaymentUnavailableCard ? (
          <PaymentDetailsUnavailableCard />
        ) : showDeliverablesCard ? (
          <DeliveryCard
            orderId={order.id}
            hasDeliverables={currentDeliverables.length > 0}
            reworkAction={
              singleSummaryReworkRow ? (
                <DeliverableReviewActions
                  deliverableId={singleSummaryReworkRow.deliverable.id}
                  initialReviewStatus={singleSummaryReworkRow.review?.status ?? null}
                  initialComment={singleSummaryReworkRow.review?.comment ?? null}
                  filename={singleSummaryReworkRow.deliverable.filename}
                  presentation="delivery"
                />
              ) : null
            }
            hasMultipleReworkActions={hasMultipleReworkActions}
          />
        ) : null}
      </div>

      {pricing && pricing.partnerDiscountCents > 0 && (
        <section aria-labelledby="order-pricing-heading" className="mb-6 rounded-xl border border-border bg-white p-5 text-sm">
          <h2 id="order-pricing-heading" className="mb-3 font-semibold text-primary">Order pricing</h2>
          <dl className="space-y-2">
            {[
              ["Subtotal", pricing.baseSubtotalCents + pricing.addOnSubtotalCents],
              ...(pricing.welcomeDiscountCents > 0 ? [["Welcome Offer", -pricing.welcomeDiscountCents]] : []),
              ...(pricing.volumeDiscountCents > 0 ? [[`Volume discount · ${pricing.volumeDiscountPercent}%`, -pricing.volumeDiscountCents]] : []),
              ...(pricing.partnerDiscountCents > 0 ? [[`Partner pricing · ${pricing.partnerDiscountPercent}%`, -pricing.partnerDiscountCents]] : []),
              ["Order total", pricing.totalCents!],
            ].map(([label, cents]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium text-foreground">{formatStoredMoney(Number(cents), pricing.currency)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {hasPaymentAction ? (
        <section aria-labelledby="action-required-heading" className="mb-8">
          <p
            id="action-required-heading"
            className="mb-2 text-dashboard-section lg:text-lg font-bold text-secondary-dark"
          >
            Action required
          </p>
          <OrderPaymentPanel
            orderId={order.id}
            initialSummary={paymentSummary}
            presentation="order-detail"
          />
        </section>
      ) : null}

      <section
        id="image-workflow"
        data-order-workflow
        aria-labelledby="order-images-heading"
        className="min-w-0 space-y-5"
      >
        <div>
          <p className="text-dashboard-kicker uppercase font-bold text-secondary-dark">
            Your images
          </p>
          <h2
            id="order-images-heading"
            className="mt-1 flex items-center gap-2 text-xl font-bold text-primary"
          >
            <Layers className="h-5 w-5 flex-shrink-0" aria-hidden />
            Image workflow{" "}
            <span className="text-sm font-medium text-muted">({order.items.length})</span>
          </h2>
        </div>

        {order.items.length > 0 ? (
          <div className="space-y-4">
            {order.items.map((item) => {
              const deliverables = imageDeliverables.get(item.item_index) ?? [];
              const itemReviews = orderReviews.filter(
                (review) => review.item_index === item.item_index
              );
              const status = deriveImageWorkflowStatus(deliverables, itemReviews);

              return (
                <ClientOrderImageCard
                  viewerVariant={viewerVariant}
                  key={item.id}
                  orderId={order.id}
                  orderStatus={order.status}
                  editLabel={serviceLabel}
                  imageNumber={item.item_index + 1}
                  imageCount={order.items.length}
                  subtotalLabel={
                    item.subtotal_cents > 0
                      ? formatStoredMoney(item.subtotal_cents, order.currency)
                      : null
                  }
                  details={item.details}
                  sourceFiles={imageSourceFiles.get(item.item_index) ?? []}
                  deliverables={deliverables}
                  originalViewerItems={imageGalleries.originals}
                  deliveredViewerItems={imageGalleries.delivered}
                  status={status}
                  latestComment={latestRelevantComment(itemReviews, status)}
                  summaryReworkDeliverableId={singleSummaryReworkRow?.deliverable.id ?? null}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center mb-4">
              <Layers className="w-5 h-5 text-muted-light" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              Item details not yet available
            </p>
            <p className="max-w-xs text-dashboard-body text-muted">
              Item-level details will appear here once your order has been confirmed.
            </p>
          </div>
        )}

        {orderLevelDeliverables.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <FolderOpen className="w-4 h-4 text-primary" aria-hidden />
              <h3 className="text-dashboard-section lg:text-lg font-bold text-primary">
                Order files
              </h3>
              <span className="ml-auto text-right text-dashboard-metadata text-muted-light">
                {orderLevelDeliverables.length} file{orderLevelDeliverables.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {orderLevelDeliverables.map(({ deliverable, review, isReplacement, previousFilename }) => (
                <li key={deliverable.id} className="px-5 py-3.5">
                  <FilePreviewCard
                    viewerVariant={viewerVariant}
                    filename={deliverable.filename}
                    mimeType={deliverable.mime_type}
                    fileSizeLabel={formatBytes(deliverable.file_size)}
                    badgeLabel={itemLabel(deliverable.item_index)}
                    signedUrlEndpoint={`/api/client/deliverables/${deliverable.id}/download-url`}
                    viewerItems={imageGalleries.orderFiles}
                    viewerItemId={`deliverable:${deliverable.id}`}
                    downloadLabel="Download file"
                    meta={
                      <div className="space-y-1">
                        {isReplacement && (
                          <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-dashboard-metadata font-semibold text-purple-700">
                            New version
                          </span>
                        )}
                        {previousFilename && (
                          <p className="text-dashboard-metadata text-muted">
                            Replaces {previousFilename}
                          </p>
                        )}
                        {review?.comment && (
                          <p className="line-clamp-2 max-w-xs break-words text-dashboard-body text-muted" title={review.comment}>
                            {review.comment}
                          </p>
                        )}
                      </div>
                    }
                    actions={
                      canShowCompletedRework &&
                      deliverable.id !== singleSummaryReworkRow?.deliverable.id ? (
                        <div className="w-full border-t border-border pt-3">
                          <p className="text-dashboard-action font-semibold text-foreground">
                            Need any changes?
                          </p>
                          <p className="mt-1 text-dashboard-body text-muted">
                            Request adjustments to the delivered result.
                          </p>
                          <div className="mt-3">
                            <DeliverableReviewActions
                              deliverableId={deliverable.id}
                              initialReviewStatus={review?.status ?? null}
                              initialComment={review?.comment ?? null}
                              filename={deliverable.filename}
                              presentation="compact"
                            />
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

      </section>

      <section
        aria-labelledby="order-activity-heading"
        className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-light" aria-hidden />
          <div>
            <h2
              id="order-activity-heading"
              className="text-dashboard-section lg:text-lg font-bold text-muted"
            >
              Activity
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Order submitted {formatDisplayDate(order.created_at)} · Last updated{" "}
              {formatDisplayDate(order.updated_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientPortalLink
            href="/dashboard/support"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-dashboard-action font-semibold text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <LifeBuoy className="w-3.5 h-3.5" aria-hidden />
            Contact support
          </ClientPortalLink>
          <ClientPortalLink
            href="/dashboard/jobs"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-dashboard-action font-semibold text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            All jobs
          </ClientPortalLink>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-dashboard-action font-semibold text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden />
            Place another order
          </ClientPortalLink>
        </div>
      </section>
    </ClientDashboardLayout>
  );
}

function JobDetailsRow({
  label,
  value,
  mono = false,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] items-center gap-3 border-b border-border px-4 py-2.5 sm:px-5">
      <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
        {label}
      </dt>
      <dd
        className={[
          "min-w-0 break-words leading-snug",
          mono ? "font-mono text-dashboard-metadata text-foreground" : "text-dashboard-metadata text-foreground",
          strong ? "font-bold" : "font-medium",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
