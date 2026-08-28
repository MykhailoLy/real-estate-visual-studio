"use client";

import { Trash2 } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import {
  RegionalCentsText,
  useDisplayCurrency,
} from "@/components/pricing/currency-client";
import { calculateRenovationItemTotal } from "@/lib/pricing";
import { getCatalogPrice } from "@/lib/pricing/catalog";
import {
  RENOVATION_INTERNAL_OPTIONS,
  RENOVATION_EXTERNAL_OPTIONS,
  RENOVATION_ROOM_OPTIONS,
  RENOVATION_STYLE_OPTIONS,
  STAGING_FILE_ACCEPT,
} from "@/data/order-options";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import { createDraftClientItemId } from "@/lib/order-drafts/utils";

export interface RenovationItemData {
  clientItemId: string;
  file: File | null;
  selectedInternal: string[];
  selectedExternal: string[];
  room: string;
  presentationStyle: string;
  /** Per-item file size limit (one of FILE_SIZE_LIMIT_OPTIONS or "") */
  fileSizeLimit: string;
  /** Per-item optional disclaimer text */
  disclaimerText: string;
  referenceLink: string;
  referenceFile: File | null;
  additionalInfo: string;
  originalFilename: string | null;
  referenceFilename: string | null;
}

export const emptyRenovationItem = (): RenovationItemData => ({
  clientItemId: createDraftClientItemId(),
  file: null,
  selectedInternal: [],
  selectedExternal: [],
  room: "",
  presentationStyle: "",
  ...emptyItemDeliveryFields,
  referenceLink: "",
  referenceFile: null,
  additionalInfo: "",
  originalFilename: null,
  referenceFilename: null,
});

interface RenovationItemCardProps {
  index: number;
  data: RenovationItemData;
  onChange: (data: RenovationItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
  persistedOriginal?: OrderDraftUploadedFileSummary | null;
  persistedReference?: OrderDraftUploadedFileSummary | null;
  onOriginalFileChange: (file: File | null) => void;
  onReferenceFileChange: (file: File | null) => void;
  onRemovePersistedOriginal: () => void;
  onRemovePersistedReference: () => void;
  originalOperationStatus?: string;
  originalOperationError?: string;
  referenceOperationStatus?: string;
  referenceOperationError?: string;
  onRetryOriginal?: () => void;
  onRetryReference?: () => void;
  fileOperationDisabled?: boolean;
}

export default function RenovationItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
  persistedOriginal,
  persistedReference,
  onOriginalFileChange,
  onReferenceFileChange,
  onRemovePersistedOriginal,
  onRemovePersistedReference,
  originalOperationStatus,
  originalOperationError,
  referenceOperationStatus,
  referenceOperationError,
  onRetryOriginal,
  onRetryReference,
  fileOperationDisabled = false,
}: RenovationItemCardProps) {
  const currency = useDisplayCurrency();
  const itemIdPrefix = `renovation-item-${data.clientItemId}`;
  const toggleInternal = (id: string) => {
    const updated = data.selectedInternal.includes(id)
      ? data.selectedInternal.filter((x) => x !== id)
      : [...data.selectedInternal, id];
    onChange({ ...data, selectedInternal: updated });
  };

  const toggleExternal = (id: string) => {
    const updated = data.selectedExternal.includes(id)
      ? data.selectedExternal.filter((x) => x !== id)
      : [...data.selectedExternal, id];
    onChange({ ...data, selectedExternal: updated });
  };

  const subtotal = calculateRenovationItemTotal(
    data.selectedInternal,
    data.selectedExternal,
    currency
  );

  return (
    <article className="@container rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold leading-tight text-primary">
          Image #{index + 1}
        </h2>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-2.5 text-muted transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={`Remove image ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-7">
        {/* File Upload */}
        <FileUpload
          viewerVariant="photo"
          label="Upload Original Photo"
          file={data.file}
          onFileChange={onOriginalFileChange}
          accept={STAGING_FILE_ACCEPT}
          required
          persistedFile={
            persistedOriginal
              ? {
                  id: persistedOriginal.id,
                  filename: persistedOriginal.originalFilename,
                  fileSize: persistedOriginal.fileSize,
                  previewUrl: persistedOriginal.previewUrl ?? null,
                  previewExpiresAt: persistedOriginal.previewExpiresAt ?? null,
                }
              : null
          }
          operationStatusText={originalOperationStatus}
          operationErrorText={originalOperationError}
          onRetry={onRetryOriginal}
          onRemovePersisted={onRemovePersistedOriginal}
          disabled={fileOperationDisabled}
          retryDisabled={fileOperationDisabled}
          removeDisabled={fileOperationDisabled}
          comfortable
        />

        <section
          aria-labelledby={`${itemIdPrefix}-selection-title`}
          className="border-t border-border pt-7"
        >
          <h3
            id={`${itemIdPrefix}-selection-title`}
            className="text-base font-semibold uppercase tracking-[0.08em] text-primary"
          >
            Renovation Selection
          </h3>

          <div className="mt-5 grid gap-x-8 gap-y-7 @min-[58rem]:grid-cols-2">
            {/* Internal Renovations */}
            <div className="min-w-0">
              <h4 className="text-base font-semibold text-foreground">
                Internal Renovations
              </h4>
              <div className="mt-3 divide-y divide-border border-y border-border">
                {RENOVATION_INTERNAL_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex min-h-11 cursor-pointer items-start justify-between gap-4 px-1 py-2.5 transition-colors hover:bg-surface/70"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={data.selectedInternal.includes(opt.id)}
                        onChange={() => toggleInternal(opt.id)}
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="min-w-0 text-[15px] leading-5 text-foreground">
                        {opt.label}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-sm font-medium leading-5 text-muted">
                      <RegionalCentsText
                        cents={getCatalogPrice(opt.priceKey, currency)}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* External Renovations */}
            <div className="min-w-0">
              <h4 className="text-base font-semibold text-foreground">
                External Renovations
              </h4>
              <div className="mt-3 divide-y divide-border border-y border-border">
                {RENOVATION_EXTERNAL_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex min-h-11 cursor-pointer items-start justify-between gap-4 px-1 py-2.5 transition-colors hover:bg-surface/70"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={data.selectedExternal.includes(opt.id)}
                        onChange={() => toggleExternal(opt.id)}
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="min-w-0 text-[15px] leading-5 text-foreground">
                        {opt.label}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-sm font-medium leading-5 text-muted">
                      <RegionalCentsText
                        cents={getCatalogPrice(opt.priceKey, currency)}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby={`${itemIdPrefix}-details-title`}
          className="border-t border-border pt-7"
        >
          <h3
            id={`${itemIdPrefix}-details-title`}
            className="text-base font-semibold uppercase tracking-[0.08em] text-primary"
          >
            Renovation Details
          </h3>

          {/* Room / Area & Presentation Style */}
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${itemIdPrefix}-room`}
                className="mb-2 block text-base font-medium text-foreground"
              >
                Room / Area <span className="text-red-500">*</span>
              </label>
              <select
                id={`${itemIdPrefix}-room`}
                value={data.room}
                onChange={(e) => onChange({ ...data, room: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select room...</option>
                {RENOVATION_ROOM_OPTIONS.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={`${itemIdPrefix}-presentation-style`}
                className="mb-2 block text-base font-medium text-foreground"
              >
                Presentation Style
              </label>
              <select
                id={`${itemIdPrefix}-presentation-style`}
                value={data.presentationStyle}
                onChange={(e) =>
                  onChange({ ...data, presentationStyle: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select style...</option>
                {RENOVATION_STYLE_OPTIONS.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Per-item delivery preferences (File Size Limit + Disclaimer Text) */}
          <div className="mt-6 border-t border-border pt-5">
            <h4 className="mb-4 text-[15px] font-semibold text-foreground">
              Delivery Preferences
            </h4>
            <ItemDeliveryFields
              idPrefix={itemIdPrefix}
              data={{
                fileSizeLimit: data.fileSizeLimit,
                disclaimerText: data.disclaimerText,
              }}
              onChange={(prefs) => onChange({ ...data, ...prefs })}
              layoutVariant="desktop-columns"
              comfortable
            />
          </div>
        </section>

        <section
          aria-labelledby={`${itemIdPrefix}-references-title`}
          className="border-t border-border pt-7"
        >
          <h3
            id={`${itemIdPrefix}-references-title`}
            className="text-base font-semibold uppercase tracking-[0.08em] text-primary"
          >
            References
          </h3>

          <div className="mt-5 space-y-6">
            {/* Reference Link */}
            <div>
              <label
                htmlFor={`${itemIdPrefix}-reference-link`}
                className="mb-2 block text-base font-medium text-foreground"
              >
                Reference Link
              </label>
              <input
                id={`${itemIdPrefix}-reference-link`}
                type="url"
                value={data.referenceLink}
                onChange={(e) =>
                  onChange({ ...data, referenceLink: e.target.value })
                }
                placeholder="https://example.com/inspiration"
                className="w-full rounded-lg border border-border px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Reference Image */}
            <FileUpload
              viewerVariant="photo"
              label="Reference Image (optional)"
              file={data.referenceFile}
              onFileChange={onReferenceFileChange}
              accept={STAGING_FILE_ACCEPT}
              persistedFile={
                persistedReference
                  ? {
                      id: persistedReference.id,
                      filename: persistedReference.originalFilename,
                      fileSize: persistedReference.fileSize,
                      previewUrl: persistedReference.previewUrl ?? null,
                      previewExpiresAt:
                        persistedReference.previewExpiresAt ?? null,
                    }
                  : null
              }
              operationStatusText={referenceOperationStatus}
              operationErrorText={referenceOperationError}
              onRetry={onRetryReference}
              onRemovePersisted={onRemovePersistedReference}
              disabled={fileOperationDisabled}
              retryDisabled={fileOperationDisabled}
              removeDisabled={fileOperationDisabled}
              comfortable
            />
          </div>
        </section>

        {/* Additional Info */}
        <div className="border-t border-border pt-7">
          <label
            htmlFor={`${itemIdPrefix}-additional-information`}
            className="mb-2 block text-base font-medium text-foreground"
          >
            Additional Information
          </label>
          <textarea
            id={`${itemIdPrefix}-additional-information`}
            value={data.additionalInfo}
            onChange={(e) =>
              onChange({ ...data, additionalInfo: e.target.value })
            }
            placeholder="Describe any specific renovation details..."
            rows={4}
            className="w-full resize-y rounded-lg border border-border px-3 py-2.5 text-base leading-6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Subtotal */}
        <ItemSubtotal totalCents={subtotal} />
      </div>
    </article>
  );
}
