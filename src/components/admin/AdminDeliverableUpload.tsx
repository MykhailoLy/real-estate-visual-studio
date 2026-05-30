"use client";

// ============================================================
// AdminDeliverableUpload
//
// Admin UI for uploading finished deliverable files for one order.
// Shows existing deliverables with a delete button, and a file
// picker + upload control for adding new files.
//
// Upload flow:
//   1. Admin picks a file.
//   2. POST /api/admin/orders/[orderId]/deliverables/upload-url
//      → receives { path, signedUrl, token }
//   3. Browser PUTs file bytes directly to Supabase Storage.
//      (No bytes flow through Next.js — avoids Vercel 4.5 MB limit.)
//   4. POST /api/admin/orders/[orderId]/deliverables
//      → registers the row in order_deliverables.
//   5. onDeliverableAdded() callback updates parent state.
// ============================================================

import { useRef, useState } from "react";
import {
  Upload,
  Loader2,
  Trash2,
  FileText,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
} from "lucide-react";
import {
  ADMIN_DELIVERABLE_MAX_BYTES,
  ADMIN_DELIVERABLE_MAX_MB,
  ALLOWED_DELIVERABLE_MIME_TYPES,
  ALLOWED_DELIVERABLE_EXTENSIONS,
} from "@/lib/client-deliverables";

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
  orderId: string;
  orderNumber: string;
  initialDeliverables: DeliverableRow[];
  onDeliverableAdded?: (row: DeliverableRow) => void;
  onDeliverableDeleted?: (id: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-primary" aria-hidden />;
  return <FileText className="w-4 h-4 text-primary" aria-hidden />;
}

function isMimeAccepted(mime: string, filename: string): boolean {
  if ((ALLOWED_DELIVERABLE_MIME_TYPES as readonly string[]).includes(mime)) {
    if (mime === "application/octet-stream") {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      return (ALLOWED_DELIVERABLE_EXTENSIONS as readonly string[]).includes(ext);
    }
    return true;
  }
  return false;
}

// ── Component ──────────────────────────────────────────────────

export default function AdminDeliverableUpload({
  orderId,
  orderNumber,
  initialDeliverables,
  onDeliverableAdded,
  onDeliverableDeleted,
}: Props) {
  const fileRef                     = useRef<HTMLInputElement>(null);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>(initialDeliverables);
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      setErrorMsg(`File is too large. Maximum is ${ADMIN_DELIVERABLE_MAX_MB} MB.`);
      return;
    }
    if (!isMimeAccepted(file.type || "application/octet-stream", file.name)) {
      setErrorMsg(`File type "${file.type}" is not allowed.`);
      return;
    }

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
            filename:     file.name,
            content_type: file.type || "application/octet-stream",
            file_size:    file.size,
          }),
        }
      );

      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Could not get upload URL.");
      }

      const { signedUrl, path } = await urlRes.json() as {
        signedUrl: string; path: string; token: string;
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

      // Step 3 — register the row in order_deliverables
      setProgress("Registering file…");
      const regRes = await fetch(
        `/api/admin/orders/${orderId}/deliverables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            path,
            filename:   file.name,
            file_size:  file.size,
            mime_type:  file.type || "application/octet-stream",
            item_index: null,
          }),
        }
      );

      if (!regRes.ok) {
        const body = await regRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Could not register deliverable.");
      }

      const { deliverable } = await regRes.json() as { deliverable: DeliverableRow };

      setDeliverables((prev) => [deliverable, ...prev]);
      onDeliverableAdded?.(deliverable);
      setSuccessMsg(`"${file.name}" uploaded successfully.`);
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
      `Delete "${filename}"? This will also remove the file from storage.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        `/api/admin/orders/${orderId}/deliverables`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ deliverable_id: id, delete_file: true }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
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
            Upload deliverable
          </h3>
          <span className="ml-auto text-[10px] text-muted-light font-medium">
            Max {ADMIN_DELIVERABLE_MAX_MB} MB · JPG/PNG/WebP/TIFF/PDF/ZIP
          </span>
        </div>

        <div className="px-5 py-5">
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
              <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                {progress ?? "Uploading…"}</>
            ) : (
              <><Upload className="w-4 h-4" aria-hidden />Choose file to upload</>
            )}
          </button>

          <p className="mt-2 text-[11px] text-muted leading-relaxed">
            The file will be stored in the private{" "}
            <code className="font-mono bg-surface px-1 rounded">deliverables</code>{" "}
            bucket under{" "}
            <code className="font-mono bg-surface px-1 rounded">{orderNumber}/</code>.
            The client can then download it from their dashboard.
          </p>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="mt-3 flex items-start gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mt-3 flex items-start gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
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
            Uploaded deliverables
          </h3>
          <span className="ml-auto text-[11px] text-muted-light">
            {deliverables.length} file{deliverables.length !== 1 ? "s" : ""}
          </span>
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
                className="px-5 py-3.5 flex items-center gap-3 hover:bg-surface/40 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/12 flex items-center justify-center flex-shrink-0">
                  {fileIcon(d.mime_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {d.filename}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatBytes(d.file_size)} · {formatDate(d.uploaded_at)}
                    {d.item_index !== null && (
                      <span className="ml-2 text-muted-light">
                        (item {d.item_index + 1})
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(d.id, d.filename)}
                  disabled={deletingId === d.id}
                  className="p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 flex-shrink-0"
                  title="Delete deliverable"
                >
                  {deletingId === d.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                    : <Trash2 className="w-3.5 h-3.5" aria-hidden />
                  }
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
