"use client";

import { useState } from "react";
import { Copy, Info, Trash2 } from "lucide-react";
import FileUpload from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import ExampleDialog from "@/components/order/ExampleDialog";
import {
  RegionalCentsText,
  useDisplayCurrency,
} from "@/components/pricing/currency-client";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import { getCatalogPrice } from "@/lib/pricing/catalog";
import { PHOTO_EDIT_FILE_ACCEPT } from "@/data/order-options";
import { createDraftClientItemId } from "@/lib/order-drafts/utils";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import type { ServiceOptionMedia } from "@/lib/site-media";
import OrderImageCardHeader from "@/components/order/OrderImageCardHeader";
import {
  AERIAL_EDITING_DEFAULT,
  AERIAL_EDITING_OPTIONS,
  DAY_SKY_STYLE_DEFAULT,
  SINGLE_EXPOSURE_OPTION_ID,
  SINGLE_EXPOSURE_PREFERENCES,
  SINGLE_EXPOSURE_STANDARD_ADDONS,
  THREE_STATE_DEFAULT,
  getAerialEditingOption,
  getSingleExposureSelectedOptions,
  isDaySkyStyleId,
  type AerialEditingId,
  type DaySkyStyleId,
  type SingleExposureStandardAddOnId,
  type ThreeStateValue,
} from "@/lib/image-enhancement";
import ThreeStatePreference from "./ThreeStatePreference";
import DaySkyStyleSelector from "./DaySkyStyleSelector";
import ReferenceFilesUploader from "@/components/order/ReferenceFilesUploader";
import {
  mergeReferenceFiles,
  resolveReferenceFileSelection,
  type ReferenceFileValue,
} from "@/lib/reference-files";

export interface SingleExposureItemData {
  clientItemId: string;
  file: File | null;
  referenceLink: string;
  referenceFiles: ReferenceFileValue[];
  /** Legacy singular draft fields retained only for backward restoration. */
  referenceFile: File | null;
  originalFilename: string | null;
  referenceFilename: string | null;
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  grassRepair: ThreeStateValue;
  skyReplacement: ThreeStateValue;
  tvScreenReplacement: ThreeStateValue;
  addFireToFireplace: ThreeStateValue;
  /** Remembered value, active only while Sky Replacement is Yes. */
  daySkyStyle: DaySkyStyleId;
  selectedAddons: SingleExposureStandardAddOnId[];
  aerialEditing: AerialEditingId;
  aerialEditingInstructions: string;
}

export const emptySingleExposureItem = (): SingleExposureItemData => ({
  clientItemId: createDraftClientItemId(),
  file: null,
  referenceLink: "",
  referenceFiles: [],
  referenceFile: null,
  originalFilename: null,
  referenceFilename: null,
  ...emptyItemDeliveryFields,
  additionalInfo: "",
  grassRepair: THREE_STATE_DEFAULT,
  skyReplacement: THREE_STATE_DEFAULT,
  tvScreenReplacement: THREE_STATE_DEFAULT,
  addFireToFireplace: THREE_STATE_DEFAULT,
  daySkyStyle: DAY_SKY_STYLE_DEFAULT,
  selectedAddons: [],
  aerialEditing: AERIAL_EDITING_DEFAULT,
  aerialEditingInstructions: "",
});

export const singleExposureItemDomId = (clientItemId: string) =>
  `single-exposure-item-${clientItemId}`;

interface SingleExposureItemCardProps {
  index: number;
  data: SingleExposureItemData;
  onChange: (data: SingleExposureItemData) => void;
  onReferenceFilesChange?: (files: ReferenceFileValue[]) => void;
  onRemove: () => void;
  canRemove: boolean;
  exampleMediaByKey: Record<string, ServiceOptionMedia>;
  onApplyToAll: () => void;
  showApplyToAll: boolean;
  persistedOriginal?: OrderDraftUploadedFileSummary | null;
  persistedReference?: OrderDraftUploadedFileSummary | null;
  onOriginalFileChange?: (file: File | null) => void;
  onReferenceFileChange?: (file: File | null) => void;
  onRemovePersistedOriginal?: () => void;
  onRemovePersistedReference?: () => void;
  originalOperationStatus?: string;
  referenceOperationStatus?: string;
  fileOperationsDisabled?: boolean;
  showErrors?: boolean;
}

const PREF_FIELDS = SINGLE_EXPOSURE_PREFERENCES;

export default function SingleExposureItemCard({
  index,
  data,
  onChange,
  onReferenceFilesChange,
  onRemove,
  canRemove,
  exampleMediaByKey,
  onApplyToAll,
  showApplyToAll,
  persistedOriginal,
  persistedReference,
  onOriginalFileChange,
  onRemovePersistedOriginal,
  onRemovePersistedReference,
  originalOperationStatus,
  referenceOperationStatus,
  fileOperationsDisabled = false,
  showErrors = false,
}: SingleExposureItemCardProps) {
  const [previewAddonId, setPreviewAddonId] = useState<string | null>(null);
  const [showAerialInfo, setShowAerialInfo] = useState(false);
  const currency = useDisplayCurrency();
  const selectedOptions = getSingleExposureSelectedOptions(
    data.selectedAddons,
    data.aerialEditing,
  );
  const subtotal = calculatePhotoEditItemTotal(
    selectedOptions,
    currency,
    SINGLE_EXPOSURE_OPTION_ID,
  );
  const idPrefix = singleExposureItemDomId(data.clientItemId);
  const selectedAerial = getAerialEditingOption(data.aerialEditing);
  const previewAddon = SINGLE_EXPOSURE_STANDARD_ADDONS.find(
    (addon) => addon.id === previewAddonId,
  );
  const previewAddonMedia = previewAddon
    ? exampleMediaByKey[previewAddon.mediaKey] ?? null
    : null;
  const aerialMedia = selectedAerial.mediaKey
    ? exampleMediaByKey[selectedAerial.mediaKey] ?? null
    : null;
  const aerialDetailsMissing =
    showErrors &&
    selectedAerial.requiresDetails &&
    !data.aerialEditingInstructions.trim() &&
    data.referenceFiles.length === 0 &&
    !data.referenceFile &&
    !persistedReference;
  const displayedReferenceFiles = mergeReferenceFiles(
    data.referenceFiles,
    persistedReference
      ? [{
          id: persistedReference.id,
          file: null,
          filename: persistedReference.originalFilename,
          fileSize: persistedReference.fileSize,
          mimeType: persistedReference.mimeType,
          lastModified: null,
          previewUrl: persistedReference.previewUrl,
          previewExpiresAt: persistedReference.previewExpiresAt,
          draftFileId: persistedReference.id,
        }]
      : [],
  );

  const toggleAddOn = (id: SingleExposureStandardAddOnId) => {
    const selectedAddons = data.selectedAddons.includes(id)
      ? data.selectedAddons.filter((candidate) => candidate !== id)
      : [...data.selectedAddons, id];
    onChange({ ...data, selectedAddons });
  };

  return (
    <div
      id={idPrefix}
      className="scroll-mt-20 rounded-2xl border border-border bg-white p-5 shadow-sm sm:scroll-mt-24"
    >
      <OrderImageCardHeader
        index={index}
        itemLabel="Photo"
        filename={data.file?.name ?? persistedOriginal?.originalFilename ?? data.originalFilename}
        action={
          canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={fileOperationsDisabled}
            className="rounded-md p-2.5 text-muted transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Remove photo ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
          ) : null
        }
      />

      <div className="space-y-5">
        <FileUpload
          viewerVariant="photo"
          label="Upload Original Photo"
          file={data.file}
          onFileChange={
            onOriginalFileChange ?? ((file) => onChange({ ...data, file }))
          }
          accept={PHOTO_EDIT_FILE_ACCEPT}
          required
          persistedFile={
            persistedOriginal
              ? {
                  id: persistedOriginal.id,
                  filename: persistedOriginal.originalFilename,
                  fileSize: persistedOriginal.fileSize,
                  previewUrl: persistedOriginal.previewUrl,
                  previewExpiresAt: persistedOriginal.previewExpiresAt,
                  statusLabel: "Saved in draft",
                }
              : null
          }
          operationStatusText={originalOperationStatus}
          disabled={fileOperationsDisabled}
          removeDisabled={fileOperationsDisabled}
          onRemovePersisted={onRemovePersistedOriginal}
          validationError={
            showErrors && !data.file && !persistedOriginal
              ? "Upload an original photo before review."
              : undefined
          }
        />

        <div>
          <label
            htmlFor={`${idPrefix}-reference-link`}
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Reference Link (optional)
          </label>
          <input
            id={`${idPrefix}-reference-link`}
            type="url"
            value={data.referenceLink}
            onChange={(event) =>
              onChange({ ...data, referenceLink: event.target.value })
            }
            placeholder="https://example.com/reference"
            className="w-full rounded-lg border border-border px-3 py-2.5 text-dashboard-mobile-control md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-1 text-dashboard-body text-muted">
            Add a link to an online example, brand guide or shared reference.
          </p>
        </div>

        <ReferenceFilesUploader
          files={displayedReferenceFiles}
          onChange={(referenceFiles) => {
            const selection = resolveReferenceFileSelection(
              referenceFiles,
              data.referenceFiles,
              persistedReference,
            );
            if (selection.removeLegacy) {
              onRemovePersistedReference?.();
            }
            if (onReferenceFilesChange) onReferenceFilesChange(selection.references);
            else {
              onChange({
                ...data,
                referenceFiles: selection.references,
                referenceFile: null,
                referenceFilename: null,
              });
            }
          }}
          disabled={fileOperationsDisabled}
          operationStatus={referenceOperationStatus}
        />

        <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-4">
          <p className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
            Image Preferences
          </p>
          {PREF_FIELDS.map((pref) => (
            <ThreeStatePreference
              key={pref.field}
              label={pref.label}
              value={data[pref.field] as ThreeStateValue}
              onChange={(value) =>
                onChange({
                  ...data,
                  [pref.field]: value,
                  ...(pref.field === "skyReplacement" &&
                  value === "yes" &&
                  !isDaySkyStyleId(data.daySkyStyle)
                    ? { daySkyStyle: DAY_SKY_STYLE_DEFAULT }
                    : {}),
                })
              }
              idPrefix={`${idPrefix}-${pref.field}`}
            />
          ))}
        </div>

        {data.skyReplacement === "yes" ? (
          <DaySkyStyleSelector
            value={data.daySkyStyle}
            onChange={(daySkyStyle) => onChange({ ...data, daySkyStyle })}
            mediaByKey={exampleMediaByKey}
            idPrefix={idPrefix}
          />
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Optional Add-ons
          </p>
          <div className="space-y-2">
            {SINGLE_EXPOSURE_STANDARD_ADDONS.map((addon) => (
              <div
                key={addon.id}
                className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-surface"
              >
                <label className="flex min-w-0 cursor-pointer items-center gap-2.5 py-1">
                  <input
                    type="checkbox"
                    checked={data.selectedAddons.includes(addon.id)}
                    onChange={() => toggleAddOn(addon.id)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="min-w-0 text-sm leading-5 text-foreground">
                    {addon.label}
                  </span>
                </label>
                <div className="flex items-center gap-1">
                  <span className="whitespace-nowrap text-sm font-medium text-foreground/75">
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

        <div className="rounded-xl border border-border p-4">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-medium text-foreground">
              Aerial Editing
              <select
                value={data.aerialEditing}
                onChange={(event) =>
                  onChange({
                    ...data,
                    aerialEditing: event.target.value as AerialEditingId,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-dashboard-mobile-control md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {AERIAL_EDITING_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setShowAerialInfo(true)}
              aria-label="View Aerial Editing options"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {selectedAerial.priceKey ? (
            <p className="mt-2 text-dashboard-action font-semibold text-primary">
              +
              <RegionalCentsText
                cents={getCatalogPrice(selectedAerial.priceKey, currency)}
              />
              {" per photo"}
            </p>
          ) : (
            <p className="mt-2 text-dashboard-metadata text-muted">No additional charge</p>
          )}

          {data.aerialEditing !== AERIAL_EDITING_DEFAULT ? (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div>
                <h5 className="text-sm font-semibold text-foreground">
                  Aerial Editing Details
                </h5>
                <label
                  htmlFor={`${idPrefix}-aerial-instructions`}
                  className="mt-3 block text-sm font-medium text-foreground"
                >
                  Aerial Editing Instructions
                </label>
                <p className="mt-1 text-dashboard-body text-foreground/75">
                  Describe the property location, required marker position or
                  areas that should be highlighted.
                </p>
                <textarea
                  id={`${idPrefix}-aerial-instructions`}
                  value={data.aerialEditingInstructions}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      aerialEditingInstructions: event.target.value,
                    })
                  }
                  rows={3}
                  aria-invalid={aerialDetailsMissing || undefined}
                  className={`mt-2 w-full resize-none rounded-lg border px-3 py-2.5 text-dashboard-mobile-control md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    aerialDetailsMissing ? "border-red-400" : "border-border"
                  }`}
                />
              </div>

              {aerialDetailsMissing ? (
                <p className="text-dashboard-metadata font-medium text-red-700" role="alert">
                  Add meaningful instructions or at least one Reference File.
                </p>
              ) : null}

              {data.aerialEditing === "multiple-lot-highlight" ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-dashboard-body text-amber-900">
                  Includes up to 5 lots. Contact PicchuSpot for larger or more
                  complex site plans.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <ItemDeliveryFields
          idPrefix={idPrefix}
          data={{
            fileSizeLimit: data.fileSizeLimit,
            disclaimerText: data.disclaimerText,
          }}
          onChange={(prefs) => onChange({ ...data, ...prefs })}
        />

        <div>
          <label
            htmlFor={`${idPrefix}-notes`}
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Additional Instructions
          </label>
          <textarea
            id={`${idPrefix}-notes`}
            value={data.additionalInfo}
            onChange={(event) =>
              onChange({ ...data, additionalInfo: event.target.value })
            }
            placeholder="Optional: any specific enhancement notes for this photo (e.g. brighten interior, recover window view)..."
            rows={2}
            className="w-full resize-none rounded-lg border border-border px-3 py-2.5 text-dashboard-mobile-control md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {showApplyToAll ? (
          <button
            type="button"
            onClick={onApplyToAll}
            className="inline-flex items-center gap-1.5 text-dashboard-action font-semibold text-primary transition-colors hover:text-primary-light"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Apply these preferences to all remaining photos
          </button>
        ) : null}

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

      <ExampleDialog
        open={showAerialInfo}
        onOpenChange={setShowAerialInfo}
        title={
          data.aerialEditing === AERIAL_EDITING_DEFAULT
            ? "Aerial Editing"
            : selectedAerial.label
        }
        description={
          aerialMedia?.description?.trim() ||
          (data.aerialEditing === AERIAL_EDITING_DEFAULT
            ? AERIAL_EDITING_OPTIONS.filter(
                (option) => option.id !== AERIAL_EDITING_DEFAULT,
              )
                .map((option) => `${option.label}: ${option.description}`)
                .join(" • ")
            : selectedAerial.description)
        }
        media={aerialMedia}
      />
    </div>
  );
}
