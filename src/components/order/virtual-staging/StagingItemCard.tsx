"use client";

import { useState } from "react";
import { Info, Trash2 } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ExampleDialog from "@/components/order/virtual-staging/ExampleDialog";
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
} from "@/lib/order-drafts/virtual-staging";
import type {
  OrderDraftUploadedFileSummary,
} from "@/lib/order-drafts/files";
import type { ServiceOptionMedia } from "@/lib/site-media";
import ReferenceFilesUploader from "@/components/order/ReferenceFilesUploader";
import {
  mergeReferenceFiles,
  type ReferenceFileValue,
} from "@/lib/reference-files";

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

export const emptyStagingItem = (
  furnitureStyle = "",
): StagingItemData => ({
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
  const roomValidationId = getStagingRequiredFieldId(
    data.clientItemId,
    "room",
  );
  const styleValidationId = getStagingRequiredFieldId(
    data.clientItemId,
    "furniture-style",
  );
  const roomErrorId = `${roomValidationId}-error`;
  const styleErrorId = `${styleValidationId}-error`;
  const originalDisabled = disabled || originalBusy;
  const referenceDisabled = disabled || referenceBusy;
  const displayedReferenceFiles = mergeReferenceFiles(
    data.referenceFiles,
    uploadedReferenceFile
      ? [{
          id: uploadedReferenceFile.id,
          file: null,
          filename: uploadedReferenceFile.originalFilename,
          fileSize: uploadedReferenceFile.fileSize,
          mimeType: uploadedReferenceFile.mimeType,
          lastModified: null,
          previewUrl: uploadedReferenceFile.previewUrl,
          previewExpiresAt: uploadedReferenceFile.previewExpiresAt,
          draftFileId: uploadedReferenceFile.id,
        }]
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
    ? exampleMediaByKey[previewAddon.mediaKey] ?? null
    : null;

  return (
    <div
      id={stagingItemDomId(data.clientItemId)}
      className="bg-white border border-border rounded-xl p-5 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-foreground">
          Image #{index + 1}
        </h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled || removeDisabled}
            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Remove image ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* File Upload */}
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
          persistedFile={
            !data.file && uploadedOriginalFile
              ? {
                  id: uploadedOriginalFile.id,
                  filename: uploadedOriginalFile.originalFilename,
                  fileSize: uploadedOriginalFile.fileSize,
                  statusLabel: savedInDraftLabel,
                  previewUrl: uploadedOriginalFile.previewUrl ?? null,
                  previewExpiresAt:
                    uploadedOriginalFile.previewExpiresAt ?? null,
                }
              : null
          }
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
        />

        {/* Room & Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div id={roomValidationId}>
            <label
              htmlFor={roomNameId}
              className="block text-sm font-medium text-foreground mb-1.5"
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
              onChange={(e) => onChange({ ...data, roomName: e.target.value })}
              className={`w-full px-3 py-2.5 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 ${
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
                className="mt-1.5 text-xs text-red-600"
              >
                {validationErrors.room}
              </p>
            )}
          </div>
          <div id={styleValidationId}>
            <label
              htmlFor={furnitureStyleId}
              className="block text-sm font-medium text-foreground mb-1.5"
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
                validationErrors["furniture-style"]
                  ? styleErrorId
                  : undefined
              }
              onChange={(e) =>
                onChange({ ...data, furnitureStyle: e.target.value })
              }
              className={`w-full px-3 py-2.5 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 ${
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
              <p className="mt-1 text-[11px] font-medium text-muted">
                {data.furnitureStyle === defaultFurnitureStyle
                  ? "Order default"
                  : "Individual selection"}
              </p>
            ) : null}
            {validationErrors["furniture-style"] && (
              <p
                id={styleErrorId}
                role="alert"
                className="mt-1.5 text-xs text-red-600"
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
        />

        {/* Reference Link */}
        <div>
          <label
            htmlFor={referenceLinkId}
            className="block text-sm font-medium text-foreground mb-1.5"
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
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-muted">
            Add a link to an online example, brand guide or shared reference.
          </p>
        </div>

        <ReferenceFilesUploader
          files={displayedReferenceFiles}
          onChange={(files) => {
            const keptLegacy = files.some(
              (reference) => reference.id === uploadedReferenceFile?.id,
            );
            if (!keptLegacy && uploadedReferenceFile) onRemoveUploadedReference?.();
            const normalized = files.filter(
              (reference) => reference.id !== uploadedReferenceFile?.id,
            );
            if (onReferenceFilesChange) onReferenceFilesChange(normalized);
            else onChange({ ...data, referenceFiles: normalized });
          }}
          disabled={referenceDisabled}
          operationStatus={referenceOperationStatusText}
        />
        {referenceOperationErrorText ? (
          <p className="text-xs font-medium text-red-700" role="alert">
            {referenceOperationErrorText}
          </p>
        ) : null}

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
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...data, additionalInfo: e.target.value })
            }
            placeholder="Any specific requirements for this image..."
            rows={2}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {/* Add-ons */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Optional Add-ons
          </label>
          <div className="space-y-2">
            {STAGING_ADDONS.map((addon) => (
              <div
                key={addon.id}
                className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-surface"
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
                  <span className="min-w-0 text-sm leading-5 text-foreground">
                    {addon.label}
                  </span>
                </label>
                <div className="flex items-center gap-1">
                  <span className="whitespace-nowrap text-sm font-medium text-foreground/75">
                    +<RegionalCentsText
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
