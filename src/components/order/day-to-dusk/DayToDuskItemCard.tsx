"use client";

import { useEffect, useMemo } from "react";
import { Trash2, Lock } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import { PHOTO_EDIT_FILE_ACCEPT } from "@/data/order-options";
import type { ServiceOptionImage } from "@/lib/site-media";
import {
  DAY_TO_DUSK_OPTION_ID,
  DUSK_STYLE_DEFAULT,
  DUSK_LIGHTING_PREFERENCES,
  type DuskStyleId,
} from "@/lib/day-to-dusk";
import DuskSkyStyleSelector from "./DuskSkyStyleSelector";
import LightingPreferenceToggle from "./LightingPreferenceToggle";
import ReferenceFilesUploader from "@/components/order/ReferenceFilesUploader";
import type { ReferenceFileValue } from "@/lib/reference-files";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import { createDraftClientItemId } from "@/lib/order-drafts/utils";
import { cn } from "@/lib/utils";

// ============================================================
// DayToDuskItemCard — one uploaded photo for a Day to Dusk order.
//
// The service is fixed (day-to-dusk-pe, canonical currency price). The dusk style
// and all lighting preferences below are INCLUDED in the base price
// and never change the subtotal. Each item carries its own dusk
// style + lighting preferences + delivery preferences + notes.
//
// There is NO per-card "Apply to all" action — sharing is driven by a
// single global checkbox owned by the form. When sharing is enabled,
// photos #2+ receive Photo #1's shared preferences and render those
// shared controls read-only (`sharedLocked`), while their uploaded
// file, filename, Additional Instructions and subtotal stay editable.
// ============================================================

export interface DayToDuskItemData {
  clientItemId: string;
  file: File | null;
  originalFilename: string | null;
  referenceLink: string;
  referenceFiles: ReferenceFileValue[];
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  duskStyle: DuskStyleId;
  turnOnInteriorLights: boolean;
  turnOnExteriorLights: boolean;
  addPoolLights: boolean;
}

export const emptyDayToDuskItem = (): DayToDuskItemData => ({
  clientItemId: createDraftClientItemId(),
  file: null,
  originalFilename: null,
  referenceLink: "",
  referenceFiles: [],
  ...emptyItemDeliveryFields,
  additionalInfo: "",
  duskStyle: DUSK_STYLE_DEFAULT,
  turnOnInteriorLights: true,
  turnOnExteriorLights: true,
  addPoolLights: false,
});

/** Stable DOM id for a photo card, used to scroll it into view on Edit. */
export const dayToDuskItemDomId = (index: number) =>
  `day-to-dusk-item-${index}`;

const PREVIEWABLE_PHOTO_EXTENSION = /\.(?:gif|jpe?g|png|webp)$/i;

function isPreviewablePhoto(filename: string, mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") || PREVIEWABLE_PHOTO_EXTENSION.test(filename)
  );
}

interface DayToDuskItemCardProps {
  index: number;
  data: DayToDuskItemData;
  onChange: (data: DayToDuskItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
  duskStyleImages: Record<string, ServiceOptionImage>;
  /**
   * When true this photo inherits Photo #1's shared preferences: the
   * dusk style, lighting toggles and file-size select are read-only.
   * File upload, Additional Instructions and subtotal remain editable.
   */
  sharedLocked: boolean;
  persistedOriginal?: OrderDraftUploadedFileSummary | null;
  onOriginalFileChange?: (file: File | null) => void;
  onRemovePersistedOriginal?: () => void;
  onReferenceFilesChange?: (files: ReferenceFileValue[]) => void;
  originalOperationStatus?: string;
  referenceOperationStatus?: string;
  fileOperationsDisabled?: boolean;
}

export default function DayToDuskItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
  duskStyleImages,
  sharedLocked,
  persistedOriginal,
  onOriginalFileChange,
  onRemovePersistedOriginal,
  onReferenceFilesChange,
  originalOperationStatus,
  referenceOperationStatus,
  fileOperationsDisabled = false,
}: DayToDuskItemCardProps) {
  const currency = useDisplayCurrency();
  const subtotal = calculatePhotoEditItemTotal(
    [DAY_TO_DUSK_OPTION_ID],
    currency
  );
  const idPrefix = `day-to-dusk-item-${index}`;
  const uploadInputId = `${idPrefix}-original-upload`;
  const localPreviewUrl = useMemo(() => {
    if (!data.file || !isPreviewablePhoto(data.file.name, data.file.type)) {
      return null;
    }
    return URL.createObjectURL(data.file);
  }, [data.file]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const persistedPreviewUrl =
    !data.file &&
    persistedOriginal?.previewUrl &&
    isPreviewablePhoto(
      persistedOriginal.originalFilename,
      persistedOriginal.mimeType,
    )
      ? persistedOriginal.previewUrl
      : null;
  const currentPreviewUrl = localPreviewUrl ?? persistedPreviewUrl;
  const currentPreviewFilename =
    data.file?.name ?? persistedOriginal?.originalFilename ?? null;
  const hasCurrentPhotoPreview =
    currentPreviewUrl !== null && currentPreviewFilename !== null;

  return (
    <div
      id={dayToDuskItemDomId(index)}
      className="scroll-mt-4 rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-primary sm:text-[22px]">
          Photo #{index + 1}
        </h2>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-2.5 text-muted transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={`Remove photo ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div
        className={cn(
          "grid min-w-0 gap-7",
          hasCurrentPhotoPreview &&
            "min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] min-[1440px]:items-start min-[1440px]:gap-x-7",
        )}
      >
        {/* 1. Upload Daytime Exterior Photo (always editable) */}
        <div className="min-w-0">
          <FileUpload
            viewerVariant="photo"
            label="Upload Daytime Exterior Photo"
            file={data.file}
            onFileChange={
              onOriginalFileChange ?? ((file) => onChange({ ...data, file }))
            }
            accept={PHOTO_EDIT_FILE_ACCEPT}
            required
            persistedFile={
              persistedOriginal
                ? {
                    id: persistedOriginal.id,
                    filename: persistedOriginal.originalFilename,
                    fileSize: persistedOriginal.fileSize,
                    previewUrl: persistedOriginal.previewUrl,
                    previewExpiresAt: persistedOriginal.previewExpiresAt,
                    statusLabel: "Saved in draft",
                  }
                : null
            }
            operationStatusText={originalOperationStatus}
            disabled={fileOperationsDisabled}
            removeDisabled={fileOperationsDisabled}
            onRemovePersisted={onRemovePersistedOriginal}
            replaceLabel="Change photo"
            inputId={uploadInputId}
            presentationVariant="workspace"
            comfortable
          />
        </div>

        {currentPreviewUrl && currentPreviewFilename && (
          <div className="min-w-0 min-[1440px]:col-start-2 min-[1440px]:row-span-2 min-[1440px]:row-start-1">
            <div className="min-[1440px]:sticky min-[1440px]:top-8">
              <CurrentPhotoPreview
                key={currentPreviewUrl}
                previewUrl={currentPreviewUrl}
                filename={currentPreviewFilename}
                inputId={uploadInputId}
                disabled={fileOperationsDisabled}
              />
            </div>
          </div>
        )}

        <div className="min-w-0 space-y-7 min-[1440px]:col-start-1 min-[1440px]:row-start-2">

        <div>
          <label
            htmlFor={`${idPrefix}-reference-link`}
            className="mb-2 block text-base font-medium text-foreground"
          >
            Reference Link (optional)
          </label>
          <input
            id={`${idPrefix}-reference-link`}
            type="url"
            value={data.referenceLink}
            onChange={(event) =>
              onChange({ ...data, referenceLink: event.target.value })
            }
            placeholder="https://example.com/reference"
            className="w-full rounded-lg border border-border px-3 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-2 text-sm leading-6 text-muted">
            Add a link to an online example, brand guide or shared reference.
          </p>
        </div>

        <ReferenceFilesUploader
          files={data.referenceFiles}
          onChange={
            onReferenceFilesChange ??
            ((referenceFiles) => onChange({ ...data, referenceFiles }))
          }
          disabled={fileOperationsDisabled}
          operationStatus={referenceOperationStatus}
          comfortable
        />

        {/* Shared-preferences notice for photos #2+ while sharing is on. */}
        {sharedLocked && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-4 py-3 text-sm font-medium text-muted">
            <Lock className="h-4 w-4 flex-shrink-0" aria-hidden />
            Using Photo #1 preferences
          </div>
        )}

        {/* 2. Select a Dusk Sky Style (shared) */}
        <DuskSkyStyleSelector
          value={data.duskStyle}
          onChange={(duskStyle) => onChange({ ...data, duskStyle })}
          images={duskStyleImages}
          idPrefix={idPrefix}
          disabled={sharedLocked}
        />

        {/* 3. Lighting Preferences (shared) */}
        <section
          className="space-y-4 rounded-xl bg-surface/60 p-5"
          aria-labelledby={`${idPrefix}-lighting-title`}
        >
          <h3
            id={`${idPrefix}-lighting-title`}
            className="text-lg font-semibold text-primary sm:text-xl"
          >
            Lighting Preferences
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 min-[1180px]:grid-cols-3">
            {DUSK_LIGHTING_PREFERENCES.map((pref) => (
              <LightingPreferenceToggle
                key={pref.field}
                label={pref.label}
                value={data[pref.field] as boolean}
                onChange={(value) => onChange({ ...data, [pref.field]: value })}
                idPrefix={`${idPrefix}-${pref.field}`}
                disabled={sharedLocked}
              />
            ))}
          </div>
        </section>

        {/* 4. File Size Limit (shared) + disclaimer (always individual) */}
        <ItemDeliveryFields
          idPrefix={idPrefix}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
          disableFileSizeLimit={sharedLocked}
          layoutVariant="desktop-columns"
          comfortable
        />

        {/* 5. Additional Instructions (always individual) */}
        <div>
          <label
            htmlFor={`${idPrefix}-notes`}
            className="mb-2 block text-base font-medium text-foreground"
          >
            Additional Instructions
          </label>
          <textarea
            id={`${idPrefix}-notes`}
            value={data.additionalInfo}
            onChange={(e) =>
              onChange({ ...data, additionalInfo: e.target.value })
            }
            placeholder="Tell us about any specific lighting, window, exterior, pool, or atmosphere preferences for this photo."
            rows={3}
            className="w-full resize-none rounded-lg border border-border px-3 py-3 text-base leading-6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* 6. Item subtotal */}
        <ItemSubtotal totalCents={subtotal} />
        </div>
      </div>
    </div>
  );
}

function CurrentPhotoPreview({
  previewUrl,
  filename,
  inputId,
  disabled,
}: {
  previewUrl: string;
  filename: string;
  inputId: string;
  disabled: boolean;
}) {
  return (
    <figure className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface/70 min-[1440px]:max-w-none">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-white p-3">
        {/* Signed draft URLs and local blob URLs intentionally bypass next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={`Current photo preview: ${filename}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain object-center"
        />
      </div>
      <figcaption className="flex min-w-0 flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Current photo
          </p>
          <p className="mt-1 truncate text-sm text-muted" title={filename}>
            {filename}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            document.getElementById(inputId)?.click();
          }}
          disabled={disabled}
          className="shrink-0 self-start rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:self-center"
        >
          Change photo
        </button>
      </figcaption>
    </figure>
  );
}
