"use client";

import { useState } from "react";
import { Info, Trash2 } from "lucide-react";
import FileUpload, {
  hasFileUploadPreview,
} from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ExampleDialog from "@/components/order/ExampleDialog";
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
import { updateOriginalFileDraftMetadata } from "@/lib/order-drafts/virtual-staging";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import type { ServiceOptionMedia } from "@/lib/site-media";
import ReferenceFilesUploader from "@/components/order/ReferenceFilesUploader";
import {
  mergeReferenceFiles,
  resolveReferenceFileSelection,
  type ReferenceFileValue,
} from "@/lib/reference-files";
import OrderImageCardHeader from "@/components/order/OrderImageCardHeader";
import OrderImageWorkspace from "@/components/order/OrderImageWorkspace";

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
  referenceFiles: ReferenceFileValue[];
  /** Legacy singular draft shape retained for backward restoration. */
  referenceFile: File | null;
  additionalInfo: string;
  selectedAddons: string[];
  originalFilename: string | null;
  referenceFilename: string | null;
  needsOriginalFileReselection: boolean;
}

export const emptyStagingItem = (furnitureStyle = ""): StagingItemData => ({
  clientItemId: createDraftClientItemId(),
  file: null,
  roomName: "",
  furnitureStyle,
  ...emptyItemDeliveryFields,
  referenceLink: "",
  referenceFiles: [],
  referenceFile: null,
  additionalInfo: "",
  selectedAddons: [],
  originalFilename: null,
  referenceFilename: null,
  needsOriginalFileReselection: false,
});

export type StagingRequiredField = "original" | "room" | "furniture-style";

export function getStagingRequiredFieldId(
  clientItemId: string,
  field: StagingRequiredField,
): string {
  return `virtual-staging-${clientItemId}-${field}`;
}

/** Stable target used when the Review step sends a customer back to one image. */
export function stagingItemDomId(clientItemId: string): string {
  return `virtual-staging-item-${clientItemId}`;
}

interface StagingItemCardProps {
  index: number;
  totalItems: number;
  data: StagingItemData;
  defaultFurnitureStyle: string;
  exampleMediaByKey: Record<string, ServiceOptionMedia>;
  onChange: (data: StagingItemData) => void;
  onReferenceFilesChange?: (files: ReferenceFileValue[]) => void;
  onRemove: () => void;
  canRemove: boolean;
  disabled?: boolean;
  removeDisabled?: boolean;
  draftCopy?: {
    savedOriginalFile: (filename: string) => string;
    savedReferenceFile: (filename: string) => string;
  };
  uploadedOriginalFile?: OrderDraftUploadedFileSummary | null;
  uploadedReferenceFile?: OrderDraftUploadedFileSummary | null;
  originalOperationStatusText?: string;
  referenceOperationStatusText?: string;
  originalOperationErrorText?: string;
  referenceOperationErrorText?: string;
  originalBusy?: boolean;
  referenceBusy?: boolean;
  onOriginalFileSelected?: (file: File | null) => void;
  onReferenceFileSelected?: (file: File | null) => void;
  onRemoveUploadedOriginal?: () => void;
  onRemoveUploadedReference?: () => void;
  onRetryOriginalUpload?: () => void;
  onRetryReferenceUpload?: () => void;
  retryUploadLabel?: string;
  replaceFileLabel?: string;
  removeSavedFileLabel?: string;
  savedInDraftLabel?: string;
  validationErrors?: Partial<Record<StagingRequiredField, string>>;
}

const DEFAULT_DRAFT_COPY = {
  savedOriginalFile: (filename: string) =>
    `Saved draft file: ${filename}. It will be used when you submit.`,
  savedReferenceFile: (filename: string) =>
    `Saved draft reference: ${filename}. It will be used when you submit.`,
};

export default function StagingItemCard({
  index,
  totalItems,
  data,
  defaultFurnitureStyle,
  exampleMediaByKey,
  onChange,
  onReferenceFilesChange,
  onRemove,
  canRemove,
  disabled = false,
  removeDisabled = false,
  draftCopy = DEFAULT_DRAFT_COPY,
  uploadedOriginalFile,
  uploadedReferenceFile,
  originalOperationStatusText,
  referenceOperationStatusText,
  originalOperationErrorText,
  referenceOperationErrorText,
  originalBusy = false,
  referenceBusy = false,
  onOriginalFileSelected,
  onRemoveUploadedOriginal,
  onRemoveUploadedReference,
  onRetryOriginalUpload,
  retryUploadLabel,
  replaceFileLabel,
  removeSavedFileLabel,
  savedInDraftLabel,
  validationErrors = {},
}: StagingItemCardProps) {
  const [previewAddonId, setPreviewAddonId] = useState<string | null>(null);
  const currency = useDisplayCurrency();
  const fieldIdPrefix = `staging-${data.clientItemId}`;
  const roomNameId = `${fieldIdPrefix}-room-name`;
  const furnitureStyleId = `${fieldIdPrefix}-furniture-style`;
  const referenceLinkId = `${fieldIdPrefix}-reference-link`;
  const additionalInfoId = `${fieldIdPrefix}-additional-info`;
  const originalValidationId = getStagingRequiredFieldId(
    data.clientItemId,
    "original",
  );
  const roomValidationId = getStagingRequiredFieldId(data.clientItemId, "room");
  const styleValidationId = getStagingRequiredFieldId(
    data.clientItemId,
    "furniture-style",
  );
  const roomErrorId = `${roomValidationId}-error`;
  const styleErrorId = `${styleValidationId}-error`;
  const originalDisabled = disabled || originalBusy;
  const referenceDisabled = disabled || referenceBusy;
  const uploadInputId = `${fieldIdPrefix}-original-upload`;
  const persistedOriginalDisplay = uploadedOriginalFile
    ? {
        id: uploadedOriginalFile.id,
        filename: uploadedOriginalFile.originalFilename,
        fileSize: uploadedOriginalFile.fileSize,
        statusLabel: savedInDraftLabel,
        previewUrl: uploadedOriginalFile.previewUrl ?? null,
        previewExpiresAt: uploadedOriginalFile.previewExpiresAt ?? null,
      }
    : null;
  const hasOriginalPreview = hasFileUploadPreview(
    data.file,
    persistedOriginalDisplay,
  );
  const displayedReferenceFiles = mergeReferenceFiles(
    data.referenceFiles,
    uploadedReferenceFile
      ? [
          {
            id: uploadedReferenceFile.id,
            file: null,
            filename: uploadedReferenceFile.originalFilename,
            fileSize: uploadedReferenceFile.fileSize,
            mimeType: uploadedReferenceFile.mimeType,
            lastModified: null,
            previewUrl: uploadedReferenceFile.previewUrl,
            previewExpiresAt: uploadedReferenceFile.previewExpiresAt,
            draftFileId: uploadedReferenceFile.id,
          },
        ]
      : [],
  );
  const toggleAddon = (id: string) => {
    if (disabled) return;
    const current = data.selectedAddons;
    const updated = current.includes(id)
      ? current.filter((a) => a !== id)
      : [...current, id];
    onChange({ ...data, selectedAddons: updated });
  };

  const subtotal = calculateStagingItemTotal(data.selectedAddons, currency);
  const previewAddon = STAGING_ADDONS.find(
    (addon) => addon.id === previewAddonId,
  );
  const previewAddonMedia = previewAddon
    ? (exampleMediaByKey[previewAddon.mediaKey] ?? null)
    : null;

  return (
    <div
      id={stagingItemDomId(data.clientItemId)}
      className="scroll-mt-20 rounded-2xl border border-border bg-white p-5 shadow-sm sm:scroll-mt-24 sm:p-6"
    >
      <OrderImageCardHeader
        index={index}
        totalItems={totalItems}
        action={
          canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled || removeDisabled}
              className="rounded-md p-2.5 text-muted transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Remove image ${index + 1}`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : null
        }
      />

      <OrderImageWorkspace
        hasPreview={hasOriginalPreview}
        media={
          <FileUpload
            viewerVariant="photo"
            label="Upload Original Photo"
            file={data.file}
            onFileChange={(file) => {
              if (onOriginalFileSelected) {
                onOriginalFileSelected(file);
                return;
              }
              onChange({
                ...data,
                file,
                ...updateOriginalFileDraftMetadata(data, file),
              });
            }}
            accept={STAGING_FILE_ACCEPT}
            required
            helperText={
              data.needsOriginalFileReselection && data.originalFilename
                ? draftCopy.savedOriginalFile(data.originalFilename)
                : undefined
            }
            persistedFile={persistedOriginalDisplay}
            operationStatusText={originalOperationStatusText}
            operationErrorText={originalOperationErrorText}
            disabled={originalDisabled}
            retryDisabled={originalDisabled}
            removeDisabled={originalDisabled}
            onRetry={onRetryOriginalUpload}
            onRemovePersisted={onRemoveUploadedOriginal}
            retryLabel={retryUploadLabel}
            replaceLabel={replaceFileLabel}
            removePersistedLabel={removeSavedFileLabel}
            validationFieldId={originalValidationId}
            validationError={validationErrors.original}
            inputId={uploadInputId}
            presentationVariant="workspace"
            comfortable
          />
        }
      >
        <div className="min-w-0 space-y-7">
          {/* Room & Style */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div id={roomValidationId}>
              <label
                htmlFor={roomNameId}
                className="mb-2 block text-base font-medium text-foreground"
              >
                Room Name / Area <span className="text-red-500">*</span>
              </label>
              <select
                id={roomNameId}
                value={data.roomName}
                disabled={disabled}
                required
                data-validation-control
                aria-invalid={Boolean(validationErrors.room) || undefined}
                aria-describedby={
                  validationErrors.room ? roomErrorId : undefined
                }
                onChange={(e) =>
                  onChange({ ...data, roomName: e.target.value })
                }
                className={`w-full rounded-lg border bg-white px-3 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 ${
                  validationErrors.room ? "border-red-300" : "border-border"
                }`}
              >
                <option value="">Select room...</option>
                {STAGING_ROOM_OPTIONS.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
              {validationErrors.room && (
                <p
                  id={roomErrorId}
                  role="alert"
                  className="mt-1.5 text-sm text-red-600"
                >
                  {validationErrors.room}
                </p>
              )}
            </div>
            <div id={styleValidationId}>
              <label
                htmlFor={furnitureStyleId}
                className="mb-2 block text-base font-medium text-foreground"
              >
                Furniture Style <span className="text-red-500">*</span>
              </label>
              <select
                id={furnitureStyleId}
                value={data.furnitureStyle}
                disabled={disabled}
                required
                aria-invalid={
                  Boolean(validationErrors["furniture-style"]) || undefined
                }
                aria-describedby={
                  validationErrors["furniture-style"] ? styleErrorId : undefined
                }
                onChange={(e) =>
                  onChange({ ...data, furnitureStyle: e.target.value })
                }
                className={`w-full rounded-lg border bg-white px-3 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 ${
                  validationErrors["furniture-style"]
                    ? "border-red-300"
                    : "border-border"
                }`}
              >
                <option value="">Select style...</option>
                {STAGING_STYLE_OPTIONS.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
              {data.furnitureStyle ? (
                <p className="mt-1.5 text-sm font-medium text-muted">
                  {data.furnitureStyle === defaultFurnitureStyle
                    ? "Order default"
                    : "Individual selection"}
                </p>
              ) : null}
              {validationErrors["furniture-style"] && (
                <p
                  id={styleErrorId}
                  role="alert"
                  className="mt-1.5 text-sm text-red-600"
                >
                  {validationErrors["furniture-style"]}
                </p>
              )}
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
            disabled={disabled}
            layoutVariant="desktop-columns"
            comfortable
          />

          {/* Reference Link */}
          <div>
            <label
              htmlFor={referenceLinkId}
              className="mb-2 block text-base font-medium text-foreground"
            >
              Reference Link (optional)
            </label>
            <input
              id={referenceLinkId}
              type="url"
              value={data.referenceLink}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...data, referenceLink: e.target.value })
              }
              placeholder="https://example.com/inspiration"
              className="w-full rounded-lg border border-border px-3 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-2 text-sm leading-6 text-muted">
              Add a link to an online example, brand guide or shared reference.
            </p>
          </div>

          <ReferenceFilesUploader
            files={displayedReferenceFiles}
            onChange={(files) => {
              const selection = resolveReferenceFileSelection(
                files,
                data.referenceFiles,
                uploadedReferenceFile,
              );
              if (selection.removeLegacy) onRemoveUploadedReference?.();
              if (onReferenceFilesChange)
                onReferenceFilesChange(selection.references);
              else onChange({ ...data, referenceFiles: selection.references });
            }}
            disabled={referenceDisabled}
            operationStatus={referenceOperationStatusText}
            comfortable
          />
          {referenceOperationErrorText ? (
            <p className="text-sm font-medium text-red-700" role="alert">
              {referenceOperationErrorText}
            </p>
          ) : null}

          {/* Additional Information */}
          <div>
            <label
              htmlFor={additionalInfoId}
              className="mb-2 block text-base font-medium text-foreground"
            >
              Additional Information
            </label>
            <textarea
              id={additionalInfoId}
              value={data.additionalInfo}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...data, additionalInfo: e.target.value })
              }
              placeholder="Any specific requirements for this image..."
              rows={3}
              className="w-full resize-none rounded-lg border border-border px-3 py-3 text-base leading-6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* Add-ons */}
          <div>
            <p className="mb-3 text-base font-medium text-foreground">
              Optional Add-ons
            </p>
            <div className="grid gap-3 xl:grid-cols-2">
              {STAGING_ADDONS.map((addon) => (
                <div
                  key={addon.id}
                  className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-surface"
                >
                  <label
                    className={`flex min-w-0 items-center gap-2.5 py-1 ${
                      disabled
                        ? "cursor-not-allowed opacity-70"
                        : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={data.selectedAddons.includes(addon.id)}
                      disabled={disabled}
                      onChange={() => toggleAddon(addon.id)}
                      className="w-4 h-4 rounded text-primary border-border focus:ring-primary disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0 text-[15px] leading-5 text-foreground">
                      {addon.label}
                    </span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="whitespace-nowrap text-[15px] font-medium text-foreground/75">
                      +
                      <RegionalCentsText
                        cents={getCatalogPrice(addon.priceKey, currency)}
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewAddonId(addon.id)}
                      aria-label={`View ${addon.label} example`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    >
                      <Info className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subtotal */}
          <ItemSubtotal totalCents={subtotal} />
        </div>
      </OrderImageWorkspace>

      {previewAddon ? (
        <ExampleDialog
          open={Boolean(previewAddonId)}
          onOpenChange={(open) => {
            if (!open) setPreviewAddonId(null);
          }}
          title={previewAddon.label}
          description={
            previewAddonMedia?.description?.trim() || previewAddon.description
          }
          media={previewAddonMedia}
        />
      ) : null}
    </div>
  );
}
