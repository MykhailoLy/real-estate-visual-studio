"use client";

import { Pencil } from "lucide-react";
import { RegionalCentsText } from "@/components/pricing/currency-client";
import LocalFilePreview from "@/components/order/LocalFilePreview";

// ============================================================
// OrderReviewItem — one read-only photo card on the Review step.
//
// Shows a local preview (or file fallback), filename, file size, a
// list of readable preference rows, the item subtotal, and an Edit
// button that returns the client to the matching Configure card.
// Generic over the row list so it does not duplicate any form code.
// ============================================================

export interface ReviewRow {
  label: string;
  value: string;
}

interface OrderReviewItemProps {
  index: number;
  file: File | null;
  rows: ReviewRow[];
  subtotalCents: number;
  onEdit: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function OrderReviewItem({
  index,
  file,
  rows,
  subtotalCents,
  onEdit,
}: OrderReviewItemProps) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-foreground">
          Photo #{index + 1}
        </h4>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          aria-label={`Edit photo ${index + 1}`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="sm:w-44 flex-shrink-0">
          {file ? (
            <LocalFilePreview
              file={file}
              alt={`Photo ${index + 1} preview`}
              className="aspect-video w-full"
            />
          ) : (
            <div className="aspect-video w-full rounded-lg border border-border bg-surface flex items-center justify-center text-[11px] font-semibold text-muted">
              No file
            </div>
          )}
          {file && (
            <div className="mt-2">
              <p
                className="text-[12px] font-semibold text-foreground truncate"
                title={file.name}
              >
                {file.name}
              </p>
              <p className="text-[11px] text-muted">{formatFileSize(file.size)}</p>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {rows.map((r) => (
              <div key={r.label} className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light mb-0.5">
                  {r.label}
                </dt>
                <dd className="text-[13px] text-foreground/80 break-words">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
            <span className="text-sm font-medium text-muted">Item Subtotal</span>
            <span className="text-base font-bold text-primary">
              <RegionalCentsText cents={subtotalCents} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
