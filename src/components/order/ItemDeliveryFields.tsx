"use client";

import { FILE_SIZE_LIMIT_OPTIONS } from "@/data/order-options";

/**
 * Per-item delivery preferences shape.
 *
 * Both fields are optional. They are not paid add-ons — they exist so the
 * client can communicate constraints (MLS upload caps, required disclaimer
 * text, etc.) PER item and have them stored alongside the item's other
 * details. Each image / item carries its own values.
 */
export interface ItemDeliveryFieldsData {
  /** One of FILE_SIZE_LIMIT_OPTIONS, or "" for "Please Select...". */
  fileSizeLimit: string;
  /** Optional disclaimer text the client wants delivered with this item. */
  disclaimerText: string;
}

export const emptyItemDeliveryFields: ItemDeliveryFieldsData = {
  fileSizeLimit: "",
  disclaimerText: "",
};

interface ItemDeliveryFieldsProps {
  data: ItemDeliveryFieldsData;
  onChange: (data: ItemDeliveryFieldsData) => void;
  /** Optional id prefix used to keep label/select associations unique per item. */
  idPrefix?: string;
  /**
   * When true, the File Size Limit select is read-only (used when a photo
   * inherits a shared file-size preference). The disclaimer text remains
   * editable because it is never shared between photos. Defaults to false
   * so existing callers are unaffected.
   */
  disableFileSizeLimit?: boolean;
  /** When true, both item delivery fields are read-only. */
  disabled?: boolean;
}

/**
 * Per-item File Size Limit dropdown + Your Disclaimer Text textarea.
 *
 * Used inside each item card (StagingItemCard, RenovationItemCard,
 * FloorPlanItemCard, PhotoEditItemCard). Selections live entirely on the
 * parent's per-item state — Add Another Image / Item creates a fresh item
 * with empty values, and removing an item drops its preferences with it.
 */
export default function ItemDeliveryFields({
  data,
  onChange,
  idPrefix,
  disableFileSizeLimit = false,
  disabled = false,
}: ItemDeliveryFieldsProps) {
  const sizeId = idPrefix ? `${idPrefix}-file-size-limit` : undefined;
  const discId = idPrefix ? `${idPrefix}-disclaimer-text` : undefined;

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={sizeId}
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          File Size Limit (MLS and other online websites)
        </label>
        <p className="text-xs text-muted mb-2">
          Many listing portals cap individual file uploads. Pick a target if
          your portal has a strict limit.
        </p>
        <select
          id={sizeId}
          value={data.fileSizeLimit}
          disabled={disabled || disableFileSizeLimit}
          onChange={(e) =>
            onChange({ ...data, fileSizeLimit: e.target.value })
          }
          className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="">Please Select...</option>
          {FILE_SIZE_LIMIT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={discId}
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          Your Disclaimer Text
        </label>
        <p className="text-xs text-muted mb-2">
          Optional text to include with delivered files or listing materials
          if required.
        </p>
        <textarea
          id={discId}
          value={data.disclaimerText}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...data, disclaimerText: e.target.value })
          }
          placeholder="Enter any required disclaimer text..."
          rows={3}
          maxLength={2000}
          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </div>
  );
}
