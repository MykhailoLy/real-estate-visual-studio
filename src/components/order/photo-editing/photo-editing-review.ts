import { PHOTO_EDIT_OPTIONS } from "../../../data/order-options.ts";
import { calculateOrderQuote } from "../../../lib/pricing/calculate.ts";
import type {
  OrderQuote,
  TransactionalCurrency,
} from "../../../lib/pricing/types.ts";

export interface PhotoEditingReviewRow {
  label: string;
  value: string;
}

export interface PhotoEditingReviewItemSource {
  selectedOptions: string[];
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
}

export interface PhotoEditingReviewUploadedFileSource {
  itemClientId: string;
  kind: "original" | "reference";
  originalFilename: string;
  fileSize: number;
  previewUrl?: string | null;
}

export interface PhotoEditingReviewFileDisplay {
  filename: string;
  fileSize: number;
  previewUrl: string | null;
}

function textOrNone(value: string): string {
  return value.trim() || "None";
}

/**
 * Maps canonical Photo Editing selections to customer-facing review labels.
 * Unknown IDs are deliberately omitted instead of exposing internal values.
 */
export function buildPhotoEditingReviewRows(
  item: PhotoEditingReviewItemSource,
): PhotoEditingReviewRow[] {
  const selectedOperations = item.selectedOptions.flatMap((id) => {
    const option = PHOTO_EDIT_OPTIONS.find((candidate) => candidate.id === id);
    return option ? [option.label] : [];
  });

  return [
    {
      label: "Editing Operations",
      value: selectedOperations.length ? selectedOperations.join(", ") : "None",
    },
    {
      label: "File Size Limit",
      value: item.fileSizeLimit.trim() || "Not specified",
    },
    { label: "Disclaimer Text", value: textOrNone(item.disclaimerText) },
    {
      label: "Additional Information",
      value: textOrNone(item.additionalInfo),
    },
  ];
}

/** Uses the production pricing calculator; review never owns price arithmetic. */
export function calculatePhotoEditingReviewQuote(
  items: PhotoEditingReviewItemSource[],
  currency: TransactionalCurrency,
  partnerClient = false,
): OrderQuote {
  return calculateOrderQuote({
    serviceType: "photo-editing",
    currency,
    items: items.map((item) => ({
      selectedOptions: item.selectedOptions,
    })),
  }, { partnerClient });
}

/**
 * Returns display-only persisted file metadata matched by stable item identity.
 * Storage paths, buckets, tokens, and upload identifiers are never propagated.
 */
export function findPhotoEditingReviewFileDisplay(
  clientItemId: string,
  files: PhotoEditingReviewUploadedFileSource[],
): PhotoEditingReviewFileDisplay | null {
  const file = files.find(
    (candidate) =>
      candidate.kind === "original" &&
      candidate.itemClientId === clientItemId,
  );
  if (!file) return null;
  return {
    filename: file.originalFilename,
    fileSize: file.fileSize,
    previewUrl: file.previewUrl ?? null,
  };
}
