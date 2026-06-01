// ============================================================
// admin-order-workflow.ts
//
// Pure grouping helpers for the admin per-image order workflow.
// No server-only imports — safe to use from both server
// components and "use client" components (type imports only).
// ============================================================

import type { AdminSourceFile } from "@/lib/admin-source-files";
import type { DeliverableRow } from "@/components/admin/AdminDeliverableUpload";

// ── Types ──────────────────────────────────────────────────────

export type AdminReview = {
  id: string;
  deliverable_id: string;
  item_index: number | null;
  client_email: string;
  status: string;
  comment: string | null;
  created_at: string;
  replacement_deliverable_id: string | null;
  filename: string | null;
};

// ── Grouping helpers ───────────────────────────────────────────

/** Groups AdminSourceFile[] by itemIndex. */
export function groupAdminSourceFilesByItem(
  files: AdminSourceFile[]
): Map<number, AdminSourceFile[]> {
  const map = new Map<number, AdminSourceFile[]>();
  for (const file of files) {
    const existing = map.get(file.itemIndex) ?? [];
    existing.push(file);
    map.set(file.itemIndex, existing);
  }
  return map;
}

/**
 * Splits DeliverableRow[] into per-image buckets and an order-level bucket.
 * `byImage` maps item_index (0-based) → deliverables for that image.
 * `orderLevel` contains rows where item_index is null.
 */
export function groupDeliverablesByItem(rows: DeliverableRow[]): {
  byImage: Map<number, DeliverableRow[]>;
  orderLevel: DeliverableRow[];
} {
  const byImage = new Map<number, DeliverableRow[]>();
  const orderLevel: DeliverableRow[] = [];
  for (const row of rows) {
    if (row.item_index === null) {
      orderLevel.push(row);
    } else {
      const existing = byImage.get(row.item_index) ?? [];
      existing.push(row);
      byImage.set(row.item_index, existing);
    }
  }
  return { byImage, orderLevel };
}

/**
 * Splits AdminReview[] into per-image buckets and an order-level bucket.
 * `byImage` maps item_index (0-based) → reviews for that image.
 * `orderLevel` contains rows where item_index is null.
 */
export function groupReviewsByItem(reviews: AdminReview[]): {
  byImage: Map<number, AdminReview[]>;
  orderLevel: AdminReview[];
} {
  const byImage = new Map<number, AdminReview[]>();
  const orderLevel: AdminReview[] = [];
  for (const review of reviews) {
    if (review.item_index === null) {
      orderLevel.push(review);
    } else {
      const existing = byImage.get(review.item_index) ?? [];
      existing.push(review);
      byImage.set(review.item_index, existing);
    }
  }
  return { byImage, orderLevel };
}
