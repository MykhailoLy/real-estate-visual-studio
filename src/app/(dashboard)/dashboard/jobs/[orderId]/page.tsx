import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import {
  ArrowLeft,
  CalendarDays,
  FolderOpen,
  Layers,
  LifeBuoy,
  PlusCircle,
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

interface JobDetailsCardProps {
  orderNumber: string;
  serviceLabel: string;
  jobTitle: string;
  submittedLabel: string;
  itemCount: number;
  totalValue: string;
  clientCompany: string | null;
  status: ReactNode;
  progress: number;
  progressMessage: ReactNode;
}

function JobDetailsCard({
  orderNumber,
  serviceLabel,
  jobTitle,
  submittedLabel,
  itemCount,
  totalValue,
  clientCompany,
  status,
  progress,
  progressMessage,
}: JobDetailsCardProps) {
  return (
    <section
      aria-labelledby="job-details-heading"
      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <div className="border-b border-border bg-surface/60 px-5 py-3.5">
        <h2
          id="job-details-heading"
          className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary"
        >
          Job details
        </h2>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2">
        <JobDetailsRow label="Job name" value={jobTitle || serviceLabel} />
        <JobDetailsRow label="Reference" value={orderNumber} mono />
        <JobDetailsRow label="Cost" value={totalValue} strong />
        <JobDetailsRow label="Status" value={status} />
        <JobDetailsRow label="Submitted" value={submittedLabel} />
        <JobDetailsRow label="Completed" value="—" />
        <JobDetailsRow label="Service" value={serviceLabel} />
        <JobDetailsRow
          label="Images / items"
          value={`${itemCount} image${itemCount !== 1 ? "s" : ""}`}
        />
        {clientCompany && (
          <JobDetailsRow label="Company" value={clientCompany} />
        )}
        <div className="border-t border-border px-5 py-4 sm:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
              Progress
            </dt>
            <dd className="text-[11px] text-muted">{progressMessage}</dd>
          </div>
          <ProgressBar value={progress} />
        </div>
      </dl>
    </section>
  );
}

function DeliveryCard({
  orderId,
  hasDeliverables,
  paymentState,
}: {
  orderId: string;
  hasDeliverables: boolean;
  paymentState: "paid" | "no_payment_required" | "partially_refunded" | "refunded";
}) {
  const paymentMessage =
    paymentState === "paid"
      ? "Payment confirmed"
      : paymentState === "no_payment_required"
        ? "No payment required"
        : paymentState === "partially_refunded"
          ? "Payment partially refunded"
          : paymentState === "refunded"
            ? "Payment refunded"
            : null;

  return (
    <section
      aria-labelledby="delivery-heading"
      className="rounded-xl border border-border bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="delivery-heading"
            className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary"
          >
            Delivery
          </h2>
          {paymentMessage && (
            <p className="mt-1 text-[12px] font-medium text-muted">
              {paymentMessage}
            </p>
          )}
        </div>
      </div>
      {hasDeliverables ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-foreground">
            Delivered files available
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Download the available delivered files as a ZIP.
          </p>
          <BulkDownloadButton
            endpoint={`/api/client/orders/${orderId}/deliverables/bulk-download`}
            label="Download completed job"
            className="mt-4 items-start"
          />
        </div>
      ) : (
        <p className="mt-5 text-[13px] leading-relaxed text-muted">
          Files will appear here when ready.
        </p>
      )}
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
        className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary"
      >
        Payment
      </h2>
      <p className="mt-5 text-sm font-semibold text-foreground">
        Payment details unavailable
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
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
    serviceLabel,
    jobTitle,
    submittedLabel: formatDisplayDate(order.created_at),
    itemCount: order.item_count,
    totalValue: authoritativeTotal
      ? formatStoredMoney(authoritativeTotal.cents, authoritativeTotal.currency)
      : formatStoredMoney(order.estimated_total_cents, order.currency),
    clientCompany: order.client_company,
    status: <StatusBadge status={dashStatus} />,
    progress,
    progressMessage,
  } satisfies JobDetailsCardProps;
  const deliveryPaymentState =
    paymentSummary?.state === "paid" ||
    paymentSummary?.state === "no_payment_required" ||
    paymentSummary?.state === "partially_refunded" ||
    paymentSummary?.state === "refunded"
      ? paymentSummary.state
      : null;

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

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <LifeBuoy className="w-3.5 h-3.5" aria-hidden />
            Contact support
          </ClientPortalLink>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden />
            New order
          </ClientPortalLink>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <JobDetailsCard {...jobDetailsProps} />
        {paymentSummary === null ? (
          <PaymentDetailsUnavailableCard />
        ) : paymentSummary.state === "payment_required" ||
          paymentSummary.state === "processing" ||
          paymentSummary.state === "not_available" ? (
          <OrderPaymentPanel
            orderId={order.id}
            initialSummary={paymentSummary}
            presentation="order-detail"
          />
        ) : deliveryPaymentState ? (
          <DeliveryCard
            orderId={order.id}
            hasDeliverables={currentDeliverables.length > 0}
            paymentState={deliveryPaymentState}
          />
        ) : (
          <PaymentDetailsUnavailableCard />
        )}
      </div>

      <section data-order-workflow className="mt-7 min-w-0 space-y-5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" aria-hidden />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            Image workflow ({order.items.length} image{order.items.length !== 1 ? "s" : ""})
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-8 text-center shadow-sm">
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
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-border bg-surface/60 px-5 py-3.5">
              <FolderOpen className="w-4 h-4 text-primary" aria-hidden />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
                Order files
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
                      <div className="w-full border-t border-border pt-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
                          Need something changed?
                        </p>
                        <DeliverableReviewActions
                          deliverableId={deliverable.id}
                          initialReviewStatus={review?.status ?? null}
                          initialComment={review?.comment ?? null}
                          filename={deliverable.filename}
                        />
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-light" aria-hidden />
          <p className="text-xs text-muted">
            Order submitted {formatDisplayDate(order.created_at)} · Last updated{" "}
            {formatDisplayDate(order.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientPortalLink
            href="/dashboard/jobs"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            All jobs
          </ClientPortalLink>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden />
            Place another order
          </ClientPortalLink>
        </div>
      </div>
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
    <div className="min-w-0 border-b border-border px-5 py-3 sm:even:border-l">
      <dt className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
        {label}
      </dt>
      <dd
        className={[
          "min-w-0 leading-snug",
          mono ? "font-mono text-[12px] text-foreground" : "text-[13px] text-foreground",
          strong ? "font-bold" : "font-medium",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
