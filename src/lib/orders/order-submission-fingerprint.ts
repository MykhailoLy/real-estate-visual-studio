import "server-only";

import { createHash } from "node:crypto";
import type { DeliveryPreferences } from "@/lib/server-validation";
import type { OrderQuote } from "@/lib/pricing/types";
import type {
  TrustedOrderItemFiles,
  ValidatedOrderItem,
} from "./create-order-server.ts";
import { canonicalJson } from "./canonical-json.ts";

export const ORDER_SUBMISSION_SCHEMA_VERSION = 1;

export function createOrderIntentHash(input: {
  serviceType: string;
  currency: string;
  jobTitle: string;
  items: ValidatedOrderItem[];
  itemFiles: TrustedOrderItemFiles[];
  deliveryPreferences?: DeliveryPreferences;
  termsAcceptance: { accepted: boolean; version: string };
  portfolioPermission?: { allowed: boolean };
  sourceDraftId?: string;
}): string {
  return sha256Canonical({
    schemaVersion: ORDER_SUBMISSION_SCHEMA_VERSION,
    serviceType: input.serviceType,
    currency: input.currency,
    jobTitle: input.jobTitle.trim(),
    items: input.items,
    itemFiles: input.itemFiles.map((slot) => ({
      original: immutableFileDescriptor(slot.original),
      reference: slot.reference
        ? immutableFileDescriptor(slot.reference)
        : null,
      references: (slot.references ?? []).map((reference) => ({
        ...immutableFileDescriptor(reference),
        referenceId: reference.referenceId,
        position: reference.position,
      })),
    })),
    deliveryPreferences: input.deliveryPreferences ?? null,
    termsAcceptance: {
      accepted: input.termsAcceptance.accepted,
      version: input.termsAcceptance.version,
    },
    portfolioPermission: {
      allowed: input.portfolioPermission?.allowed === true,
    },
    sourceDraftId: input.sourceDraftId ?? null,
  });
}

export function createAuthoritativeQuoteHash(quote: OrderQuote): string {
  return sha256Canonical(quote);
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function immutableFileDescriptor(file: TrustedOrderItemFiles["original"]) {
  return {
    bucket: file.bucket,
    path: file.path,
    originalFilename: file.originalFilename,
    size: file.size,
    mimeType: file.mimeType,
    draftFileId: file.draftFileId ?? null,
  };
}
