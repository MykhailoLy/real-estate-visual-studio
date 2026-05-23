"use client";

import { Truck } from "lucide-react";
import { FILE_SIZE_LIMIT_OPTIONS } from "@/data/order-options";

/**
 * Order-level delivery preferences (apply to the whole order, not per-item).
 *
 * Both fields are optional. They are not paid add-ons — they exist so the
 * client can communicate constraints (MLS upload caps, required disclaimer
 * text, etc.) at order time and have them stored alongside the order
 * details for our team to honour during delivery.
 */
export interface DeliveryPreferencesData {
  /**
   * One of FILE_SIZE_LIMIT_OPTIONS, or "" for no preference.
   * Stored as a literal string in the order details JSON.
   */
  fileSizeLimit: string;
  /**
   * Optional disclaimer the client wants included with delivered files
   * or listing materials.
   */
  disclaimerText: string;
}

export const emptyDeliveryPreferences: DeliveryPreferencesData = {
  fileSizeLimit: "",
  disclaimerText: "",
};

interface DeliveryPreferencesProps {
  data: DeliveryPreferencesData;
  onChange: (data: DeliveryPreferencesData) => void;
}

export default function DeliveryPreferences({
  data,
  onChange,
}: DeliveryPreferencesProps) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Truck className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            Delivery Preferences
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Optional preferences that apply to the whole order.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* File Size Limit */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            File Size Limit (MLS and other online websites)
          </label>
          <p className="text-xs text-muted mb-2">
            Many listing portals cap individual file uploads. Pick a target if
            your portal has a strict limit.
          </p>
          <select
            value={data.fileSizeLimit}
            onChange={(e) =>
              onChange({ ...data, fileSizeLimit: e.target.value })
            }
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Please Select...</option>
            {FILE_SIZE_LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Disclaimer Text */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Your Disclaimer Text
          </label>
          <p className="text-xs text-muted mb-2">
            Optional text to include with delivered files or listing materials
            if required.
          </p>
          <textarea
            value={data.disclaimerText}
            onChange={(e) =>
              onChange({ ...data, disclaimerText: e.target.value })
            }
            placeholder="Enter any required disclaimer text..."
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
}
