"use client";

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

  return (
    <div
      id={dayToDuskItemDomId(index)}
      className="scroll-mt-4 rounded-xl border border-border bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="mb-7 flex items-center justify-between">
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

      <div className="space-y-9">
        {/* 1. Upload Daytime Exterior Photo (always editable) */}
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
          comfortable
        />

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
          className="space-y-5 rounded-xl border border-border bg-surface/40 p-5 sm:p-6"
          aria-labelledby={`${idPrefix}-lighting-title`}
        >
          <h3
            id={`${idPrefix}-lighting-title`}
            className="text-lg font-semibold text-primary sm:text-xl"
          >
            Lighting Preferences
          </h3>
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
  );
}
