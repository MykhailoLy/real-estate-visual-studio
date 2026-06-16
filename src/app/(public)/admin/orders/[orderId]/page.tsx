import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileImage,
  FolderOpen,
  Layers,
  PackageCheck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  buildAdminSourceFiles,
  type AdminSourceFile,
  type OrderItemSourceFileRow,
} from "@/lib/admin-source-files";
import {
  groupAdminSourceFilesByItem,
  groupDeliverablesByItem,
  groupReviewsByItem,
  type AdminReview,
} from "@/lib/admin-order-workflow";
import { createServerClient } from "@/lib/supabase";
import AdminDeliverableUpload, {
  type DeliverableRow,
} from "@/components/admin/AdminDeliverableUpload";
import AdminOrderImageCard, {
  type AdminReworkReferenceFile,
} from "@/components/admin/AdminOrderImageCard";
import BulkDownloadButton from "@/components/BulkDownloadButton";
import { formatDateTime } from "@/lib/display/file-format";
import { getOrderServiceLabel } from "@/lib/display/service-labels";
import {
  getOrderStatusLabel,
  getReviewStatusLabel,
} from "@/lib/display/status-labels";

// ============================================================
// /admin/orders/[orderId] — admin order detail (per-image workflow)
//
// Phase 5H.2: redesigned from fragmented sections into per-image
// workflow cards. Each image card shows:
//   Left   — Client source / Original
//   Middle — Uploaded deliverable / After
//   Right  — Request details + upload control + review status
//
// Order-level deliverables (item_index null) remain in a
// dedicated "Order-level files" section at the bottom.
//
// Existing behaviours preserved:
//   - Signed-URL source preview / download (never raw paths)
//   - Signed-URL deliverable preview / download
//   - Delete deliverable
//   - Upload deliverable (per-image + order-level)
//   - Rework / replacement linking
//   - Admin status controls
//   - Bulk-download ZIP for source files + deliverables
// ============================================================

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<Metadata> {
  const { orderId } = await params;
  return {
    title: `Order ${orderId.slice(0, 8).toUpperCase()} — Admin | PicchuSpot`,
    robots: { index: false, follow: false },
  };
}

// ── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return formatDateTime(iso);
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

function formatUSD(cents: number): string {
  return `US$${(cents / 100).toFixed(2)}`;
}

function groupReferenceFilesByReview(
  files: AdminReworkReferenceFile[],
): Record<string, AdminReworkReferenceFile[]> {
  const grouped: Record<string, AdminReworkReferenceFile[]> = {};
  for (const file of files) {
    grouped[file.review_id] ??= [];
    grouped[file.review_id].push(file);
  }
  return grouped;
}

function SummaryCounter({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof FileImage;
}) {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-light">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {value}
          </p>
        </div>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-surface">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{note}</p>
    </div>
  );
}

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

  // ── Auth guard ────────────────────────────────────────────
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  // ── Data types ────────────────────────────────────────────
  type OrderRow = {
    id: string;
    order_number: string;
    service_type: string;
    status: string;
    client_name: string;
    client_email: string;
    client_company: string | null;
    item_count: number;
    estimated_total_cents: number;
    created_at: string;
    updated_at: string;
  };

  type OrderItem = {
    id: string;
    item_index: number;
    details: Record<string, unknown>;
  };

  // ── State ─────────────────────────────────────────────────
  let order: OrderRow | null = null;
  let deliverables: DeliverableRow[] = [];
  let sourceFiles: AdminSourceFile[] = [];
  let orderItems: OrderItem[] = [];
  let reviews: AdminReview[] = [];
  let reworkReferenceFiles: AdminReworkReferenceFile[] = [];
  let supabaseError: string | null = null;

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // ── Supabase fetch ────────────────────────────────────────
  if (supabaseConfigured) {
    try {
      const supabase = createServerClient();

      // Order row
      const { data: orderData, error: orderErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, service_type, status, " +
            "client_name, client_email, client_company, " +
            "item_count, estimated_total_cents, created_at, updated_at",
        )
        .eq("id", orderId)
        .maybeSingle();

      if (orderErr) {
        supabaseError = orderErr.message;
      } else {
        order = orderData as unknown as OrderRow | null;
      }

      if (order) {
        // Deliverables (all, sorted newest-first)
        const { data: delivData, error: delivErr } = await supabase
          .from("order_deliverables")
          .select(
            "id, order_id, order_number, item_index, " +
              "filename, file_size, mime_type, uploaded_at",
          )
          .eq("order_id", orderId)
          .order("uploaded_at", { ascending: false });

        if (!delivErr) {
          deliverables = (delivData ?? []) as unknown as DeliverableRow[];
        }

        // Order items (source files + details, sorted by item_index)
        const { data: itemData, error: itemErr } = await supabase
          .from("order_items")
          .select(
            "id, item_index, original_photo_path, reference_image_path, details, created_at",
          )
          .eq("order_id", orderId)
          .order("item_index", { ascending: true });

        if (!itemErr && itemData) {
          const typedItemData = itemData as unknown as OrderItemSourceFileRow[];
          sourceFiles = buildAdminSourceFiles(typedItemData);
          orderItems = typedItemData.map((row) => ({
            id: row.id,
            item_index: row.item_index,
            details: row.details ?? {},
          }));
        }

        // Reviews (sorted newest-first so [0] is latest per item)
        const { data: revData } = await supabase
          .from("deliverable_reviews")
          .select(
            "id, deliverable_id, item_index, client_email, status, comment, created_at, " +
              "replacement_deliverable_id, " +
              "order_deliverables!deliverable_reviews_deliverable_id_fkey(filename)",
          )
          .eq("order_id", orderId)
          .order("created_at", { ascending: false });

        if (revData) {
          reviews = (
            revData as unknown as Array<{
              id: string;
              deliverable_id: string;
              item_index: number | null;
              client_email: string;
              status: string;
              comment: string | null;
              created_at: string;
              replacement_deliverable_id: string | null;
              order_deliverables: { filename: string } | null;
            }>
          ).map((r) => ({
            id: r.id,
            deliverable_id: r.deliverable_id,
            item_index: r.item_index,
            client_email: r.client_email,
            status: r.status,
            comment: r.comment,
            created_at: r.created_at,
            replacement_deliverable_id: r.replacement_deliverable_id,
            filename: r.order_deliverables?.filename ?? null,
          }));
        }

        // Rework reference files (safe metadata only; storage_path intentionally excluded)
        const { data: refFileData, error: refFileErr } = await supabase
          .from("deliverable_review_files")
          .select(
            "id, review_id, order_id, deliverable_id, item_index, " +
              "filename, file_size, mime_type, created_at",
          )
          .eq("order_id", orderId)
          .order("created_at", { ascending: true });

        if (refFileErr) {
          console.error(
            "[admin/order-detail] Rework reference file lookup:",
            refFileErr.message,
          );
        } else {
          reworkReferenceFiles =
            (refFileData ?? []) as unknown as AdminReworkReferenceFile[];
        }
      }
    } catch (err) {
      supabaseError = String(err);
    }
  }

  // ── Derived data ──────────────────────────────────────────

  // Replacement review (from ?reviewId= query param)
  const replacementReview = requestedReviewId
    ? (reviews.find(
        (r) =>
          r.id === requestedReviewId &&
          ["rework_requested", "rework_in_progress"].includes(r.status) &&
          !r.replacement_deliverable_id,
      ) ?? null)
    : null;

  // Split replacement review by target
  const imageReplacementReview =
    replacementReview && replacementReview.item_index !== null
      ? replacementReview
      : null;
  const orderLevelReplacementReview =
    replacementReview && replacementReview.item_index === null
      ? replacementReview
      : null;

  // Group data by item_index
  const sourceFilesByItem = groupAdminSourceFilesByItem(sourceFiles);
  const { byImage: deliverablesByImage, orderLevel: orderLevelDeliverables } =
    groupDeliverablesByItem(deliverables);
  const { byImage: reviewsByImage, orderLevel: orderLevelReviews } =
    groupReviewsByItem(reviews);
  const referenceFilesByReview =
    groupReferenceFilesByReview(reworkReferenceFiles);
  const activeReviewCount = reviews.filter((review) =>
    ["rework_requested", "rework_in_progress"].includes(review.status),
  ).length;

  // ── Render ────────────────────────────────────────────────

  return (
    <div>
        {/* ── Page header ── */}
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          {order ? (
            <p className="text-sm text-muted">
              Order{" "}
              <span className="font-mono font-semibold text-primary">
                {order.order_number}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted">Order lookup</p>
          )}
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
          </div>
        </div>

        {/* ── Config / error banners ── */}
        {!supabaseConfigured && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
            Supabase is not configured. Set{" "}
            <code className="font-mono text-[12px]">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="font-mono text-[12px]">
              SUPABASE_SERVICE_ROLE_KEY
            </code>
            .
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
            The selected rework request is no longer active or does not belong
            to this order.
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

        {/* ── Main content (only when order is loaded) ── */}
        {order && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryCounter
                label="Source files"
                value={sourceFiles.length}
                note="Client-uploaded originals and references"
                icon={FileImage}
              />
              <SummaryCounter
                label="Deliverables"
                value={deliverables.length}
                note="Uploaded finished files for this order"
                icon={PackageCheck}
              />
              <SummaryCounter
                label="Active reviews"
                value={activeReviewCount}
                note="Pending or in-progress rework requests"
                icon={RotateCcw}
              />
              <SummaryCounter
                label="References"
                value={reworkReferenceFiles.length}
                note="Files clients attached to rework comments"
                icon={Sparkles}
              />
            </div>

            {/* ── Top section: summary (left) + status/downloads (right) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
              {/* Left: Order summary */}
              <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-surface/60">
                  <h2 className="text-[13px] font-bold text-foreground">
                    Order summary
                  </h2>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                  {[
                    ["Order #", order.order_number],
                    ["Service", getOrderServiceLabel(order.service_type, orderItems.find((it) => it.item_index === 0)?.details?.sub_service as string | undefined)],
                    ["Client", order.client_name],
                    ["Email", order.client_email],
                    ["Company", order.client_company ?? "—"],
                    ["Images", String(order.item_count)],
                    ["Est. total", formatUSD(order.estimated_total_cents)],
                    ["Submitted", formatDate(order.created_at)],
                    ["Updated", formatDate(order.updated_at)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-3 px-5 py-3"
                    >
                      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light flex-shrink-0">
                        {label}
                      </dt>
                      <dd className="text-[12px] text-foreground text-right break-all">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Right: Status + admin downloads */}
              <div className="space-y-4">
                {/* Status card */}
                <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border bg-surface/60">
                    <h2 className="text-[13px] font-bold text-foreground">
                      Status
                    </h2>
                  </div>
                  <div className="px-5 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-semibold border ${
                        STATUS_COLORS[order.status] ??
                        "bg-surface text-muted border-border"
                      }`}
                    >
                      {getOrderStatusLabel(order.status)}
                    </span>
                    <p className="mt-2 text-[11px] text-muted leading-relaxed">
                      To change the order status, use the inline control in{" "}
                      <Link
                        href="/admin/orders"
                        className="underline underline-offset-2 hover:text-primary transition-colors"
                      >
                        Orders list
                      </Link>
                      .
                    </p>
                  </div>
                </div>

                {/* Bulk download card */}
                <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border bg-surface/60">
                    <h2 className="text-[13px] font-bold text-foreground">
                      Bulk downloads
                    </h2>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[12px] text-foreground/70">
                        All source files
                      </span>
                      <BulkDownloadButton
                        endpoint={`/api/admin/orders/${order.id}/source-files/bulk-download`}
                        disabled={sourceFiles.length === 0}
                        emptyLabel="No files"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[12px] text-foreground/70">
                        All deliverables
                      </span>
                      <BulkDownloadButton
                        endpoint={`/api/admin/orders/${order.id}/deliverables/bulk-download`}
                        disabled={deliverables.length === 0}
                        emptyLabel="No files"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Per-image workflow cards ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-primary" aria-hidden />
                <h2 className="text-[13px] font-bold text-foreground">
                  Image workflow
                  <span className="ml-2 text-[11px] font-normal text-muted">
                    ({orderItems.length} image
                    {orderItems.length !== 1 ? "s" : ""})
                  </span>
                </h2>
              </div>

              {orderItems.length > 0 ? (
                <div className="space-y-4">
                  {orderItems.map((item) => {
                    const itemSources =
                      sourceFilesByItem.get(item.item_index) ?? [];
                    const itemDeliverables =
                      deliverablesByImage.get(item.item_index) ?? [];
                    const itemReviews =
                      reviewsByImage.get(item.item_index) ?? [];

                    // Match replacement review to this image
                    const cardReplacementReview =
                      imageReplacementReview?.item_index === item.item_index
                        ? {
                            id: imageReplacementReview.id,
                            itemIndex: imageReplacementReview.item_index,
                            filename: imageReplacementReview.filename,
                          }
                        : null;

                    return (
                      <AdminOrderImageCard
                        key={item.id}
                        orderId={order.id}
                        imageNumber={item.item_index + 1}
                        imageCount={order.item_count}
                        details={item.details}
                        sourceFiles={itemSources}
                        initialDeliverables={itemDeliverables}
                        reviews={itemReviews}
                        referenceFilesByReview={referenceFilesByReview}
                        replacementReview={cardReplacementReview}
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
                    No image items found
                  </p>
                  <p className="text-xs text-muted max-w-xs leading-relaxed">
                    Per-image cards will appear here once order items have been
                    recorded.
                  </p>
                </div>
              )}
            </section>

            {/* ── Order-level files section ── */}
            <section>
              <div className="mb-4 flex items-start gap-2">
                <FolderOpen className="mt-0.5 w-4 h-4 text-primary" aria-hidden />
                <div>
                  <h2 className="text-[13px] font-bold text-foreground">
                    Order-level files
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Files here are not tied to one image, such as ZIPs or
                    order-wide deliverables.
                  </p>
                </div>
              </div>

              <AdminDeliverableUpload
                orderId={order.id}
                orderNumber={order.order_number}
                itemCount={order.item_count}
                initialDeliverables={orderLevelDeliverables}
                fixedItemIndex={null}
                replacementReview={
                  orderLevelReplacementReview
                    ? {
                        id: orderLevelReplacementReview.id,
                        itemIndex: orderLevelReplacementReview.item_index,
                        filename: orderLevelReplacementReview.filename,
                      }
                    : null
                }
              />

              {/* Order-level reviews */}
              {orderLevelReviews.length > 0 && (
                <div className="mt-5 bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-primary" aria-hidden />
                    <h3 className="text-[13px] font-bold text-foreground">
                      Order-level review status
                    </h3>
                    <span className="ml-auto text-[11px] text-muted-light">
                      {orderLevelReviews.length} review
                      {orderLevelReviews.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {orderLevelReviews.map((r) => (
                      <li key={r.id} className="px-5 py-3 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="text-muted-light font-semibold capitalize">
                            {getReviewStatusLabel(r.status)}
                          </span>
                          {r.filename && (
                            <span className="text-muted truncate max-w-[150px]">
                              {r.filename}
                            </span>
                          )}
                          <span className="text-muted">
                            {formatDate(r.created_at)}
                          </span>
                        </div>
                        {r.comment && (
                          <p
                            className="text-[11px] text-foreground/70 leading-snug pl-1 truncate max-w-[400px]"
                            title={r.comment}
                          >
                            &ldquo;{r.comment}&rdquo;
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        )}
    </div>
  );
}
