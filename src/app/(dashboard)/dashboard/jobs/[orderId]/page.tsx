// ============================================================
// /dashboard/jobs/[orderId] — read-only order detail page
//
// Server component. Fetches a single order by UUID, but ONLY
// if client_email on the order matches the authenticated user's
// confirmed email. This is the ownership check — a wrong owner
// receives the same "not found" response as a missing order.
//
// Security:
//  - orderId comes from the URL route param (untrusted)
//  - email comes exclusively from getClientUser() (server-validated SSR session)
//  - Both are passed together to getOrderByIdForClient() which enforces
//    the WHERE id = $1 AND client_email = $2 ownership guard
//  - Storage paths, file metadata, and private JSONB fields are stripped
//    before the data leaves the server (sanitizeDetails())
// ============================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Receipt,
  Layers,
  CalendarDays,
  Clock,
  CheckCircle2,
  PlusCircle,
  LifeBuoy,
  Building2,
  ExternalLink,
  FolderOpen,
} from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import StatusBadge from "@/components/dashboard/StatusBadge";
import DeliverableReviewActions from "@/components/dashboard/DeliverableReviewActions";
import FilePreviewCard from "@/components/FilePreviewCard";
import { getClientUser } from "@/lib/client-auth";
import {
  getOrderByIdForClient,
  getServiceLabel,
  deriveDashboardStatusFromReviews,
  getProgressFromStatus,
  deriveEstimatedCompletion,
} from "@/lib/client-orders";
import { getDeliverablesByClientEmail } from "@/lib/client-deliverables";
import { getReviewsByClientEmail } from "@/lib/client-reviews";
import { getCurrentDeliverableRows } from "@/lib/client-deliverable-display";
import { formatUSD } from "@/lib/utils";

// ── Metadata ─────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────

function formatDisplayDate(iso: string): string {
  if (!iso || iso === "—" || iso === "Delivered") return iso || "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable label for item_index. */
function itemLabel(itemIndex: number | null): string {
  return itemIndex === null ? "Order-level" : `Image ${itemIndex + 1}`;
}

/** Render a progress bar for the detail page. */
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

/**
 * Render the sanitized JSONB details for one order item.
 * Only known safe keys are surfaced with friendly labels.
 * Unknown keys are shown as-is (they have already been sanitized).
 */
function ItemDetails({ details }: { details: Record<string, unknown> }) {
  // Friendly label map for known detail keys
  const KEY_LABELS: Record<string, string> = {
    room_name:          "Room",
    room:               "Room",
    furniture_style:    "Furniture style",
    presentation_style: "Presentation style",
    reference_link:     "Reference link",
    additional_info:    "Additional notes",
    addon_labels:       "Add-ons",
    option_labels:      "Selected options",
    internal_labels:    "Internal changes",
    external_labels:    "External changes",
    plan_type_label:    "Plan type",
    number_of_floors:   "Number of floors",
    style_3d:           "3D style",
    plan_view_3d:       "3D view",
    page_orientation:   "Page orientation",
    plan_orientation:   "Plan orientation",
    show_address:       "Show address",
    street_address:     "Address",
    show_title:         "Show title",
    project_title:      "Project title",
    disclaimer_option:  "Disclaimer",
    custom_disclaimer:  "Custom disclaimer",
    flooring_by_room:   "Flooring by room",
  };

  // Keys to skip in the detail display (already shown elsewhere or internal)
  const SKIP_KEYS = new Set([
    "selected_addons", "selected_options",
    "selected_internal", "selected_external",
    "plan_type",
  ]);

  const entries = Object.entries(details).filter(
    ([k, v]) =>
      !SKIP_KEYS.has(k) &&
      v !== null &&
      v !== undefined &&
      v !== "" &&
      !(Array.isArray(v) && v.length === 0)
  );

  if (entries.length === 0) return null;

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
      {entries.map(([key, val]) => {
        const label = KEY_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

        let display: React.ReactNode;
        if (Array.isArray(val)) {
          display = (
            <div className="flex flex-wrap gap-1.5">
              {(val as string[]).map((v, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 bg-primary/8 border border-primary/15 rounded-full text-[11px] font-semibold text-primary"
                >
                  {v}
                </span>
              ))}
            </div>
          );
        } else if (typeof val === "object" && val !== null) {
          // Nested object (e.g. flooring_by_room)
          display = (
            <ul className="space-y-0.5">
              {Object.entries(val as Record<string, unknown>).map(([room, floor]) => (
                <li key={room} className="text-[12px] text-foreground/75">
                  <span className="font-semibold">{room}:</span> {String(floor)}
                </li>
              ))}
            </ul>
          );
        } else if (typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"))) {
          display = (
            <a
              href={val}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:text-primary-light transition-colors text-[12px] font-semibold truncate max-w-[240px]"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden />
              View reference
            </a>
          );
        } else if (typeof val === "boolean") {
          display = <span className="text-[13px] text-foreground/80">{val ? "Yes" : "No"}</span>;
        } else {
          display = <span className="text-[13px] text-foreground/80">{String(val)}</span>;
        }

        return (
          <div key={key} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light mb-1">
              {label}
            </dt>
            <dd>{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  // Validate session server-side — never trust orderId ownership from the URL alone
  const user = await getClientUser();
  if (!user) notFound();

  // Fetch order — ownership enforced by matching id AND client_email simultaneously.
  // A wrong owner gets null, indistinguishable from "not found".
  const order = await getOrderByIdForClient(orderId, user.email);
  if (!order) notFound();

  // Fetch deliverables + reviews in parallel — both ownership-guarded by email JOIN.
  const [allDeliverables, allReviews] = await Promise.all([
    getDeliverablesByClientEmail(user.email),
    getReviewsByClientEmail(user.email),
  ]);
  const orderDeliverables = allDeliverables.filter((d) => d.order_id === order.id);
  const currentDeliverables = getCurrentDeliverableRows(orderDeliverables, allReviews);

  // Build deliverable_id → latest review map (reviews already newest-first).
  // Derive display values from raw DB fields
  const serviceLabel  = getServiceLabel(order.service_type);
  const orderReviews  = allReviews.filter((review) => review.order_id === order.id);
  const dashStatus    = deriveDashboardStatusFromReviews(order.status, orderReviews);
  const progress      = getProgressFromStatus(order.status);
  const estimatedComp = deriveEstimatedCompletion(order.status, order.created_at);

  return (
    <ClientDashboardLayout>

      {/* ── Breadcrumb / back link ── */}
      <div className="mb-6">
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to jobs
        </Link>
      </div>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
            Order detail
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
            {serviceLabel}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="font-mono text-[12px] bg-surface border border-border px-2 py-0.5 rounded text-muted">
              {order.order_number}
            </span>
            <StatusBadge status={dashStatus} />
          </div>
        </div>

        {/* CTA buttons */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left column: summary card ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Summary card */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" aria-hidden />
              <h2 className="text-[13px] font-bold text-foreground">Summary</h2>
            </div>
            <dl className="divide-y divide-border">
              <SummaryRow label="Order number" value={order.order_number} mono />
              <SummaryRow label="Service" value={serviceLabel} />
              <SummaryRow
                label="Submitted"
                value={formatDisplayDate(order.created_at)}
              />
              <SummaryRow
                label="Est. completion"
                value={
                  estimatedComp === "Delivered"
                    ? "Delivered ✓"
                    : estimatedComp === "—"
                    ? "—"
                    : `~${formatDisplayDate(estimatedComp)} (est.)`
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

          {/* Progress card */}
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

          {/* Back to jobs */}
          <Link
            href="/dashboard/jobs"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-border rounded-lg text-[13px] font-semibold text-foreground/70 hover:border-primary/40 hover:text-primary bg-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Back to all jobs
          </Link>
        </div>

        {/* ── Right column: items ── */}
        <div className="lg:col-span-2 space-y-4">

          {order.items.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-primary" aria-hidden />
                <h2 className="text-[13px] font-bold text-foreground">
                  Order items
                  <span className="ml-2 text-[11px] font-normal text-muted">
                    ({order.items.length} image{order.items.length !== 1 ? "s" : ""})
                  </span>
                </h2>
              </div>

              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-border rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Item header */}
                  <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-bold text-foreground">
                      Image {item.item_index + 1}
                    </span>
                    {item.subtotal_cents > 0 && (
                      <span className="text-[12px] font-semibold text-foreground/70 tabular-nums">
                        {formatUSD(item.subtotal_cents)}
                      </span>
                    )}
                  </div>

                  {/* Item details */}
                  <div className="px-5 py-4">
                    {Object.keys(item.details).length > 0 ? (
                      <ItemDetails details={item.details} />
                    ) : (
                      <p className="text-[12px] text-muted italic">
                        No additional details available for this item.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            /* No items yet or items not available */
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

          {/* ── Deliverables section ── */}
          {currentDeliverables.length > 0 ? (
            <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary" aria-hidden />
                <h2 className="text-[13px] font-bold text-foreground">
                  Delivered files
                </h2>
                <span className="ml-auto text-[11px] text-muted-light">
                  {currentDeliverables.length} file{currentDeliverables.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {currentDeliverables.map(({ deliverable: d, review: rev, isReplacement, previousFilename }) => {
                  return (
                  <li key={d.id} className="px-5 py-3.5">
                    <FilePreviewCard
                      filename={d.filename}
                      mimeType={d.mime_type}
                      fileSizeLabel={formatBytes(d.file_size)}
                      badgeLabel={itemLabel(d.item_index)}
                      signedUrlEndpoint={`/api/client/deliverables/${d.id}/download-url`}
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
                        </div>
                      }
                      actions={
                        <DeliverableReviewActions
                          deliverableId={d.id}
                          initialReviewStatus={rev?.status ?? null}
                          initialComment={rev?.comment ?? null}
                          filename={d.filename}
                        />
                      }
                    />
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            /* Pending delivery notice */
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200/60 rounded-xl p-4">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-[13px] font-semibold text-blue-800">
                  Files will appear here when delivered
                </p>
                <p className="text-xs text-blue-700/80 mt-0.5 leading-relaxed">
                  Completed files are also sent to your registered email address.
                </p>
              </div>
            </div>
          )}

          {/* ── Company info if present ── */}
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

        </div>
      </div>

      {/* ── Bottom action row ── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-surface border border-border rounded-xl">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-light" aria-hidden />
          <p className="text-xs text-muted">
            Order submitted {formatDisplayDate(order.created_at)} ·{" "}
            Last updated {formatDisplayDate(order.updated_at)}
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

// ── Small helper components ───────────────────────────────────

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
