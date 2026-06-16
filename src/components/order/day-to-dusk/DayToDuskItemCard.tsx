"use client";

import { Trash2, Copy } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
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
// The service is fixed (day-to-dusk-pe, 500 cents). The dusk style
// and all lighting preferences below are INCLUDED in the base price
// and never change the subtotal. Each item carries its own dusk
// style + lighting preferences + delivery preferences + notes.
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

interface DayToDuskItemCardProps {
  index: number;
  data: DayToDuskItemData;
  onChange: (data: DayToDuskItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
  duskStyleImages: Record<string, ServiceOptionImage>;
  /** Copy this item's preferences to all remaining items. */
  onApplyToAll: () => void;
  showApplyToAll: boolean;
}

export default function DayToDuskItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
  duskStyleImages,
  onApplyToAll,
  showApplyToAll,
}: DayToDuskItemCardProps) {
  const subtotal = calculatePhotoEditItemTotal([DAY_TO_DUSK_OPTION_ID]);
  const idPrefix = `day-to-dusk-item-${index}`;

  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
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
        {/* 1. Upload Daytime Exterior Photo */}
        <FileUpload
          label="Upload Daytime Exterior Photo"
          file={data.file}
          onFileChange={(file) => onChange({ ...data, file })}
          accept={PHOTO_EDIT_FILE_ACCEPT}
          required
        />

        {/* 2. Select a Dusk Sky Style */}
        <DuskSkyStyleSelector
          value={data.duskStyle}
          onChange={(duskStyle) => onChange({ ...data, duskStyle })}
          images={duskStyleImages}
          idPrefix={idPrefix}
        />

        {/* 3. Lighting Preferences */}
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
            />
          ))}
        </div>

        {/* 4. File Size Limit (+ optional disclaimer) */}
        <ItemDeliveryFields
          idPrefix={idPrefix}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
        />

        {/* 5. Additional Instructions */}
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

        {/* Apply preferences to all remaining photos */}
        {showApplyToAll && (
          <button
            type="button"
            onClick={onApplyToAll}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary-light transition-colors"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden />
            Apply these preferences to all remaining photos
          </button>
        )}

        {/* 6. Item subtotal */}
        <ItemSubtotal totalCents={subtotal} />
      </div>
    </div>
  );
}
