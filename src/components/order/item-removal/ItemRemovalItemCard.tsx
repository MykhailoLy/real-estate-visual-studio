"use client";

import { Trash2 } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import { PHOTO_EDIT_FILE_ACCEPT } from "@/data/order-options";
import {
  ITEM_REMOVAL_OPTION_ID,
  ITEM_REMOVAL_MIN_INSTRUCTIONS,
  type RemovalTaskId,
} from "@/lib/item-removal";
import RemovalTaskSelector from "./RemovalTaskSelector";

// ============================================================
// ItemRemovalItemCard — one uploaded photo for an Item Removal &
// Virtual Cleaning order.
//
// The service is fixed (item-removal-cleaning-pe, currency-priced per original
// photo). Each item carries its own work-type tasks, required removal /
// cleaning instructions, an OPTIONAL markup / reference image, and the
// usual delivery preferences. Work-type and markup never change price.
// ============================================================

export interface ItemRemovalItemData {
  /** Required original photo — one original = one billable $8 item. */
  file: File | null;
  /** Optional markup / reference image (annotated copy, etc.). */
  referenceFile: File | null;
  /** Selected work types (at least one required). */
  removalTasks: RemovalTaskId[];
  /** Required removal / cleaning instructions. */
  additionalInfo: string;
  fileSizeLimit: string;
  disclaimerText: string;
}

export const emptyItemRemovalItem = (): ItemRemovalItemData => ({
  file: null,
  referenceFile: null,
  removalTasks: [],
  additionalInfo: "",
  ...emptyItemDeliveryFields,
});

/** Stable DOM id for a photo card, used to scroll it into view on Edit. */
export const itemRemovalItemDomId = (index: number) =>
  `item-removal-item-${index}`;

/** Whether a single item passes all client-side requirements. */
export function isItemRemovalItemValid(item: ItemRemovalItemData): boolean {
  return (
    item.file !== null &&
    item.removalTasks.length >= 1 &&
    item.additionalInfo.trim().length >= ITEM_REMOVAL_MIN_INSTRUCTIONS
  );
}

interface ItemRemovalItemCardProps {
  index: number;
  data: ItemRemovalItemData;
  onChange: (data: ItemRemovalItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
  /** Show inline validation errors (after an attempted Review). */
  showErrors: boolean;
}

export default function ItemRemovalItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
  showErrors,
}: ItemRemovalItemCardProps) {
  const currency = useDisplayCurrency();
  const subtotal = calculatePhotoEditItemTotal(
    [ITEM_REMOVAL_OPTION_ID],
    currency
  );
  const idPrefix = itemRemovalItemDomId(index);
  const notesId = `${idPrefix}-instructions`;
  const notesErrorId = `${idPrefix}-instructions-error`;

  const tasksError = showErrors && data.removalTasks.length < 1;
  const instructionsError =
    showErrors &&
    data.additionalInfo.trim().length < ITEM_REMOVAL_MIN_INSTRUCTIONS;

  return (
    <div
      id={idPrefix}
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
        {/* 1. Required original photo */}
        <FileUpload
          viewerVariant="photo"
          label="Upload Original Photo"
          file={data.file}
          onFileChange={(file) => onChange({ ...data, file })}
          accept={PHOTO_EDIT_FILE_ACCEPT}
          required
        />

        {/* 2. Work-type tasks (at least one required) */}
        <RemovalTaskSelector
          value={data.removalTasks}
          onChange={(removalTasks) => onChange({ ...data, removalTasks })}
          idPrefix={idPrefix}
          error={tasksError}
        />

        {/* 3. Required instructions */}
        <div>
          <label
            htmlFor={notesId}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            What should be removed or cleaned?
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            id={notesId}
            value={data.additionalInfo}
            onChange={(e) =>
              onChange({ ...data, additionalInfo: e.target.value })
            }
            placeholder="Describe exactly what to remove or clean. Example: remove the bins beside the garage, clear all items from the kitchen counter, and clean the marks on the wall."
            rows={3}
            aria-required="true"
            aria-invalid={instructionsError || undefined}
            aria-describedby={instructionsError ? notesErrorId : undefined}
            className={`w-full px-3 py-2.5 border rounded-lg text-dashboard-mobile-control md:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
              instructionsError ? "border-red-400" : "border-border"
            }`}
          />
          {instructionsError && (
            <p id={notesErrorId} role="alert" className="mt-1.5 text-dashboard-metadata text-red-500">
              Please describe what should be removed or cleaned (at least{" "}
              {ITEM_REMOVAL_MIN_INSTRUCTIONS} characters).
            </p>
          )}
        </div>

        {/* 4. Optional markup / reference image (reuses referenceFile pipeline) */}
        <FileUpload
          viewerVariant="photo"
          label="Upload Markup or Reference Image — Optional"
          file={data.referenceFile}
          onFileChange={(referenceFile) => onChange({ ...data, referenceFile })}
          accept={PHOTO_EDIT_FILE_ACCEPT}
          helperText="You can upload a copy of the photo with circles, arrows or notes showing exactly what should be removed or cleaned."
        />

        {/* 5. File Size Limit (+ optional disclaimer) */}
        <ItemDeliveryFields
          idPrefix={idPrefix}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
        />

        {/* 6. Item subtotal */}
        <ItemSubtotal totalCents={subtotal} />
      </div>
    </div>
  );
}
