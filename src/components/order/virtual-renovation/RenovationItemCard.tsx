"use client";

import { Trash2 } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import { RegionalCentsText } from "@/components/pricing/currency-client";
import { calculateRenovationItemTotal } from "@/lib/pricing";
import {
  RENOVATION_INTERNAL_OPTIONS,
  RENOVATION_EXTERNAL_OPTIONS,
  RENOVATION_ROOM_OPTIONS,
  RENOVATION_STYLE_OPTIONS,
  STAGING_FILE_ACCEPT,
} from "@/data/order-options";

export interface RenovationItemData {
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
}

export const emptyRenovationItem = (): RenovationItemData => ({
  file: null,
  selectedInternal: [],
  selectedExternal: [],
  room: "",
  presentationStyle: "",
  ...emptyItemDeliveryFields,
  referenceLink: "",
  referenceFile: null,
  additionalInfo: "",
});

interface RenovationItemCardProps {
  index: number;
  data: RenovationItemData;
  onChange: (data: RenovationItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function RenovationItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
}: RenovationItemCardProps) {
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
    data.selectedExternal
  );

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
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* File Upload */}
        <FileUpload
          label="Upload Original Photo"
          file={data.file}
          onFileChange={(file) => onChange({ ...data, file })}
          accept={STAGING_FILE_ACCEPT}
          required
        />

        {/* Internal Renovations */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Internal Renovations
          </label>
          <div className="space-y-1.5 max-h-64 overflow-y-auto border border-border rounded-lg p-3">
            {RENOVATION_INTERNAL_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={data.selectedInternal.includes(opt.id)}
                    onChange={() => toggleInternal(opt.id)}
                    className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </div>
                <span className="text-xs font-medium text-muted flex-shrink-0 ml-2">
                  <RegionalCentsText cents={opt.price} />
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* External Renovations */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            External Renovations
          </label>
          <div className="space-y-1.5 max-h-64 overflow-y-auto border border-border rounded-lg p-3">
            {RENOVATION_EXTERNAL_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={data.selectedExternal.includes(opt.id)}
                    onChange={() => toggleExternal(opt.id)}
                    className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </div>
                <span className="text-xs font-medium text-muted flex-shrink-0 ml-2">
                  <RegionalCentsText cents={opt.price} />
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Room / Area & Presentation Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Room / Area <span className="text-red-500">*</span>
            </label>
            <select
              value={data.room}
              onChange={(e) => onChange({ ...data, room: e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Presentation Style
            </label>
            <select
              value={data.presentationStyle}
              onChange={(e) =>
                onChange({ ...data, presentationStyle: e.target.value })
              }
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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

        {/* Per-item delivery preferences (File Size Limit + Disclaimer Text) */}
        <ItemDeliveryFields
          idPrefix={`renovation-item-${index}`}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
        />

        {/* Reference Link */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Reference Link
          </label>
          <input
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
          onFileChange={(file) => onChange({ ...data, referenceFile: file })}
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
            placeholder="Describe any specific renovation details..."
            rows={3}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Subtotal */}
        <ItemSubtotal totalCents={subtotal} />
      </div>
    </div>
  );
}
