"use client";

// ============================================================
// AdminDeliverableUpload
//
// Admin UI for uploading finished deliverable files for one order.
// Shows existing deliverables with a delete button, and a file
// picker + upload control for adding new files.
//
// Phase 5C: admin can assign each upload to:
//   - Order-level (item_index: null)
//   - Image 1 … Image N  (item_index: 0 … N-1)
//
// Upload flow:
//   1. Admin selects assignment target from dropdown.
//   2. Admin picks a file.
//   3. POST /api/admin/orders/[orderId]/deliverables/upload-url
//      → receives { path, signedUrl, token }
//   4. Browser PUTs file bytes directly to Supabase Storage.
//      (No bytes flow through Next.js — avoids Vercel 4.5 MB limit.)
//   5. POST /api/admin/orders/[orderId]/deliverables
//      → registers the row in order_deliverables with item_index.
//   6. onDeliverableAdded() callback updates parent state.
// ============================================================

import { useRef, useState } from "react";
import {
  Upload,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Tag,
} from "lucide-react";
import BulkDownloadButton from "@/components/BulkDownloadButton";
import FilePreviewCard from "@/components/FilePreviewCard";
import {
  ADMIN_DELIVERABLE_MAX_BYTES,
  ADMIN_DELIVERABLE_MAX_MB,
  ALLOWED_DELIVERABLE_MIME_TYPES,
  ALLOWED_DELIVERABLE_EXTENSIONS,
} from "@/lib/deliverables-config";
import {
  formatBytes,
  formatDateTime as formatDate,
  itemLabel as sharedItemLabel,
} from "@/lib/display/file-format";
import type { StaticImageViewerVariant } from "@/components/media/static-image-variant";

// ── Types ──────────────────────────────────────────────────────

export interface DeliverableRow {
  id: string;
  order_id: string;
  order_number: string;
  item_index: number | null;
  filename: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

interface Props {
  viewerVariant: StaticImageViewerVariant;
  orderId: string;
  orderNumber: string;
  /** Total number of source images in the order. Drives the assignment dropdown. */
  itemCount: number;
  initialDeliverables: DeliverableRow[];
  replacementReview?: {
    id: string;
    itemIndex: number | null;
    filename: string | null;
  } | null;
  onDeliverableAdded?: (row: DeliverableRow) => void;
  onDeliverableDeleted?: (id: string) => void;
  /**
   * When provided, skips the assignment dropdown and always uploads to this
   * item. Pass `null` for order-level; pass a number for a specific image index.
   */
  fixedItemIndex?: number | null;
}

// ── Helpers ────────────────────────────────────────────────────

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

/** Human-readable label for an item_index value. */
export function itemLabel(itemIndex: number | null): string {
  return sharedItemLabel(itemIndex);
}

// Sentinel string value used in the <select> to represent null (order-level).
const ORDER_LEVEL_VALUE = "__order_level__";

// ── Component ──────────────────────────────────────────────────

export default function AdminDeliverableUpload({
  viewerVariant,
  orderId,
  orderNumber,
  itemCount,
  initialDeliverables,
  replacementReview = null,
  onDeliverableAdded,
  onDeliverableDeleted,
  fixedItemIndex,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [deliverables, setDeliverables] =
    useState<DeliverableRow[]>(initialDeliverables);
  const [selectedTarget, setSelectedTarget] = useState<string>(
    replacementReview
      ? replacementReview.itemIndex === null
        ? ORDER_LEVEL_VALUE
        : String(replacementReview.itemIndex)
      : ORDER_LEVEL_VALUE,
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Derive item_index (null | number) from the select value.
  // When fixedItemIndex is provided, it always wins over the dropdown.
  function getItemIndex(): number | null {
    if (fixedItemIndex !== undefined) return fixedItemIndex;
    if (selectedTarget === ORDER_LEVEL_VALUE) return null;
    const n = parseInt(selectedTarget, 10);
    return isNaN(n) ? null : n;
  }

  // ── Upload ─────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target) return;
    // Reset input so the same file can be re-selected after an error
    (e.target as HTMLInputElement).value = "";
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // Client-side validation
    if (file.size > ADMIN_DELIVERABLE_MAX_BYTES) {
      setErrorMsg(
        `File is too large. Maximum is ${ADMIN_DELIVERABLE_MAX_MB} MB.`,
      );
      return;
    }
    if (!isMimeAccepted(file.type || "application/octet-stream", file.name)) {
      setErrorMsg(`File type "${file.type}" is not allowed.`);
      return;
    }

    const itemIndex = getItemIndex();

    setUploading(true);
    setProgress("Requesting upload URL…");

    try {
      // Step 1 — get signed upload URL
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
        token: string;
      };

      // Step 2 — PUT file bytes directly to Supabase Storage
      setProgress("Uploading file…");
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Storage upload failed (HTTP ${putRes.status}).`);
      }

      // Step 3 — register the row in order_deliverables with item_index
      setProgress("Registering file…");
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

      if (replacementReview) {
        setProgress("Linking replacement to rework request...");
        const linkRes = await fetch(
          `/api/admin/reviews/${replacementReview.id}/replacement`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ replacementDeliverableId: deliverable.id }),
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
      onDeliverableAdded?.(deliverable);

      const targetLabel =
        itemIndex === null ? "Order-level" : `Image ${itemIndex + 1}`;
      setSuccessMsg(
        replacementReview
          ? `"${file.name}" uploaded as the replacement for ${targetLabel}.`
          : `"${file.name}" uploaded as ${targetLabel}.`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  // ── Delete ─────────────────────────────────────────────────

  async function handleDelete(id: string, filename: string) {
    const confirmed = window.confirm(
      `Delete "${filename}"? This will also remove the file from storage.`,
    );
    if (!confirmed) return;

    setDeletingId(id);
    setErrorMsg(null);
    setSuccessMsg(null);

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
      onDeliverableDeleted?.(id);
      setSuccessMsg(`"${filename}" deleted.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Upload control ── */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" aria-hidden />
          <h3 className="text-[13px] font-bold text-foreground">
            {replacementReview
              ? "Upload replacement"
              : fixedItemIndex !== undefined
                ? fixedItemIndex === null
                  ? "Upload order-level file"
                  : `Upload deliverable for Image ${fixedItemIndex + 1}`
                : "Upload deliverable"}
          </h3>
          <span className="ml-auto text-[10px] text-muted-light font-medium">
            Max {ADMIN_DELIVERABLE_MAX_MB} MB · JPG/PNG/WebP/TIFF/PDF/ZIP
          </span>
        </div>

        <div className="px-5 py-5 space-y-4">
          {replacementReview && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-[12px] text-foreground">
              <p className="font-semibold text-primary">
                Uploading replacement for{" "}
                {itemLabel(replacementReview.itemIndex)}
              </p>
              {replacementReview.filename && (
                <p className="mt-0.5 text-muted">
                  Original file: {replacementReview.filename}
                </p>
              )}
            </div>
          )}

          {/* ── Assignment dropdown — hidden in fixed-item mode ── */}
          {fixedItemIndex === undefined && (
            <div>
              <label
                htmlFor="deliverable-target"
                className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light mb-1.5"
              >
                <Tag className="inline w-3 h-3 mr-1 -mt-px" aria-hidden />
                Assign to
              </label>
              <select
                id="deliverable-target"
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                disabled={uploading || Boolean(replacementReview)}
                className="w-full sm:w-64 px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value={ORDER_LEVEL_VALUE}>
                  Order-level file / ZIP
                </option>
                {Array.from({ length: Math.max(0, itemCount) }, (_, i) => (
                  <option key={i} value={String(i)}>
                    Image {i + 1}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted">
                {itemCount > 0
                  ? `This order has ${itemCount} image${itemCount !== 1 ? "s" : ""}.`
                  : "No image count set — only order-level upload available."}
              </p>
            </div>
          )}

          {/* ── File picker ── */}
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-light transition-colors shadow-sm disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  {progress ?? "Uploading…"}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" aria-hidden />
                  {replacementReview
                    ? "Choose replacement file"
                    : "Choose file to upload"}
                </>
              )}
            </button>

            <p className="mt-2 text-[11px] text-muted leading-relaxed">
              The file will be stored in the private{" "}
              <code className="font-mono bg-surface px-1 rounded">
                deliverables
              </code>{" "}
              bucket under{" "}
              <code className="font-mono bg-surface px-1 rounded">
                {orderNumber}/
              </code>
              . The client can then download it from their dashboard.
            </p>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="flex items-start gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle
                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                aria-hidden
              />
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <CheckCircle2
                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                aria-hidden
              />
              {successMsg}
            </div>
          )}
        </div>
      </div>

      {/* ── Existing deliverables list ── */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" aria-hidden />
          <h3 className="text-[13px] font-bold text-foreground">
            {fixedItemIndex !== undefined
              ? "Uploaded deliverable"
              : "Uploaded deliverables"}
          </h3>
          <div className="ml-auto flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-[11px] text-muted-light text-right">
              {deliverables.length} file{deliverables.length !== 1 ? "s" : ""}
            </span>
            <BulkDownloadButton
              endpoint={`/api/admin/orders/${orderId}/deliverables/bulk-download`}
              disabled={deliverables.length === 0}
              emptyLabel="No files"
            />
          </div>
        </div>

        {deliverables.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted">
            No deliverables uploaded yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {deliverables.map((d) => (
              <li
                key={d.id}
                className="px-5 py-3.5 hover:bg-surface/40 transition-colors"
              >
                <FilePreviewCard
                  viewerVariant={viewerVariant}
                  filename={d.filename}
                  mimeType={d.mime_type}
                  fileSizeLabel={formatBytes(d.file_size)}
                  badgeLabel={itemLabel(d.item_index)}
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
