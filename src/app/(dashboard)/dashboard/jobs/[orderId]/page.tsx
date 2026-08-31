import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  FolderOpen,
  Layers,
  LifeBuoy,
  PlusCircle,
  Receipt,
} from "lucide-react";
import BulkDownloadButton from "@/components/BulkDownloadButton";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import CopyOrderNumberButton from "@/components/dashboard/CopyOrderNumberButton";
import ClientOrderImageCard, {
  type ClientImageWorkflowStatus,
} from "@/components/dashboard/ClientOrderImageCard";
import DeliverableReviewActions from "@/components/dashboard/DeliverableReviewActions";
import StatusBadge from "@/components/dashboard/StatusBadge";
import FilePreviewCard from "@/components/FilePreviewCard";
import OrderPaymentPanel from "@/components/payments/OrderPaymentPanel";
import { getDashboardRequestUser } from "@/lib/dashboard-request-context";
import { getDeliverablesForClient } from "@/lib/client-deliverables";
import {
  getCurrentDeliverableRows,
  type CurrentDeliverableRow,
} from "@/lib/client-deliverable-display";
import {
  deriveDashboardStatusFromReviews,
  deriveEstimatedCompletion,
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
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
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

interface OrderDetailContextProps {
  orderNumber: string;
  serviceLabel: string;
  jobTitle: string;
  submittedLabel: string;
  estimatedCompletionLabel: string;
  itemCount: number;
  totalLabel: string;
  totalValue: string;
  pricing: ReturnType<typeof parsePricingSnapshot>;
  clientCompany: string | null;
  progress: number;
  progressMessage: ReactNode;
}

function OrderDetailContext({
  orderNumber,
  serviceLabel,
  jobTitle,
  submittedLabel,
  estimatedCompletionLabel,
  itemCount,
  totalLabel,
  totalValue,
  pricing,
  clientCompany,
  progress,
  progressMessage,
}: OrderDetailContextProps) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-surface/60 px-5 py-3.5">
          <Receipt className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-[13px] font-bold text-foreground">Summary</h2>
        </div>
        <dl className="divide-y divide-border">
          <SummaryRow label="Order number" value={orderNumber} mono />
          <SummaryRow label="Service" value={serviceLabel} />
          {jobTitle && <SummaryRow label="Job title" value={jobTitle} />}
          <SummaryRow label="Submitted" value={submittedLabel} />
          <SummaryRow
            label="Est. completion"
            value={estimatedCompletionLabel}
          />
          <SummaryRow
            label="Images / items"
            value={`${itemCount} image${itemCount !== 1 ? "s" : ""}`}
          />
          <SummaryRow label={totalLabel} value={totalValue} bold />
          {pricing && (
            <>
              <SummaryRow
                label="Base subtotal"
                value={formatStoredMoney(
                  pricing.baseSubtotalCents,
                  pricing.currency,
                )}
              />
              <SummaryRow
                label="Add-ons"
                value={formatStoredMoney(
                  pricing.addOnSubtotalCents,
                  pricing.currency,
                )}
              />
              {pricing.welcomeDiscountCents > 0 && (
                <SummaryRow
                  label="Welcome Offer"
                  value={`−${formatStoredMoney(
                    pricing.welcomeDiscountCents,
                    pricing.currency,
                  )}`}
                />
              )}
              {pricing.volumeDiscountPercent > 0 && (
                <SummaryRow
                  label={`Volume discount (${pricing.volumeDiscountPercent}%)`}
                  value={`−${formatStoredMoney(
                    pricing.volumeDiscountCents,
                    pricing.currency,
                  )}`}
                />
              )}
            </>
          )}
          {clientCompany && (
            <SummaryRow label="Company" value={clientCompany} />
          )}
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-[13px] font-bold text-foreground">Progress</h2>
        </div>
        <ProgressBar value={progress} className="mb-3" />
        <p className="text-[11px] leading-relaxed text-muted">
          {progressMessage}
        </p>
      </section>
    </div>
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

  let expectedStripeLivemode: boolean | null = null;
  try {
    expectedStripeLivemode = getExpectedStripeLivemode();
  } catch {
    console.error("[dashboard/order] Stripe mode is unavailable");
  }

  const [allDeliverables, allReviews, sourceFiles, paymentSummary] = await Promise.all([
    getDeliverablesForClient(ownership),
    getReviewsForClient(ownership),
    getClientSourceFilesForOrder(order.id, ownership),
    getAuthoritativePaymentSummary(order.id, user.id, {
      repository: createSupabaseCheckoutRepository(getSupabaseAdminClient()),
      expectedStripeLivemode,
    }),
  ]);

  const orderDeliverables = allDeliverables.filter((deliverable) => deliverable.order_id === order.id);
  const orderReviews = allReviews.filter((review) => review.order_id === order.id);
  const currentDeliverables = getCurrentDeliverableRows(orderDeliverables, orderReviews);
  const imageDeliverables = groupCurrentDeliverablesByItem(currentDeliverables);
  const imageSourceFiles = groupSourceFilesByItem(sourceFiles);
  const orderLevelDeliverables = getOrderLevelDeliverables(currentDeliverables);

  const serviceLabel = getOrderServiceLabel(order.service_type, order.sub_service);
  const viewerVariant = getStaticImageViewerVariantForService(order.service_type);
  const jobTitle = order.job_title?.trim() || "";
  const dashStatus = deriveDashboardStatusFromReviews(order.status, orderReviews);
  const progress = getProgressFromStatus(order.status);
  const estimatedComp = deriveEstimatedCompletion(order.status, order.created_at);
  const estimatedCompDisplay = formatDisplayDate(estimatedComp);
  const pricing = parsePricingSnapshot(order.pricing_snapshot);
  const estimatedCompletionLabel =
    estimatedComp === "Delivered"
      ? "Delivered"
      : estimatedCompDisplay === "-"
        ? "-"
        : `~${estimatedCompDisplay} (est.)`;
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
  const orderContextProps = {
    orderNumber: order.order_number,
    serviceLabel,
    jobTitle,
    submittedLabel: formatDisplayDate(order.created_at),
    estimatedCompletionLabel,
    itemCount: order.item_count,
    totalLabel: authoritativeTotal ? "Final total" : "Estimated total",
    totalValue: authoritativeTotal
      ? formatStoredMoney(authoritativeTotal.cents, authoritativeTotal.currency)
      : formatStoredMoney(order.estimated_total_cents, order.currency),
    pricing,
    clientCompany: order.client_company,
    progress,
    progressMessage,
  } satisfies OrderDetailContextProps;

  return (
    <ClientDashboardLayout>
      <div className="mb-6">
        <ClientPortalLink
          href="/dashboard/jobs"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to jobs
        </ClientPortalLink>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
            Order detail
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
            {jobTitle || serviceLabel}
          </h1>
          {jobTitle && (
            <p className="text-sm font-medium text-muted mt-1">{serviceLabel}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-mono text-[12px] bg-surface border border-border px-2 py-0.5 rounded text-muted">
              {order.order_number}
            </span>
            <CopyOrderNumberButton orderNumber={order.order_number} />
            <StatusBadge status={dashStatus} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
          <ClientPortalLink
            href="/dashboard/support"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-[12px] font-semibold text-foreground/70 hover:border-primary/40 hover:text-primary bg-white transition-colors"
          >
            <LifeBuoy className="w-3.5 h-3.5" aria-hidden />
            Contact support
          </ClientPortalLink>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[12px] font-semibold hover:bg-primary-light transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden />
            New order
          </ClientPortalLink>
        </div>
      </div>

      {paymentSummary ? (
        <div className="mb-7">
          <OrderPaymentPanel
            orderId={order.id}
            initialSummary={paymentSummary}
            secondaryHref="/dashboard/jobs"
            secondaryLabel="Back to jobs"
          />
        </div>
      ) : null}

      <details
        data-order-context-mobile
        className="group mb-6 overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:hidden"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          Order summary and progress
          <ChevronDown
            className="h-4 w-4 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="border-t border-border bg-surface/40 p-4">
          <OrderDetailContext {...orderContextProps} />
        </div>
      </details>

      <div
        data-order-detail-workspace
        className="grid min-w-0 grid-cols-1 gap-7 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8"
      >
        <aside
          data-order-context-desktop
          aria-label="Order summary and progress"
          className="hidden min-w-0 lg:block lg:self-start"
        >
          <div className="lg:sticky lg:top-8">
            <OrderDetailContext {...orderContextProps} />
          </div>
        </aside>

        <section data-order-workflow className="min-w-0 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" aria-hidden />
            <h2 className="text-[13px] font-bold text-foreground">
              Image workflow
              <span className="ml-2 text-[11px] font-normal text-muted">
                ({order.items.length} image{order.items.length !== 1 ? "s" : ""})
              </span>
            </h2>
          </div>
          <BulkDownloadButton
            endpoint={`/api/client/orders/${order.id}/deliverables/bulk-download`}
            disabled={currentDeliverables.length === 0}
            emptyLabel="No files"
          />
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
                  status={status}
                  latestComment={latestRelevantComment(itemReviews, status)}
                />
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl shadow-sm p-8 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center mb-4">
              <Layers className="w-5 h-5 text-muted-light" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              Item details not yet available
            </p>
            <p className="text-xs text-muted max-w-xs leading-relaxed">
              Item-level details will appear here once your order has been confirmed.
            </p>
          </div>
        )}

        {orderLevelDeliverables.length > 0 && (
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" aria-hidden />
              <h2 className="text-[13px] font-bold text-foreground">
                Order-level files
              </h2>
              <span className="ml-auto text-[11px] text-muted-light text-right">
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
                    downloadLabel="Download file"
                    meta={
                      <div className="space-y-1">
                        {isReplacement && (
                          <span className="inline-flex items-center text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
                            New version
                          </span>
                        )}
                        {previousFilename && (
                          <p className="text-[10px] text-muted">
                            Replaces {previousFilename}
                          </p>
                        )}
                        {review?.comment && (
                          <p className="text-[10px] text-muted truncate max-w-xs" title={review.comment}>
                            {review.comment}
                          </p>
                        )}
                      </div>
                    }
                    actions={
                      <DeliverableReviewActions
                        deliverableId={deliverable.id}
                        initialReviewStatus={review?.status ?? null}
                        initialComment={review?.comment ?? null}
                        filename={deliverable.filename}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {order.client_company && (
          <div className="flex items-start gap-3 bg-surface border border-border rounded-xl p-4">
            <Building2 className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light mb-0.5">
                Order placed for
              </p>
              <p className="text-[13px] font-semibold text-foreground">
                {order.client_company}
              </p>
            </div>
          </div>
        )}
      </section>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-surface border border-border rounded-xl">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-light" aria-hidden />
          <p className="text-xs text-muted">
            Order submitted {formatDisplayDate(order.created_at)} - Last updated{" "}
            {formatDisplayDate(order.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientPortalLink
            href="/dashboard/jobs"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-[12px] font-semibold text-foreground/70 hover:border-primary/40 hover:text-primary bg-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            All jobs
          </ClientPortalLink>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[12px] font-semibold hover:bg-primary-light transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden />
            Place another order
          </ClientPortalLink>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
  bold = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light flex-shrink-0">
        {label}
      </dt>
      <dd
        className={[
          "text-right leading-snug",
          mono ? "font-mono text-[12px] text-foreground" : "text-[13px] text-foreground",
          bold ? "font-bold" : "font-medium",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
