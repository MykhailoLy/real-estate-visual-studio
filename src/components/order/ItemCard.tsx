"use client";

import { Trash2 } from "lucide-react";
import FileUpload from "./FileUpload";
import StagingFields from "./StagingFields";
import RenovationFields from "./RenovationFields";
import FloorPlanFields from "./FloorPlanFields";
import PhotoEditFields from "./PhotoEditFields";
import type { RemoteServiceType } from "@/types";

export interface ItemData {
  originalFile: File | null;
  referenceFile: File | null;
  staging: {
    room_type: string;
    interior_style: string;
    notes: string;
    reference_link: string;
  };
  renovation: {
    instructions: string;
    elements_to_keep: string;
    elements_to_remove: string;
    elements_to_replace: string;
    preferred_materials: string;
    reference_link: string;
    notes: string;
  };
  floorPlan: {
    property_type: string;
    number_of_floors: number;
    output_type: string;
    notes: string;
  };
  photoEdit: {
    editing_types: string[];
    notes: string;
  };
}

export const createEmptyItem = (): ItemData => ({
  originalFile: null,
  referenceFile: null,
  staging: { room_type: "", interior_style: "", notes: "", reference_link: "" },
  renovation: {
    instructions: "",
    elements_to_keep: "",
    elements_to_remove: "",
    elements_to_replace: "",
    preferred_materials: "",
    reference_link: "",
    notes: "",
  },
  floorPlan: { property_type: "", number_of_floors: 1, output_type: "3D", notes: "" },
  photoEdit: { editing_types: [], notes: "" },
});

interface ItemCardProps {
  index: number;
  serviceType: RemoteServiceType;
  data: ItemData;
  onChange: (data: ItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function ItemCard({
  index,
  serviceType,
  data,
  onChange,
  onRemove,
  canRemove,
}: ItemCardProps) {
  const fileLabel =
    serviceType === "floor-plans"
      ? "Upload Floor Plan / Sketch / Photos"
      : "Upload Original Photo";

  const fileAccept: Record<string, string[]> =
    serviceType === "floor-plans"
      ? {
          "image/jpeg": [".jpg", ".jpeg"],
          "image/png": [".png"],
          "application/pdf": [".pdf"],
        }
      : { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] };

  return (
    <div className="relative bg-white border border-border rounded-xl p-5 shadow-sm">
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
            aria-label={`Remove item ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* File Upload */}
      <div className="mb-4">
        <FileUpload
          label={fileLabel}
          file={data.originalFile}
          onFileChange={(file) => onChange({ ...data, originalFile: file })}
          accept={fileAccept}
          required
        />
      </div>

      {/* Service-Specific Fields */}
      {serviceType === "virtual-staging" && (
        <StagingFields
          data={data.staging}
          onChange={(staging) => onChange({ ...data, staging })}
        />
      )}
      {serviceType === "virtual-renovation" && (
        <RenovationFields
          data={data.renovation}
          onChange={(renovation) => onChange({ ...data, renovation })}
        />
      )}
      {serviceType === "floor-plans" && (
        <FloorPlanFields
          data={data.floorPlan}
          onChange={(floorPlan) => onChange({ ...data, floorPlan })}
        />
      )}
      {serviceType === "photo-editing" && (
        <PhotoEditFields
          data={data.photoEdit}
          onChange={(photoEdit) => onChange({ ...data, photoEdit })}
        />
      )}

      {/* Reference Image (optional, not for floor plans) */}
      {serviceType !== "floor-plans" && (
        <div className="mt-4 pt-4 border-t border-border">
          <FileUpload
            label="Reference Image (optional)"
            file={data.referenceFile}
            onFileChange={(file) => onChange({ ...data, referenceFile: file })}
          />
        </div>
      )}
    </div>
  );
}
