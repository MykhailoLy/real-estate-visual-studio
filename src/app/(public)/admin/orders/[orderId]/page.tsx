import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RotateCcw, CheckCircle2, Clock, FileText, Tag } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  buildAdminSourceFiles,
  type AdminSourceFile,
  type OrderItemSourceFileRow,
} from "@/lib/admin-source-files";
import { createServerClient } from "@/lib/supabase";
import AdminDeliverableUpload, {
  type DeliverableRow,
} from "@/components/admin/AdminDeliverableUpload";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import BulkDownloadButton from "@/components/BulkDownloadButton";
import FilePreviewCard from "@/components/FilePreviewCard";

// ============================================================
// /admin/orders/[orderId] — admin order detail + deliverables
//
// Server component.  Guards with isAdminAuthenticated(), then:
//  1. Fetches the order summary row.
//  2. Fetches existing order_deliverables for this order.
//  3. Renders a read-only summary + AdminDeliverableUpload.
//
// Pattern mirrors /admin/orders (force-dynamic, nodejs runtime,
// service-role DB access, auth guard before any data fetch).
// ============================================================

export const dynamic  = "force-dynamic";
export const runtime  = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<Metadata> {
  const { orderId } = await params;
  return {
    title:  `Order ${orderId.slice(0, 8).toUpperCase()} — Admin | PicchuSpot`,
    robots: { index: false, follow: false },
  };
}

// ── Service slug → label (mirrors admin/orders page) ──────────

const SERVICE_LABELS: Record<string, string> = {
  "virtual-staging":        "Virtual Staging",
  "virtual-renovation":     "Virtual Renovation",
  "3d-floor-plans":         "Floor Plans",
  "photo-editing":          "Photo Editing",
  "image-enhancement":      "Image Enhancement",
  "day-to-dusk":            "Day to Dusk",
  "item-removal":           "Item Removal",
  "virtual-cleaning":       "Virtual Cleaning",
  "360-image-enhancement":  "360° Image Enhancement",
  "360-virtual-staging":    "360° Virtual Staging",
  "aerial-editing":         "Aerial Editing",
  "development-site-plans": "Development Site Plans",
};

function toLabel(slug: string): string {
  return SERVICE_LABELS[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function formatBytes(bytes: number | null): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return null;
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_COLORS: Record<string, string> = {
  "pending":     "bg-amber-50 text-amber-700 border-amber-200",
  "confirmed":   "bg-blue-50 text-blue-700 border-blue-200",
  "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
  "delivered":   "bg-emerald-50 text-emerald-700 border-emerald-200",
  "cancelled":   "bg-slate-100 text-slate-500 border-slate-200",
};

// ── Page ──────────────────────────────────────────────────────

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ reviewId?: string }>;
}) {
  const { orderId } = await params;
  const { reviewId } = await searchParams;
  const requestedReviewId =
    reviewId && /^[0-9a-f-]{36}$/i.test(reviewId) ? reviewId : null;

  // ── Auth guard ──────────────────────────────────────────
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  // ── Supabase ────────────────────────────────────────────
  type OrderRow = {
    id: string; order_number: string; service_type: string; status: string;
    client_name: string; client_email: string; client_company: string | null;
    item_count: number; estimated_total_cents: number;
    created_at: string; updated_at: string;
  };

  let order: OrderRow | null = null;
  let deliverables: DeliverableRow[] = [];
  let sourceFiles: AdminSourceFile[] = [];
  let reviews: Array<{
    id: string; deliverable_id: string; item_index: number | null;
    client_email: string; status: string; comment: string | null;
    created_at: string; replacement_deliverable_id: string | null;
    filename: string | null;
  }> = [];
  let supabaseError: string | null = null;

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (supabaseConfigured) {
    try {
      const supabase = createServerClient();

      // Fetch order
      const { data: orderData, error: orderErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, service_type, status, " +
          "client_name, client_email, client_company, " +
          "item_count, estimated_total_cents, created_at, updated_at"
        )
        .eq("id", orderId)
        .maybeSingle();

      if (orderErr) {
        supabaseError = orderErr.message;
      } else {
        order = orderData as unknown as OrderRow | null;
      }

      // Fetch existing deliverables for this order
      if (order) {
        const { data: delivData, error: delivErr } = await supabase
          .from("order_deliverables")
          .select(
            "id, order_id, order_number, item_index, " +
            "filename, file_size, mime_type, uploaded_at"
          )
          .eq("order_id", orderId)
          .order("uploaded_at", { ascending: false });

        if (!delivErr) {
          deliverables = (delivData ?? []) as unknown as DeliverableRow[];
        }

        const { data: itemData, error: itemErr } = await supabase
          .from("order_items")
          .select(
            "id, item_index, original_photo_path, reference_image_path, details, created_at"
          )
          .eq("order_id", orderId)
          .order("item_index", { ascending: true });

        if (!itemErr) {
          sourceFiles = buildAdminSourceFiles(
            (itemData ?? []) as unknown as OrderItemSourceFileRow[]
          );
        }

        // Fetch reviews for this order
        const { data: revData } = await supabase
          .from("deliverable_reviews")
          .select(
            "id, deliverable_id, item_index, client_email, status, comment, created_at, " +
            "replacement_deliverable_id, " +
            "order_deliverables!deliverable_reviews_deliverable_id_fkey(filename)"
          )
          .eq("order_id", orderId)
          .order("created_at", { ascending: false });

        if (revData) {
          reviews = (revData as unknown as Array<{
            id: string; deliverable_id: string; item_index: number | null;
            client_email: string; status: string; comment: string | null;
            created_at: string; replacement_deliverable_id: string | null;
            order_deliverables: { filename: string };
          }>).map((r) => ({
            ...r,
            filename: r.order_deliverables?.filename ?? null,
            order_deliverables: undefined,
          })) as typeof reviews;
        }
      }
    } catch (err) {
      supabaseError = String(err);
    }
  }

  const formatUSD = (cents: number) =>
    `US$${(cents / 100).toFixed(2)}`;

  const replacementReview = requestedReviewId
    ? reviews.find((r) =>
        r.id === requestedReviewId &&
        ["rework_requested", "rework_in_progress"].includes(r.status) &&
        !r.replacement_deliverable_id
      ) ?? null
    : null;

  return (
    <section className="bg-surface min-h-screen py-10 lg:py-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10">

        {/* ── Header ── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 lg:mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-2">
              PicchuSpot Admin
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight">
              Order Deliverables
            </h1>
            {order && (
              <p className="mt-1 text-sm text-muted font-mono">{order.order_number}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/rework"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden />
              Rework queue
            </Link>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Back to orders
            </Link>
            <AdminLogoutButton />
          </div>
        </header>

        {/* ── Error / config banners ── */}
        {!supabaseConfigured && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
            Supabase is not configured. Set{" "}
            <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-[12px]">SUPABASE_SERVICE_ROLE_KEY</code>.
          </div>
        )}
        {supabaseError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            DB error: {supabaseError}
          </div>
        )}
        {!order && supabaseConfigured && !supabaseError && (
          <div className="mb-6 rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted">
            Order not found.
          </div>
        )}
        {order && requestedReviewId && !replacementReview && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
            The selected rework request is no longer active or does not belong to this order.
          </div>
        )}
        {order && replacementReview && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <span className="font-semibold text-primary">
              Uploading replacement for{" "}
              {replacementReview.item_index === null
                ? "order-level file"
                : `Image ${replacementReview.item_index + 1}`}
            </span>
            {replacementReview.filename && (
              <span className="block mt-1 text-muted">
                Original file: {replacementReview.filename}
              </span>
            )}
          </div>
        )}

        {order && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Left: order summary ── */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-surface/60">
                  <h2 className="text-[13px] font-bold text-foreground">Order summary</h2>
                </div>
                <dl className="divide-y divide-border">
                  {[
                    ["Order #",   order.order_number],
                    ["Service",   toLabel(order.service_type)],
                    ["Client",    order.client_name],
                    ["Email",     order.client_email],
                    ["Company",   order.client_company ?? "—"],
                    ["Images",    String(order.item_count)],
                    ["Est. total", formatUSD(order.estimated_total_cents)],
                    ["Submitted", formatDate(order.created_at)],
                    ["Updated",   formatDate(order.updated_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-3 px-5 py-3">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light flex-shrink-0">
                        {label}
                      </dt>
                      <dd className="text-[12px] text-foreground text-right break-all">
                        {label === "Status" ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[value] ?? "bg-surface text-muted border-border"}`}
                          >
                            {value}
                          </span>
                        ) : value}
                      </dd>
                    </div>
                  ))}
                  {/* Status row separately for badge rendering */}
                  <div className="flex items-start justify-between gap-3 px-5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light flex-shrink-0">
                      Status
                    </dt>
                    <dd>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[order.status] ?? "bg-surface text-muted border-border"}`}
                      >
                        {order.status}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* ── Right: deliverables upload ── */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" aria-hidden />
                  <h3 className="text-[13px] font-bold text-foreground">
                    Client uploaded files
                  </h3>
                  <div className="ml-auto flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-[11px] text-muted-light text-right">
                      {sourceFiles.length} file{sourceFiles.length !== 1 ? "s" : ""}
                    </span>
                    <BulkDownloadButton
                      endpoint={`/api/admin/orders/${order.id}/source-files/bulk-download`}
                      disabled={sourceFiles.length === 0}
                      emptyLabel="No files"
                    />
                  </div>
                </div>

                {sourceFiles.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted">
                    No uploaded source files found.
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {sourceFiles.map((file) => {
                      const size = formatBytes(file.fileSize);
                      return (
                        <li key={file.id} className="px-5 py-3.5 hover:bg-surface/40 transition-colors">
                          <FilePreviewCard
                            filename={file.filename}
                            mimeType={file.mimeType}
                            fileSizeLabel={size}
                            badgeLabel={`Image ${file.itemIndex + 1}`}
                            signedUrlEndpoint={`/api/admin/orders/${order.id}/source-files/${file.id}/download-url`}
                            downloadLabel="Download"
                            meta={
                              <p className="text-[11px] text-muted">
                                {file.uploadedAt && <>{formatDate(file.uploadedAt)} · </>}
                                <span className="capitalize">{file.kind}</span>
                              </p>
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <AdminDeliverableUpload
                orderId={order.id}
                orderNumber={order.order_number}
                itemCount={order.item_count}
                initialDeliverables={deliverables}
                replacementReview={replacementReview ? {
                  id: replacementReview.id,
                  itemIndex: replacementReview.item_index,
                  filename: replacementReview.filename,
                } : null}
              />

              {/* ── Review status summary ── */}
              {reviews.length > 0 && (
                <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-primary" aria-hidden />
                    <h3 className="text-[13px] font-bold text-foreground">
                      Client review status
                    </h3>
                    <span className="ml-auto text-[11px] text-muted-light">
                      {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {reviews.map((r) => (
                      <li key={r.id} className="px-5 py-3 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-full">
                            <Tag className="w-2.5 h-2.5" aria-hidden />
                            {r.item_index === null ? "Order-level" : `Image ${r.item_index + 1}`}
                          </span>
                          {r.filename && (
                            <span className="text-[11px] text-muted truncate max-w-[120px]">{r.filename}</span>
                          )}
                          {r.status === "approved" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" aria-hidden />Approved
                            </span>
                          )}
                          {r.status === "rework_requested" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border-amber-200">
                              <RotateCcw className="w-3 h-3" aria-hidden />Rework requested
                            </span>
                          )}
                          {r.status === "rework_in_progress" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                              <Clock className="w-3 h-3" aria-hidden />In progress
                            </span>
                          )}
                          {r.status === "rework_delivered" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 bg-purple-50 text-purple-700 border-purple-200">
                              <CheckCircle2 className="w-3 h-3" aria-hidden />Replacement delivered
                            </span>
                          )}
                          {r.status === "resolved" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" aria-hidden />Resolved
                            </span>
                          )}
                        </div>
                        {r.comment && (
                          <p className="text-[11px] text-foreground/70 leading-snug pl-1 truncate max-w-[400px]" title={r.comment}>
                            &ldquo;{r.comment}&rdquo;
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </section>
  );
}
