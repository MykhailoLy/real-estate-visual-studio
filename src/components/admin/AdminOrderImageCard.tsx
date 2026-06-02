"use client";

// ============================================================
// AdminOrderImageCard
//
// Per-image workflow card for the admin order detail page.
// Each card represents one order image and shows:
//
//   Left   — Client source / Original (and reference if present)
//   Middle — Uploaded deliverable / After (with delete)
//   Right  — Request details, upload control, rework/review status
//
// This component owns its own deliverables and review list state
// so uploads, deletes, and review-status changes update the UI
// immediately without a full-page reload.
//
// Upload logic mirrors AdminDeliverableUpload but is fixed to a
// single item_index — no dropdown, no duplication of business logic.
// The same three API routes are used:
//   POST /deliverables/upload-url → signed URL
//   PUT  → Supabase Storage
//   POST /deliverables            → register row
//   PATCH /reviews/:id/replacement (when replacementReview is set)
// ============================================================

import type React from "react";
import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileImage,
  Hourglass,
  Loader2,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import FilePreviewCard from "@/components/FilePreviewCard";
import OrderItemDetails from "@/components/order/OrderItemDetails";
import type { AdminSourceFile } from "@/lib/admin-source-files";
import type { AdminReview } from "@/lib/admin-order-workflow";
import type { DeliverableRow } from "@/components/admin/AdminDeliverableUpload";
import {
  ADMIN_DELIVERABLE_MAX_BYTES,
  ADMIN_DELIVERABLE_MAX_MB,
  ALLOWED_DELIVERABLE_EXTENSIONS,
  ALLOWED_DELIVERABLE_MIME_TYPES,
} from "@/lib/deliverables-config";

// ── Types ──────────────────────────────────────────────────────

interface Props {
  orderId: string;
  /** 1-based image number shown to the user. */
  imageNumber: number;
  imageCount: number;
  details: Record<string, unknown>;
  sourceFiles: AdminSourceFile[];
  initialDeliverables: DeliverableRow[];
  /** Reviews for this image, sorted newest-first by the server. */
  reviews: AdminReview[];
  referenceFilesByReview?: Record<string, AdminReworkReferenceFile[]>;
  /** When set, the upload control is pre-wired to replace this review. */
  replacementReview?: {
    id: string;
    itemIndex: number | null;
    filename: string | null;
  } | null;
}

export interface AdminReworkReferenceFile {
  id: string;
  review_id: string;
  order_id: string;
  deliverable_id: string;
  item_index: number | null;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

// ── Review-status badge config ─────────────────────────────────

const REVIEW_BADGE: Record<
  string,
  { label: string; cls: string; icon: React.ReactNode }
> = {
  rework_requested: {
    label: "Pending Rework",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <RotateCcw className="w-3 h-3" aria-hidden />,
  },
  rework_in_progress: {
    label: "Rework In Progress",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="w-3 h-3" aria-hidden />,
  },
  rework_delivered: {
    label: "New Version Ready",
    cls: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <Sparkles className="w-3 h-3" aria-hidden />,
  },
  approved: {
    label: "Approved",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3" aria-hidden />,
  },
  resolved: {
    label: "Resolved",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3" aria-hidden />,
  },
};

// ── Helpers ────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function isMimeAccepted(mime: string, filename: string): boolean {
  if ((ALLOWED_DELIVERABLE_MIME_TYPES as readonly string[]).includes(mime)) {
    if (mime === "application/octet-stream") {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      return (ALLOWED_DELIVERABLE_EXTENSIONS as readonly string[]).includes(
        ext,
      );
    }
    return true;
  }
  return false;
}

// ── Sub-components ─────────────────────────────────────────────

function WorkflowPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light mb-2">
        {title}
      </h4>
      {children}
    </section>
  );
}

function LargePreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "rounded-lg border border-border bg-white p-3",
        "[&>div]:sm:flex-col [&>div]:sm:items-stretch",
        "[&>div>button:first-child]:sm:!w-full",
        "[&>div>button:first-child]:sm:!h-48",
        "[&>div>button:first-child]:lg:!h-56",
        "[&>div>div:last-child]:sm:flex-row",
        "[&>div>div:last-child]:sm:items-start",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function SourcePlaceholder() {
  return (
    <div className="h-full min-h-48 rounded-lg border border-dashed border-border bg-surface/60 px-4 py-5 flex flex-col items-center justify-center text-center">
      <FileImage className="w-8 h-8 text-muted-light" aria-hidden />
      <p className="mt-2 text-[13px] font-semibold text-foreground">
        No source file
      </p>
      <p className="mt-1 text-[11px] text-muted leading-relaxed">
        No original photo was uploaded for this image.
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function AdminOrderImageCard({
  orderId,
  imageNumber,
  imageCount,
  details,
  sourceFiles,
  initialDeliverables,
  reviews,
  referenceFilesByReview = {},
  replacementReview = null,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const itemIndex = imageNumber - 1; // zero-based

  // ── State ─────────────────────────────────────────────────

  const [deliverables, setDeliverables] =
    useState<DeliverableRow[]>(initialDeliverables);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [reviewList, setReviewList] = useState<AdminReview[]>(reviews);
  const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // ── Derived values ──────────────────────────────────────

  const originalSource = sourceFiles.find((f) => f.kind === "original") ?? null;
  const referenceSource =
    sourceFiles.find((f) => f.kind === "reference") ?? null;

  // Derive card-header status badge from the latest review
  const latestReview = reviewList[0] ?? null;
  const cardBadge = latestReview
    ? (REVIEW_BADGE[latestReview.status] ?? null)
    : null;

  // ── Upload ─────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (e.target) (e.target as HTMLInputElement).value = "";
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    if (file.size > ADMIN_DELIVERABLE_MAX_BYTES) {
      setUploadError(
        `File is too large. Maximum is ${ADMIN_DELIVERABLE_MAX_MB} MB.`,
      );
      return;
    }
    if (!isMimeAccepted(file.type || "application/octet-stream", file.name)) {
      setUploadError(`File type "${file.type}" is not allowed.`);
      return;
    }

    setUploading(true);
    setUploadProgress("Requesting upload URL…");

    try {
      // Step 1 — signed upload URL
      const urlRes = await fetch(
        `/api/admin/orders/${orderId}/deliverables/upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            filename: file.name,
            content_type: file.type || "application/octet-stream",
            file_size: file.size,
          }),
        },
      );
      if (!urlRes.ok) {
        const body = (await urlRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Could not get upload URL.");
      }
      const { signedUrl, path } = (await urlRes.json()) as {
        signedUrl: string;
        path: string;
      };

      // Step 2 — PUT directly to Supabase Storage
      setUploadProgress("Uploading file…");
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Storage upload failed (HTTP ${putRes.status}).`);
      }

      // Step 3 — register row in order_deliverables
      setUploadProgress("Registering file…");
      const regRes = await fetch(`/api/admin/orders/${orderId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          path,
          filename: file.name,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          item_index: itemIndex,
        }),
      });
      if (!regRes.ok) {
        const body = (await regRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Could not register deliverable.");
      }
      const { deliverable } = (await regRes.json()) as {
        deliverable: DeliverableRow;
      };

      // Step 4 — link to rework review if this is a replacement
      if (replacementReview) {
        setUploadProgress("Linking replacement to rework request…");
        const linkRes = await fetch(
          `/api/admin/reviews/${replacementReview.id}/replacement`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              replacementDeliverableId: deliverable.id,
            }),
          },
        );
        if (!linkRes.ok) {
          const body = (await linkRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            `File uploaded, but replacement could not be linked: ${body.error ?? "Link failed."}`,
          );
        }
      }

      setDeliverables((prev) => [deliverable, ...prev]);
      setUploadSuccess(
        replacementReview
          ? `"${file.name}" uploaded as replacement for Image ${imageNumber}.`
          : `"${file.name}" uploaded for Image ${imageNumber}.`,
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  // ── Delete ─────────────────────────────────────────────────

  async function handleDelete(id: string, filename: string) {
    if (
      !window.confirm(
        `Delete "${filename}"? This will also remove the file from storage.`,
      )
    )
      return;

    setDeletingId(id);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/deliverables`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ deliverable_id: id, delete_file: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not delete deliverable.");
      }
      setDeliverables((prev) => prev.filter((d) => d.id !== id));
      setUploadSuccess(`"${filename}" deleted.`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Review status ──────────────────────────────────────────

  async function updateReviewStatus(
    reviewId: string,
    newStatus: "rework_in_progress" | "resolved",
  ) {
    setUpdatingReviewId(reviewId);
    setReviewError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok)
        throw new Error(data.error ?? "Status update failed.");
      setReviewList((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, status: newStatus } : r)),
      );
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setUpdatingReviewId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <article className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      {/* ── Card header ── */}
      <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-[14px] font-bold text-foreground">
          Image {imageNumber} of {imageCount}
        </h3>
        {cardBadge && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold self-start sm:self-center ${cardBadge.cls}`}
          >
            {cardBadge.icon}
            {cardBadge.label}
          </span>
        )}
      </div>

      {/* ── Three-column body ── */}
      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-4 xl:gap-5 items-start">
          {/* Left: Client source / Original */}
          <WorkflowPanel title="Client source / Original">
            {originalSource ? (
              <LargePreviewFrame>
                <FilePreviewCard
                  filename={originalSource.filename}
                  mimeType={originalSource.mimeType}
                  fileSizeLabel={formatBytes(originalSource.fileSize)}
                  badgeLabel="Original"
                  signedUrlEndpoint={`/api/admin/orders/${orderId}/source-files/${originalSource.id}/download-url`}
                  downloadLabel="Download"
                  meta={
                    <p className="text-[11px] text-muted">
                      {originalSource.uploadedAt &&
                        `${formatDate(originalSource.uploadedAt)} · `}
                      Original
                    </p>
                  }
                />
              </LargePreviewFrame>
            ) : (
              <SourcePlaceholder />
            )}

            {referenceSource && (
              <div className="mt-3 rounded-lg border border-border bg-surface/30 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
                  Reference file
                </p>
                <FilePreviewCard
                  filename={referenceSource.filename}
                  mimeType={referenceSource.mimeType}
                  fileSizeLabel={formatBytes(referenceSource.fileSize)}
                  badgeLabel="Reference"
                  signedUrlEndpoint={`/api/admin/orders/${orderId}/source-files/${referenceSource.id}/download-url`}
                  downloadLabel="Download"
                />
              </div>
            )}
          </WorkflowPanel>

          {/* Middle: Uploaded deliverable / After */}
          <WorkflowPanel title="Uploaded deliverable / After">
            {deliverables.length > 0 ? (
              <ul className="space-y-3">
                {deliverables.map((d) => (
                  <li key={d.id}>
                    <LargePreviewFrame>
                      <FilePreviewCard
                        filename={d.filename}
                        mimeType={d.mime_type}
                        fileSizeLabel={formatBytes(d.file_size) ?? undefined}
                        badgeLabel={`Image ${imageNumber}`}
                        signedUrlEndpoint={`/api/admin/orders/${orderId}/deliverables/${d.id}/download-url`}
                        downloadLabel="Download"
                        meta={
                          <p className="text-[11px] text-muted">
                            {formatDate(d.uploaded_at)}
                          </p>
                        }
                        actions={
                          <button
                            type="button"
                            onClick={() => handleDelete(d.id, d.filename)}
                            disabled={deletingId === d.id}
                            className="p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 flex-shrink-0"
                            title="Delete deliverable"
                          >
                            {deletingId === d.id ? (
                              <Loader2
                                className="w-3.5 h-3.5 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" aria-hidden />
                            )}
                          </button>
                        }
                      />
                    </LargePreviewFrame>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="min-h-40 rounded-lg border border-border bg-surface/50 px-4 py-6 flex flex-col items-center justify-center text-center">
                <Hourglass className="w-7 h-7 text-muted-light" aria-hidden />
                <p className="mt-2 text-[13px] font-semibold text-foreground">
                  Awaiting upload
                </p>
                <p className="mt-1 text-[11px] text-muted leading-relaxed max-w-[200px]">
                  No deliverable uploaded for this image yet.
                </p>
              </div>
            )}

            {/* Feedback shared between upload and delete */}
            {(uploadError || uploadSuccess) && (
              <div
                className={`mt-3 flex items-start gap-2 text-[11px] rounded-lg px-3 py-2 border ${
                  uploadError
                    ? "text-red-700 bg-red-50 border-red-200"
                    : "text-emerald-700 bg-emerald-50 border-emerald-200"
                }`}
              >
                {uploadError ? (
                  <AlertCircle
                    className="w-3 h-3 flex-shrink-0 mt-0.5"
                    aria-hidden
                  />
                ) : (
                  <CheckCircle2
                    className="w-3 h-3 flex-shrink-0 mt-0.5"
                    aria-hidden
                  />
                )}
                {uploadError ?? uploadSuccess}
              </div>
            )}
          </WorkflowPanel>

          {/* Right: Request details & Admin actions */}
          <WorkflowPanel title="Request details & Admin actions">
            {/* OrderItemDetails */}
            <div className="rounded-lg border border-border bg-surface/30 p-4">
              <OrderItemDetails details={details} />
            </div>

            {/* Upload control */}
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
                Upload deliverable for Image {imageNumber}
              </p>

              {replacementReview && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-[12px] text-foreground">
                  <p className="font-semibold text-primary">
                    Uploading replacement
                  </p>
                  {replacementReview.filename && (
                    <p className="mt-0.5 text-muted">
                      Original: {replacementReview.filename}
                    </p>
                  )}
                </div>
              )}

              <div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.webp,.tif,.tiff,.pdf,.zip"
                  disabled={uploading}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[12px] font-bold hover:bg-primary-light transition-colors shadow-sm disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <Loader2
                        className="w-3.5 h-3.5 animate-spin"
                        aria-hidden
                      />
                      {uploadProgress ?? "Uploading…"}
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" aria-hidden />
                      {replacementReview
                        ? "Upload replacement"
                        : "Upload deliverable"}
                    </>
                  )}
                </button>
                <p className="mt-1.5 text-[10px] text-muted">
                  Max {ADMIN_DELIVERABLE_MAX_MB} MB · JPG/PNG/WebP/TIFF/PDF/ZIP
                </p>
              </div>
            </div>

            {/* Review / rework status */}
            {reviewList.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light mb-2">
                  Client review status
                </p>
                <div className="space-y-2">
                  {reviewList.map((r) => {
                    const badge = REVIEW_BADGE[r.status] ?? null;
                    const isUpdating = updatingReviewId === r.id;
                    const isActive =
                      ["rework_requested", "rework_in_progress"].includes(
                        r.status,
                      ) && !r.replacement_deliverable_id;

                    return (
                      <div
                        key={r.id}
                        className="rounded-lg border border-border bg-surface/30 p-3 space-y-2"
                      >
                        {/* Status badge row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-full">
                            <Tag className="w-2.5 h-2.5" aria-hidden />
                            Image {imageNumber}
                          </span>
                          {badge && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${badge.cls}`}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                          )}
                        </div>

                        {/* Client comment */}
                        {r.comment && (
                          <p className="text-[11px] text-foreground/80 bg-white border border-border rounded px-2.5 py-1.5 leading-relaxed">
                            <MessageSquare
                              className="inline w-3 h-3 mr-1 -mt-px text-muted"
                              aria-hidden
                            />
                            {r.comment}
                          </p>
                        )}

                        {referenceFilesByReview[r.id]?.length > 0 && (
                          <div className="rounded-lg border border-border bg-white px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
                                Client reference files
                              </p>
                              <span className="text-[10px] font-semibold text-muted">
                                {referenceFilesByReview[r.id].length} file
                                {referenceFilesByReview[r.id].length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <ul className="space-y-2">
                              {referenceFilesByReview[r.id].map((file) => (
                                <li key={file.id}>
                                  <FilePreviewCard
                                    filename={file.filename}
                                    mimeType={file.mime_type}
                                    fileSizeLabel={formatBytes(file.file_size)}
                                    badgeLabel="Reference"
                                    signedUrlEndpoint={`/api/admin/orders/${orderId}/reviews/${r.id}/reference-files/${file.id}/download-url`}
                                    downloadLabel="Download"
                                    meta={
                                      <p className="text-[10px] text-muted">
                                        {formatDate(file.created_at)}
                                      </p>
                                    }
                                  />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Action buttons for active reviews */}
                        {isActive && (
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {r.status === "rework_requested" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateReviewStatus(r.id, "rework_in_progress")
                                }
                                disabled={isUpdating}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
                              >
                                {isUpdating ? (
                                  <Loader2
                                    className="w-3 h-3 animate-spin"
                                    aria-hidden
                                  />
                                ) : (
                                  <Clock className="w-3 h-3" aria-hidden />
                                )}
                                Mark in progress
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                updateReviewStatus(r.id, "resolved")
                              }
                              disabled={isUpdating}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
                            >
                              {isUpdating ? (
                                <Loader2
                                  className="w-3 h-3 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" aria-hidden />
                              )}
                              Mark resolved
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {reviewError && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-red-600">
                    <AlertCircle
                      className="w-3 h-3 flex-shrink-0"
                      aria-hidden
                    />
                    {reviewError}
                  </p>
                )}
              </div>
            )}
          </WorkflowPanel>
        </div>
      </div>
    </article>
  );
}
