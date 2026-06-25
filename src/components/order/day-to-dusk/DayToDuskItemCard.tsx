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
  file: File | null;
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  duskStyle: DuskStyleId;
  turnOnInteriorLights: boolean;
  turnOnExteriorLights: boolean;
  addPoolLights: boolean;
}

export const emptyDayToDuskItem = (): DayToDuskItemData => ({
  file: null,
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
}

export default function DayToDuskItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
  duskStyleImages,
  sharedLocked,
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
      className="bg-white border border-border rounded-xl p-5 shadow-sm scroll-mt-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-foreground">
          Photo #{index + 1}
        </h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            aria-label={`Remove photo ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* 1. Upload Daytime Exterior Photo (always editable) */}
        <FileUpload
          label="Upload Daytime Exterior Photo"
          file={data.file}
          onFileChange={(file) => onChange({ ...data, file })}
          accept={PHOTO_EDIT_FILE_ACCEPT}
          required
        />

        {/* Shared-preferences notice for photos #2+ while sharing is on. */}
        {sharedLocked && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-[12px] font-medium text-muted">
            <Lock className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
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
        <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light">
            Lighting Preferences
          </p>
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

        {/* 4. File Size Limit (shared) + disclaimer (always individual) */}
        <ItemDeliveryFields
          idPrefix={idPrefix}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
          disableFileSizeLimit={sharedLocked}
        />

        {/* 5. Additional Instructions (always individual) */}
        <div>
          <label
            htmlFor={`${idPrefix}-notes`}
            className="block text-sm font-medium text-foreground mb-1.5"
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
            rows={2}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* 6. Item subtotal */}
        <ItemSubtotal totalCents={subtotal} />
      </div>
    </div>
  );
}
