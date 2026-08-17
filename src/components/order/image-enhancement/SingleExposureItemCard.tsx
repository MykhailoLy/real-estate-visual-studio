"use client";

import { Trash2, Copy } from "lucide-react";
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
  SINGLE_EXPOSURE_OPTION_ID,
  SINGLE_EXPOSURE_PREFERENCES,
  THREE_STATE_DEFAULT,
  DAY_SKY_STYLE_DEFAULT,
  type ThreeStateValue,
  type DaySkyStyleId,
} from "@/lib/image-enhancement";
import ThreeStatePreference from "./ThreeStatePreference";
import DaySkyStyleSelector from "./DaySkyStyleSelector";

// ============================================================
// SingleExposureItemCard — one uploaded photo for an Image
// Enhancement — Single Exposure order.
//
// The service is fixed (image-enhancement-re, canonical currency price). All
// preferences below are INCLUDED in the base price and never change
// the subtotal. Each item carries its own preferences + day sky style.
// ============================================================

export interface SingleExposureItemData {
  file: File | null;
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  grassRepair: ThreeStateValue;
  skyReplacement: ThreeStateValue;
  tvScreenReplacement: ThreeStateValue;
  addFireToFireplace: ThreeStateValue;
  daySkyStyle: DaySkyStyleId;
}

export const emptySingleExposureItem = (): SingleExposureItemData => ({
  file: null,
  ...emptyItemDeliveryFields,
  additionalInfo: "",
  grassRepair: THREE_STATE_DEFAULT,
  skyReplacement: THREE_STATE_DEFAULT,
  tvScreenReplacement: THREE_STATE_DEFAULT,
  addFireToFireplace: THREE_STATE_DEFAULT,
  daySkyStyle: DAY_SKY_STYLE_DEFAULT,
});

interface SingleExposureItemCardProps {
  index: number;
  data: SingleExposureItemData;
  onChange: (data: SingleExposureItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
  daySkyImages: Record<string, ServiceOptionImage>;
  /** Copy this item's preferences to all remaining items. */
  onApplyToAll: () => void;
  showApplyToAll: boolean;
}

// camelCase preference field → value getter, keeps the four controls DRY.
const PREF_FIELDS = SINGLE_EXPOSURE_PREFERENCES;

export default function SingleExposureItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
  daySkyImages,
  onApplyToAll,
  showApplyToAll,
}: SingleExposureItemCardProps) {
  const currency = useDisplayCurrency();
  const subtotal = calculatePhotoEditItemTotal(
    [SINGLE_EXPOSURE_OPTION_ID],
    currency
  );
  const idPrefix = `single-exposure-item-${index}`;

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
        {/* 1. Upload Original Photo */}
        <FileUpload
          viewerVariant="photo"
          label="Upload Original Photo"
          file={data.file}
          onFileChange={(file) => onChange({ ...data, file })}
          accept={PHOTO_EDIT_FILE_ACCEPT}
          required
        />

        {/* 2. Image Preferences (four three-state controls) */}
        <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light">
            Image Preferences
          </p>
          {PREF_FIELDS.map((pref) => (
            <ThreeStatePreference
              key={pref.field}
              label={pref.label}
              value={data[pref.field] as ThreeStateValue}
              onChange={(value) => onChange({ ...data, [pref.field]: value })}
              idPrefix={`${idPrefix}-${pref.field}`}
            />
          ))}
        </div>

        {/* 3. Select a Day Sky Style */}
        <DaySkyStyleSelector
          value={data.daySkyStyle}
          onChange={(daySkyStyle) => onChange({ ...data, daySkyStyle })}
          images={daySkyImages}
          idPrefix={idPrefix}
        />

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
            placeholder="Optional: any specific enhancement notes for this photo (e.g. brighten interior, recover window view)..."
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
