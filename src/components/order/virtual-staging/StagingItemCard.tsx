"use client";

import { Trash2 } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import StyleSelector from "@/components/order/virtual-staging/StyleSelector";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import {
  RegionalCentsText,
  useDisplayCurrency,
} from "@/components/pricing/currency-client";
import { calculateStagingItemTotal } from "@/lib/pricing";
import { getCatalogPrice } from "@/lib/pricing/catalog";
import {
  STAGING_ROOM_OPTIONS,
  STAGING_STYLE_OPTIONS,
  STAGING_ADDONS,
  STAGING_FILE_ACCEPT,
} from "@/data/order-options";
import { createDraftClientItemId } from "@/lib/order-drafts/utils";
import {
  updateOriginalFileDraftMetadata,
  updateReferenceFileDraftMetadata,
} from "@/lib/order-drafts/virtual-staging";

export interface StagingItemData {
  clientItemId: string;
  file: File | null;
  roomName: string;
  furnitureStyle: string;
  /** Per-item file size limit (one of FILE_SIZE_LIMIT_OPTIONS or "") */
  fileSizeLimit: string;
  /** Per-item optional disclaimer text */
  disclaimerText: string;
  referenceLink: string;
  referenceFile: File | null;
  additionalInfo: string;
  selectedAddons: string[];
  originalFilename: string | null;
  referenceFilename: string | null;
  needsOriginalFileReselection: boolean;
}

export const emptyStagingItem = (): StagingItemData => ({
  clientItemId: createDraftClientItemId(),
  file: null,
  roomName: "",
  furnitureStyle: "",
  ...emptyItemDeliveryFields,
  referenceLink: "",
  referenceFile: null,
  additionalInfo: "",
  selectedAddons: [],
  originalFilename: null,
  referenceFilename: null,
  needsOriginalFileReselection: false,
});

interface StagingItemCardProps {
  index: number;
  data: StagingItemData;
  onChange: (data: StagingItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
  draftCopy?: {
    savedOriginalFile: (filename: string) => string;
    savedReferenceFile: (filename: string) => string;
  };
}

const DEFAULT_DRAFT_COPY = {
  savedOriginalFile: (filename: string) =>
    `Saved draft file: ${filename}. Please select it again to submit.`,
  savedReferenceFile: (filename: string) =>
    `Saved draft reference: ${filename}. Select it again if it is still needed.`,
};

export default function StagingItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
  draftCopy = DEFAULT_DRAFT_COPY,
}: StagingItemCardProps) {
  const currency = useDisplayCurrency();
  const fieldIdPrefix = `staging-${data.clientItemId}`;
  const visualStyleLabelId = `${fieldIdPrefix}-visual-style`;
  const roomNameId = `${fieldIdPrefix}-room-name`;
  const furnitureStyleId = `${fieldIdPrefix}-furniture-style`;
  const referenceLinkId = `${fieldIdPrefix}-reference-link`;
  const additionalInfoId = `${fieldIdPrefix}-additional-info`;
  const toggleAddon = (id: string) => {
    const current = data.selectedAddons;
    const updated = current.includes(id)
      ? current.filter((a) => a !== id)
      : [...current, id];
    onChange({ ...data, selectedAddons: updated });
  };

  const subtotal = calculateStagingItemTotal(data.selectedAddons, currency);

  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-foreground">
          Image #{index + 1}
        </h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            aria-label={`Remove image ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* File Upload */}
        <FileUpload
          label="Upload Original Photo"
          file={data.file}
          onFileChange={(file) =>
            onChange({
              ...data,
              file,
              ...updateOriginalFileDraftMetadata(data, file),
            })
          }
          accept={STAGING_FILE_ACCEPT}
          required
          helperText={
            data.needsOriginalFileReselection && data.originalFilename
              ? draftCopy.savedOriginalFile(data.originalFilename)
              : undefined
          }
        />

        {/* Furniture Style — visual picker (kept in sync with the dropdown below) */}
        <div>
          <p
            id={visualStyleLabelId}
            className="block text-sm font-medium text-foreground mb-2"
          >
            Furniture Style <span className="text-red-500">*</span>
          </p>
          <p className="text-xs text-foreground/75 mb-3">
            Tap a style card to select it. The dropdown below stays in sync.
          </p>
          <StyleSelector
            value={data.furnitureStyle}
            onChange={(label) => onChange({ ...data, furnitureStyle: label })}
            groupName={`${fieldIdPrefix}-visual-style`}
            ariaLabelledBy={visualStyleLabelId}
          />
        </div>

        {/* Room & Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={roomNameId}
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Room Name / Area <span className="text-red-500">*</span>
            </label>
            <select
              id={roomNameId}
              value={data.roomName}
              onChange={(e) => onChange({ ...data, roomName: e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select room...</option>
              {STAGING_ROOM_OPTIONS.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor={furnitureStyleId}
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Furniture Style <span className="text-red-500">*</span>
            </label>
            <select
              id={furnitureStyleId}
              value={data.furnitureStyle}
              onChange={(e) =>
                onChange({ ...data, furnitureStyle: e.target.value })
              }
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select style...</option>
              {STAGING_STYLE_OPTIONS.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Per-item delivery preferences (File Size Limit + Disclaimer Text) */}
        <ItemDeliveryFields
          idPrefix={fieldIdPrefix}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
        />

        {/* Reference Link */}
        <div>
          <label
            htmlFor={referenceLinkId}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Reference Link
          </label>
          <input
            id={referenceLinkId}
            type="url"
            value={data.referenceLink}
            onChange={(e) =>
              onChange({ ...data, referenceLink: e.target.value })
            }
            placeholder="https://example.com/inspiration"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Reference Image */}
        <FileUpload
          label="Reference Image (optional)"
          file={data.referenceFile}
          onFileChange={(file) =>
            onChange({
              ...data,
              referenceFile: file,
              ...updateReferenceFileDraftMetadata(data, file),
            })
          }
          helperText={
            !data.referenceFile && data.referenceFilename
              ? draftCopy.savedReferenceFile(data.referenceFilename)
              : undefined
          }
        />

        {/* Additional Information */}
        <div>
          <label
            htmlFor={additionalInfoId}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Additional Information
          </label>
          <textarea
            id={additionalInfoId}
            value={data.additionalInfo}
            onChange={(e) =>
              onChange({ ...data, additionalInfo: e.target.value })
            }
            placeholder="Any specific requirements for this image..."
            rows={2}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Add-ons */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Optional Add-ons
          </label>
          <div className="space-y-2">
            {STAGING_ADDONS.map((addon) => (
              <label
                key={addon.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-surface cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={data.selectedAddons.includes(addon.id)}
                    onChange={() => toggleAddon(addon.id)}
                    className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{addon.label}</span>
                </div>
                <span className="text-sm font-medium text-foreground/75">
                  +<RegionalCentsText
                    cents={getCatalogPrice(addon.priceKey, currency)}
                  />
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Subtotal */}
        <ItemSubtotal totalCents={subtotal} />
      </div>
    </div>
  );
}
