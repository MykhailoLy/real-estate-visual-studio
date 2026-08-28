"use client";

import { useMemo, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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

  const localPreviewUrl = useMemo(() => {
    if (data.file && data.file.type.startsWith("image/")) {
      return URL.createObjectURL(data.file);
    }
    return null;
  }, [data.file]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const currentPreviewUrl = localPreviewUrl ?? persistedOriginal?.previewUrl ?? null;
  const currentPreviewFilename = data.file?.name ?? persistedOriginal?.originalFilename ?? null;
  const hasCurrentPhotoPreview = currentPreviewUrl !== null && currentPreviewFilename !== null;

  return (
    <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-[20px] font-bold text-foreground">
          Image #{index + 1}
        </h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            aria-label={`Remove image ${index + 1}`}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-7",
          hasCurrentPhotoPreview &&
            "min-[1600px]:grid-cols-[minmax(0,1fr)_300px] min-[1600px]:gap-x-10 min-[1600px]:gap-y-0",
        )}
      >
        {hasCurrentPhotoPreview ? (
          <div className="min-w-0 min-[1600px]:col-start-2 min-[1600px]:row-span-2 min-[1600px]:row-start-1">
            <div className="min-[1600px]:sticky min-[1600px]:top-8">
              <CurrentPhotoPreview
                key={currentPreviewUrl}
                previewUrl={currentPreviewUrl}
                filename={currentPreviewFilename}
              />
            </div>
          </div>
        ) : null}

        <div className={cn("min-w-0 space-y-7 min-[1600px]:col-start-1 min-[1600px]:row-start-1", hasCurrentPhotoPreview && "min-[1600px]:row-span-2")}>
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
            presentationVariant="workspace"
            comfortable
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Internal Renovations */}
            <div>
              <label className="block text-[17px] font-semibold text-primary mb-3">
                Internal Renovations
              </label>
              <div className="space-y-1.5 border border-border rounded-xl p-4">
                {RENOVATION_INTERNAL_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={data.selectedInternal.includes(opt.id)}
                        onChange={() => toggleInternal(opt.id)}
                        className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                      />
                      <span className="text-[15px] text-foreground font-medium">{opt.label}</span>
                    </div>
                    <span className="text-sm font-medium text-muted flex-shrink-0 ml-2">
                      <RegionalCentsText
                        cents={getCatalogPrice(opt.priceKey, currency)}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* External Renovations */}
            <div>
              <label className="block text-[17px] font-semibold text-primary mb-3">
                External Renovations
              </label>
              <div className="space-y-1.5 border border-border rounded-xl p-4">
                {RENOVATION_EXTERNAL_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={data.selectedExternal.includes(opt.id)}
                        onChange={() => toggleExternal(opt.id)}
                        className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                      />
                      <span className="text-[15px] text-foreground font-medium">{opt.label}</span>
                    </div>
                    <span className="text-sm font-medium text-muted flex-shrink-0 ml-2">
                      <RegionalCentsText
                        cents={getCatalogPrice(opt.priceKey, currency)}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Room / Area & Presentation Style */}
          <div className="pt-7 border-t border-border">
            <h5 className="text-[17px] font-semibold text-primary mb-5">
              Renovation Details
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[15px] font-medium text-foreground mb-2">
                  Room / Area <span className="text-red-500">*</span>
                </label>
                <select
                  value={data.room}
                  onChange={(e) => onChange({ ...data, room: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                <label className="block text-[15px] font-medium text-foreground mb-2">
                  Presentation Style
                </label>
                <select
                  value={data.presentationStyle}
                  onChange={(e) =>
                    onChange({ ...data, presentationStyle: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
          </div>

          {/* Per-item delivery preferences (File Size Limit + Disclaimer Text) */}
          <div className="pt-2">
            <ItemDeliveryFields
              idPrefix={`renovation-item-${index}`}
              data={{
                fileSizeLimit: data.fileSizeLimit,
                disclaimerText: data.disclaimerText,
              }}
              onChange={(prefs) => onChange({ ...data, ...prefs })}
            />
          </div>

          <div className="pt-7 border-t border-border">
            <h5 className="text-[17px] font-semibold text-primary mb-5">
              References
            </h5>
            
            <div className="space-y-6">
              {/* Reference Link */}
              <div>
                <label className="block text-[15px] font-medium text-foreground mb-2">
                  Reference Link
                </label>
                <input
                  type="url"
                  value={data.referenceLink}
                  onChange={(e) =>
                    onChange({ ...data, referenceLink: e.target.value })
                  }
                  placeholder="https://example.com/inspiration"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                        previewExpiresAt: persistedReference.previewExpiresAt ?? null,
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
                presentationVariant="workspace"
                comfortable
              />
            </div>
          </div>

          {/* Additional Info */}
          <div className="pt-7 border-t border-border">
            <label className="block text-[15px] font-medium text-foreground mb-2">
              Additional Information
            </label>
            <textarea
              value={data.additionalInfo}
              onChange={(e) =>
                onChange({ ...data, additionalInfo: e.target.value })
              }
              placeholder="Describe any specific renovation details..."
              rows={3}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

        {/* Subtotal */}
        <ItemSubtotal totalCents={subtotal} />
        </div>
      </div>
    </div>
  );
}

function CurrentPhotoPreview({
  previewUrl,
  filename,
}: {
  previewUrl: string;
  filename: string;
}) {
  return (
    <figure className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface/70 xl:max-w-none">
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={`Current original preview: ${filename}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain object-center"
        />
      </div>
      <figcaption className="flex min-w-0 flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Current original
          </p>
          <p className="mt-1 truncate text-sm text-muted" title={filename}>
            {filename}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}
