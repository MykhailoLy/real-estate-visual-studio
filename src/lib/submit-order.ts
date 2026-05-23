"use client";

import type { ContactData } from "@/components/order/ContactDetails";
import type { DeliveryPreferencesData } from "@/components/order/DeliveryPreferences";
import type { OrderTermsData } from "@/components/order/OrderTermsBlock";
import { TERMS_VERSION } from "@/components/order/OrderTermsBlock";

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
 * - "metadata": JSON string with serviceType, contact, termsAcceptance,
 *   portfolioPermission (optional), deliveryPreferences (legacy
 *   optional), and items.
 * - "file-{i}-original": original file for each item
 * - "file-{i}-reference": optional reference file for each item
 *
 * `termsAcceptance` is REQUIRED at the API level. We send the local
 * acceptance time the user clicked the checkbox, but the server
 * overwrites this with its own trusted ISO timestamp before persisting.
 *
 * `deliveryPreferences` is optional and accepted only for backward
 * compatibility with earlier clients; the current UI sends delivery
 * preferences on each item.
 */
export async function submitOrder(
  serviceType: string,
  contact: ContactData,
  items: Record<string, unknown>[],
  files: FileRef[],
  orderTerms: OrderTermsData,
  deliveryPreferences?: DeliveryPreferencesData
): Promise<OrderSubmitResult> {
  try {
    const formData = new FormData();

    const metadata = JSON.stringify({
      serviceType,
      contact: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
      },
      termsAcceptance: {
        accepted: orderTerms.accepted,
        version: TERMS_VERSION,
        // Client-side timestamp is informational only; the server replaces
        // it with its own ISO timestamp before saving the order.
        acceptedAt: new Date().toISOString(),
      },
      portfolioPermission: {
        allowed: orderTerms.allowPortfolio,
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
