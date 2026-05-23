"use client";

import { Trash2 } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import { formatUSD } from "@/lib/utils";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import { PHOTO_EDIT_OPTIONS, PHOTO_EDIT_FILE_ACCEPT } from "@/data/order-options";

export interface PhotoEditItemData {
  file: File | null;
  selectedOptions: string[];
  /** Per-item file size limit (one of FILE_SIZE_LIMIT_OPTIONS or "") */
  fileSizeLimit: string;
  /** Per-item optional disclaimer text */
  disclaimerText: string;
  additionalInfo: string;
}

export const emptyPhotoEditItem = (): PhotoEditItemData => ({
  file: null,
  selectedOptions: [],
  ...emptyItemDeliveryFields,
  additionalInfo: "",
});

interface PhotoEditItemCardProps {
  index: number;
  data: PhotoEditItemData;
  onChange: (data: PhotoEditItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
  onApplyToAll?: () => void;
  showApplyToAll: boolean;
}

export default function PhotoEditItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
  onApplyToAll,
  showApplyToAll,
}: PhotoEditItemCardProps) {
  const toggleOption = (id: string) => {
    const updated = data.selectedOptions.includes(id)
      ? data.selectedOptions.filter((x) => x !== id)
      : [...data.selectedOptions, id];
    onChange({ ...data, selectedOptions: updated });
  };

  const subtotal = calculatePhotoEditItemTotal(data.selectedOptions);

  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
      {/* Header */}
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

      <div className="space-y-4">
        {/* File Upload */}
        <FileUpload
          label="Upload Original Photo"
          file={data.file}
          onFileChange={(file) => onChange({ ...data, file })}
          accept={PHOTO_EDIT_FILE_ACCEPT}
          required
        />

        {/* Editing Options */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Editing Options <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted mb-3">
            Select all editing options needed for this photo.
          </p>
          <div className="space-y-1.5">
            {PHOTO_EDIT_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-surface cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={data.selectedOptions.includes(opt.id)}
                    onChange={() => toggleOption(opt.id)}
                    className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </div>
                <span className="text-sm font-medium text-muted flex-shrink-0 ml-2">
                  {formatUSD(opt.price)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Per-item delivery preferences (File Size Limit + Disclaimer Text) */}
        <ItemDeliveryFields
          idPrefix={`photo-edit-item-${index}`}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
        />

        {/* Additional Info */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Additional Information
          </label>
          <textarea
            value={data.additionalInfo}
            onChange={(e) =>
              onChange({ ...data, additionalInfo: e.target.value })
            }
            placeholder="Describe any specific editing instructions for this photo..."
            rows={2}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Apply to all */}
        {showApplyToAll && index === 0 && data.selectedOptions.length > 0 && onApplyToAll && (
          <button
            type="button"
            onClick={onApplyToAll}
            className="text-xs font-medium text-primary hover:text-primary-light underline transition-colors"
          >
            Apply above options to all remaining photos
          </button>
        )}

        {/* Subtotal */}
        <ItemSubtotal totalCents={subtotal} />
      </div>
    </div>
  );
}
