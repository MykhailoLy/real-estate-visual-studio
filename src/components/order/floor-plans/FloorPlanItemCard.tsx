"use client";

import { Trash2 } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import { useRegionalCentsFormatter } from "@/components/pricing/currency-client";
import { calculateFloorPlanItemTotal } from "@/lib/pricing";
import {
  FLOOR_PLAN_TYPES,
  FLOOR_PLAN_3D_STYLES,
  FLOOR_PLAN_3D_VIEWS,
  FLOOR_PLAN_ORIENTATIONS,
  FLOOR_PLAN_FLOORING_OPTIONS,
  FLOOR_PLAN_ROOMS,
  FLOOR_PLAN_DISCLAIMER_OPTIONS,
  FLOOR_PLAN_FILE_ACCEPT,
} from "@/data/order-options";

export interface FloorPlanItemData {
  file: File | null;
  planType: string;
  numberOfFloors: number;
  /** Per-item file size limit (one of FILE_SIZE_LIMIT_OPTIONS or "") */
  fileSizeLimit: string;
  /** Per-item optional disclaimer text */
  disclaimerText: string;
  style3d: string;
  planView3d: string;
  pageOrientation: string;
  planOrientation: string;
  flooringByRoom: Record<string, string>;
  showAddress: boolean;
  streetAddress: string;
  showTitle: boolean;
  projectTitle: string;
  disclaimerOption: string;
  customDisclaimer: string;
  referenceLink: string;
  referenceFile: File | null;
  additionalInfo: string;
}

export const emptyFloorPlanItem = (): FloorPlanItemData => ({
  file: null,
  planType: "",
  numberOfFloors: 1,
  ...emptyItemDeliveryFields,
  style3d: "",
  planView3d: "",
  pageOrientation: "",
  planOrientation: "",
  flooringByRoom: {},
  showAddress: false,
  streetAddress: "",
  showTitle: false,
  projectTitle: "",
  disclaimerOption: "Do not show disclaimer",
  customDisclaimer: "",
  referenceLink: "",
  referenceFile: null,
  additionalInfo: "",
});

interface FloorPlanItemCardProps {
  index: number;
  data: FloorPlanItemData;
  onChange: (data: FloorPlanItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function FloorPlanItemCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
}: FloorPlanItemCardProps) {
  const formatCents = useRegionalCentsFormatter();
  const selectedType = FLOOR_PLAN_TYPES.find((t) => t.id === data.planType);
  const show3dOptions = selectedType?.has3d ?? false;
  const subtotal = calculateFloorPlanItemTotal(data.planType, data.numberOfFloors);

  const updateFlooring = (room: string, value: string) => {
    onChange({
      ...data,
      flooringByRoom: { ...data.flooringByRoom, [room]: value },
    });
  };

  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-foreground">
          Floor Plan #{index + 1}
        </h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            aria-label={`Remove item ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* File Upload */}
        <FileUpload
          label="Upload Files"
          file={data.file}
          onFileChange={(file) => onChange({ ...data, file })}
          accept={FLOOR_PLAN_FILE_ACCEPT}
          required
          helperText="Upload your floor plan, sketch, measurements, reference photos, or existing plan. The clearer the files, the more accurate the result."
        />

        {/* Plan Type & Floors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Plan Type <span className="text-red-500">*</span>
            </label>
            <select
              value={data.planType}
              onChange={(e) => onChange({ ...data, planType: e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select plan type...</option>
              {FLOOR_PLAN_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label} ({formatCents(type.price)} / floor)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Number of Floors <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={data.numberOfFloors}
              onChange={(e) =>
                onChange({
                  ...data,
                  numberOfFloors: Math.max(1, parseInt(e.target.value) || 1),
                })
              }
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Per-item delivery preferences (File Size Limit + Disclaimer Text) */}
        <ItemDeliveryFields
          idPrefix={`floor-plan-item-${index}`}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
        />

        {/* 3D Options (conditional) */}
        {show3dOptions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                3D Floor Plan Style
              </label>
              <select
                value={data.style3d}
                onChange={(e) => onChange({ ...data, style3d: e.target.value })}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select style...</option>
                {FLOOR_PLAN_3D_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                3D Plan View
              </label>
              <select
                value={data.planView3d}
                onChange={(e) =>
                  onChange({ ...data, planView3d: e.target.value })
                }
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select view...</option>
                {FLOOR_PLAN_3D_VIEWS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Page & Plan Orientation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Page Orientation <span className="text-red-500">*</span>
            </label>
            <select
              value={data.pageOrientation}
              onChange={(e) =>
                onChange({ ...data, pageOrientation: e.target.value })
              }
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select...</option>
              {FLOOR_PLAN_ORIENTATIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Plan Orientation <span className="text-red-500">*</span>
            </label>
            <select
              value={data.planOrientation}
              onChange={(e) =>
                onChange({ ...data, planOrientation: e.target.value })
              }
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select...</option>
              {FLOOR_PLAN_ORIENTATIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Flooring Preferences */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Flooring / Finish Preferences by Room
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FLOOR_PLAN_ROOMS.map((room) => (
              <div key={room}>
                <label className="block text-xs font-medium text-muted mb-1">
                  {room}
                </label>
                <select
                  value={data.flooringByRoom[room] || ""}
                  onChange={(e) => updateFlooring(room, e.target.value)}
                  className="w-full px-2.5 py-2 border border-border rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Not specified</option>
                  {FLOOR_PLAN_FLOORING_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Address / Title Display */}
        <div className="space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={data.showAddress}
              onChange={(e) =>
                onChange({ ...data, showAddress: e.target.checked })
              }
              className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
            />
            <span className="text-sm text-foreground">
              Display property address on plan
            </span>
          </label>
          {data.showAddress && (
            <input
              type="text"
              value={data.streetAddress}
              onChange={(e) =>
                onChange({ ...data, streetAddress: e.target.value })
              }
              placeholder="Street / Building Address"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          )}

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={data.showTitle}
              onChange={(e) =>
                onChange({ ...data, showTitle: e.target.checked })
              }
              className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
            />
            <span className="text-sm text-foreground">
              Display project/property title
            </span>
          </label>
          {data.showTitle && (
            <input
              type="text"
              value={data.projectTitle}
              onChange={(e) =>
                onChange({ ...data, projectTitle: e.target.value })
              }
              placeholder="Project Title / Property Name"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          )}
        </div>

        {/* Disclaimer */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Accuracy / Measurement Disclaimer
          </label>
          <select
            value={data.disclaimerOption}
            onChange={(e) =>
              onChange({ ...data, disclaimerOption: e.target.value })
            }
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {FLOOR_PLAN_DISCLAIMER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {data.disclaimerOption === "Custom disclaimer text" && (
            <textarea
              value={data.customDisclaimer}
              onChange={(e) =>
                onChange({ ...data, customDisclaimer: e.target.value })
              }
              placeholder="Enter your custom disclaimer text..."
              rows={2}
              className="mt-2 w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          )}
        </div>

        {/* Reference */}
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
            placeholder="https://example.com/sample-plan"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <FileUpload
          label="Reference Image / Sample (optional)"
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
            placeholder="Any specific requirements, measurements, or notes..."
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
