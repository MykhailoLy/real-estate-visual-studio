"use client";

import { Trash2 } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import { PHOTO_EDIT_FILE_ACCEPT } from "@/data/order-options";
import type { DedicatedPhotoEditingConfig } from "@/lib/dedicated-photo-editing";

// ============================================================
// DedicatedPhotoEditItemCard — one photo for a dedicated photo-
// editing service (Image Enhancement / Day to Dusk / Item Removal).
//
// There is NO editing-options checklist: the service is fixed by the
// form's config (config.optionId). The subtotal is derived from that
// single existing PHOTO_EDIT_OPTIONS option, so pricing is unchanged.
// ============================================================

export interface DedicatedPhotoEditItemData {
  file: File | null;
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
}

export const emptyDedicatedPhotoEditItem = (): DedicatedPhotoEditItemData => ({
  file: null,
  ...emptyItemDeliveryFields,
  additionalInfo: "",
});

interface DedicatedPhotoEditItemCardProps {
  index: number;
  config: DedicatedPhotoEditingConfig;
  data: DedicatedPhotoEditItemData;
  onChange: (data: DedicatedPhotoEditItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function DedicatedPhotoEditItemCard({
  index,
  config,
  data,
  onChange,
  onRemove,
  canRemove,
}: DedicatedPhotoEditItemCardProps) {
  // Fixed single option → fixed subtotal. No client-editable options.
  const subtotal = calculatePhotoEditItemTotal([config.optionId]);
  const notesRequired = config.notesRequired;

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

      <div className="space-y-4">
        <FileUpload
          label={config.uploadLabel}
          file={data.file}
          onFileChange={(file) => onChange({ ...data, file })}
          accept={PHOTO_EDIT_FILE_ACCEPT}
          required
        />

        <ItemDeliveryFields
          idPrefix={`dedicated-photo-edit-item-${index}`}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
        />

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {config.notesLabel}
            {notesRequired && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <textarea
            value={data.additionalInfo}
            onChange={(e) =>
              onChange({ ...data, additionalInfo: e.target.value })
            }
            placeholder={config.notesPlaceholder}
            rows={notesRequired ? 3 : 2}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <ItemSubtotal totalCents={subtotal} />
      </div>
    </div>
  );
}
