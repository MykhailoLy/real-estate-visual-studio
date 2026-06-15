import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
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
import { getClientUser } from "@/lib/client-auth";
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
  getServiceLabel,
} from "@/lib/client-orders";
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
import { formatUSD } from "@/lib/utils";

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

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getClientUser();
  if (!user) notFound();

  const ownership = toOrderOwnership(user);
  const order = await getOrderForClient(orderId, ownership);
  if (!order) notFound();

  const [allDeliverables, allReviews, sourceFiles] = await Promise.all([
    getDeliverablesForClient(ownership),
    getReviewsForClient(ownership),
    getClientSourceFilesForOrder(order.id, ownership),
  ]);

  const orderDeliverables = allDeliverables.filter((deliverable) => deliverable.order_id === order.id);
  const orderReviews = allReviews.filter((review) => review.order_id === order.id);
  const currentDeliverables = getCurrentDeliverableRows(orderDeliverables, orderReviews);
  const imageDeliverables = groupCurrentDeliverablesByItem(currentDeliverables);
  const imageSourceFiles = groupSourceFilesByItem(sourceFiles);
  const orderLevelDeliverables = getOrderLevelDeliverables(currentDeliverables);

  const serviceLabel = getServiceLabel(order.service_type);
  const dashStatus = deriveDashboardStatusFromReviews(order.status, orderReviews);
  const progress = getProgressFromStatus(order.status);
  const estimatedComp = deriveEstimatedCompletion(order.status, order.created_at);
  const estimatedCompDisplay = formatDisplayDate(estimatedComp);

  return (
    <ClientDashboardLayout>
      <div className="mb-6">
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to jobs
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
            Order detail
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
            {serviceLabel}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-mono text-[12px] bg-surface border border-border px-2 py-0.5 rounded text-muted">
              {order.order_number}
            </span>
            <CopyOrderNumberButton orderNumber={order.order_number} />
            <StatusBadge status={dashStatus} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
          <Link
            href="/dashboard/support"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-[12px] font-semibold text-foreground/70 hover:border-primary/40 hover:text-primary bg-white transition-colors"
          >
            <LifeBuoy className="w-3.5 h-3.5" aria-hidden />
            Contact support
          </Link>
          <Link
            href="/order"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[12px] font-semibold hover:bg-primary-light transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden />
            New order
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 mb-7">
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" aria-hidden />
            <h2 className="text-[13px] font-bold text-foreground">Summary</h2>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
            <SummaryRow label="Order number" value={order.order_number} mono />
            <SummaryRow label="Service" value={serviceLabel} />
            <SummaryRow label="Submitted" value={formatDisplayDate(order.created_at)} />
            <SummaryRow
              label="Est. completion"
              value={
                estimatedComp === "Delivered"
                  ? "Delivered"
                  : estimatedCompDisplay === "-"
                    ? "-"
                    : `~${estimatedCompDisplay} (est.)`
              }
            />
            <SummaryRow
              label="Images / items"
              value={`${order.item_count} image${order.item_count !== 1 ? "s" : ""}`}
            />
            <SummaryRow
              label="Est. total"
              value={formatUSD(order.estimated_total_cents)}
              bold
            />
            {order.client_company && (
              <SummaryRow label="Company" value={order.client_company} />
            )}
          </dl>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" aria-hidden />
            <h2 className="text-[13px] font-bold text-foreground">Progress</h2>
          </div>
          <ProgressBar value={progress} className="mb-3" />
          <p className="text-[11px] text-muted leading-relaxed">
            {order.status === "pending" &&
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
            {order.status === "cancelled" &&
              "This order has been cancelled."}
          </p>
        </div>
      </div>

      <section className="space-y-5">
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
                  key={item.id}
                  orderId={order.id}
                  imageNumber={item.item_index + 1}
                  imageCount={order.items.length}
                  subtotalLabel={
                    item.subtotal_cents > 0 ? formatUSD(item.subtotal_cents) : null
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

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-surface border border-border rounded-xl">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-light" aria-hidden />
          <p className="text-xs text-muted">
            Order submitted {formatDisplayDate(order.created_at)} - Last updated{" "}
            {formatDisplayDate(order.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-[12px] font-semibold text-foreground/70 hover:border-primary/40 hover:text-primary bg-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            All jobs
          </Link>
          <Link
            href="/order"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[12px] font-semibold hover:bg-primary-light transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden />
            Place another order
          </Link>
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
