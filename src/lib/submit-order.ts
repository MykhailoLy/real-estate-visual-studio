"use client";

import type { ContactData } from "@/components/order/ContactDetails";
import type { DeliveryPreferencesData } from "@/components/order/DeliveryPreferences";

export interface OrderSubmitResult {
  success: boolean;
  orderNumber?: string;
  error?: string;
}

interface FileRef {
  file: File | null;
  referenceFile?: File | null;
}

/**
 * Submit an order to POST /api/order.
 *
 * Builds a FormData payload with:
 * - "metadata": JSON string of { serviceType, contact, deliveryPreferences,
 *   items (without File objects) }
 * - "file-{i}-original": original file for each item
 * - "file-{i}-reference": optional reference file for each item
 *
 * `deliveryPreferences` is optional. When omitted, the order is submitted
 * without any delivery preferences — backward compatible with earlier
 * callers and with already-deployed clients.
 */
export async function submitOrder(
  serviceType: string,
  contact: ContactData,
  items: Record<string, unknown>[],
  files: FileRef[],
  deliveryPreferences?: DeliveryPreferencesData
): Promise<OrderSubmitResult> {
  try {
    const formData = new FormData();

    // Attach metadata (item details without File objects)
    const metadata = JSON.stringify({
      serviceType,
      contact: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
      },
      deliveryPreferences: deliveryPreferences
        ? {
            fileSizeLimit: deliveryPreferences.fileSizeLimit || "",
            disclaimerText: deliveryPreferences.disclaimerText || "",
          }
        : undefined,
      items,
    });
    formData.append("metadata", metadata);

    // Attach files
    for (let i = 0; i < files.length; i++) {
      const { file, referenceFile } = files[i];
      if (file) {
        formData.append(`file-${i}-original`, file);
      }
      if (referenceFile) {
        formData.append(`file-${i}-reference`, referenceFile);
      }
    }

    const response = await fetch("/api/order", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Order submission failed. Please try again.",
      };
    }

    return {
      success: true,
      orderNumber: result.orderNumber,
    };
  } catch (err) {
    console.error("Order submission error:", err);
    return {
      success: false,
      error: "Network error. Please check your connection and try again.",
    };
  }
}
