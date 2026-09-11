"use client";

import { useState } from "react";
import { Info, Trash2 } from "lucide-react";
import ExampleDialog from "@/components/order/ExampleDialog";
import FileUpload, {
  hasFileUploadPreview,
} from "@/components/order/FileUpload";
import ItemSubtotal from "@/components/order/ItemSubtotal";
import ReferenceFilesUploader from "@/components/order/ReferenceFilesUploader";
import StyleSelector, {
  type VisualStyleCard,
} from "@/components/order/virtual-staging/StyleSelector";
import ItemDeliveryFields, {
  emptyItemDeliveryFields,
} from "@/components/order/ItemDeliveryFields";
import {
  RegionalCentsText,
  useDisplayCurrency,
} from "@/components/pricing/currency-client";
import { calculateRenovationItemTotal } from "@/lib/pricing";
import { getCatalogPrice } from "@/lib/pricing/catalog";
import {
  RENOVATION_INTERNAL_OPTIONS,
  RENOVATION_EXTERNAL_OPTIONS,
  RENOVATION_ROOM_OPTIONS,
  RENOVATION_STYLE_OPTIONS,
  STAGING_STYLE_CARDS,
  STAGING_FILE_ACCEPT,
  type RenovationOption,
} from "@/data/order-options";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import { createDraftClientItemId } from "@/lib/order-drafts/utils";
import type { ServiceOptionMedia } from "@/lib/site-media";
import type { TransactionalCurrency } from "@/lib/pricing/types";
import OrderImageCardHeader from "@/components/order/OrderImageCardHeader";
import OrderImageWorkspace from "@/components/order/OrderImageWorkspace";
import {
  mergeReferenceFiles,
  resolveReferenceFileSelection,
  type ReferenceFileValue,
} from "@/lib/reference-files";

export interface RenovationItemData {
  clientItemId: string;
  file: File | null;
  selectedInternal: string[];
  selectedExternal: string[];
  room: string;
  presentationStyle: string;
  /** Per-item file size limit (one of FILE_SIZE_LIMIT_OPTIONS or "") */
  fileSizeLimit: string;
  /** Per-item optional disclaimer text */
  disclaimerText: string;
  referenceLink: string;
  referenceFiles: ReferenceFileValue[];
  /** Legacy singular draft shape retained for backward restoration. */
  referenceFile: File | null;
  additionalInfo: string;
  originalFilename: string | null;
  referenceFilename: string | null;
}

export const emptyRenovationItem = (): RenovationItemData => ({
  clientItemId: createDraftClientItemId(),
  file: null,
  selectedInternal: [],
  selectedExternal: [],
  room: "",
  presentationStyle: "",
  ...emptyItemDeliveryFields,
  referenceLink: "",
  referenceFiles: [],
  referenceFile: null,
  additionalInfo: "",
  originalFilename: null,
  referenceFilename: null,
});

export function renovationItemDomId(clientItemId: string): string {
  return `virtual-renovation-item-${clientItemId}`;
}

const RENOVATION_VISUAL_STYLE_CARDS: VisualStyleCard[] =
  RENOVATION_STYLE_OPTIONS.map((label) => {
    const stagingCard = STAGING_STYLE_CARDS.find(
      (candidate) => candidate.label === label,
    );
    if (stagingCard) return stagingCard;
    const descriptions: Record<string, string> = {
      Commercial:
        "A practical commercial direction for offices, retail, hospitality or shared spaces.",
      "Match Reference":
        "Use the supplied reference files or link as the primary design direction.",
      "Let Us Decide":
        "Let the PicchuSpot team choose a cohesive direction suited to the property.",
    };
    return {
      label,
      imageSrc: null,
      mediaKey: null,
      description: descriptions[label] ?? label,
    };
  });

interface RenovationItemCardProps {
  index: number;
  totalItems: number;
  data: RenovationItemData;
  onChange: (data: RenovationItemData) => void;
  onRemove: () => void;
  canRemove: boolean;
  persistedOriginal?: OrderDraftUploadedFileSummary | null;
  persistedReference?: OrderDraftUploadedFileSummary | null;
  onOriginalFileChange: (file: File | null) => void;
  onReferenceFilesChange: (files: ReferenceFileValue[]) => void;
  onRemovePersistedOriginal: () => void;
  onRemovePersistedReference: () => void;
  originalOperationStatus?: string;
  originalOperationError?: string;
  referenceOperationStatus?: string;
  referenceOperationError?: string;
  onRetryOriginal?: () => void;
  fileOperationDisabled?: boolean;
  exampleMediaByKey: Record<string, ServiceOptionMedia>;
}

export default function RenovationItemCard({
  index,
  totalItems,
  data,
  onChange,
  onRemove,
  canRemove,
  persistedOriginal,
  persistedReference,
  onOriginalFileChange,
  onReferenceFilesChange,
  onRemovePersistedOriginal,
  onRemovePersistedReference,
  originalOperationStatus,
  originalOperationError,
  referenceOperationStatus,
  referenceOperationError,
  onRetryOriginal,
  fileOperationDisabled = false,
  exampleMediaByKey,
}: RenovationItemCardProps) {
  const currency = useDisplayCurrency();
  const [previewOptionId, setPreviewOptionId] = useState<string | null>(null);
  const itemIdPrefix = `renovation-item-${data.clientItemId}`;
  const toggleInternal = (id: string) => {
    const updated = data.selectedInternal.includes(id)
      ? data.selectedInternal.filter((x) => x !== id)
      : [...data.selectedInternal, id];
    onChange({ ...data, selectedInternal: updated });
  };

  const toggleExternal = (id: string) => {
    const updated = data.selectedExternal.includes(id)
      ? data.selectedExternal.filter((x) => x !== id)
      : [...data.selectedExternal, id];
    onChange({ ...data, selectedExternal: updated });
  };

  const subtotal = calculateRenovationItemTotal(
    data.selectedInternal,
    data.selectedExternal,
    currency,
  );
  const previewOption = [
    ...RENOVATION_INTERNAL_OPTIONS,
    ...RENOVATION_EXTERNAL_OPTIONS,
  ].find((option) => option.id === previewOptionId);
  const previewMedia = previewOption
    ? (exampleMediaByKey[previewOption.mediaKey] ?? null)
    : null;
  const displayedReferenceFiles = mergeReferenceFiles(
    data.referenceFiles,
    persistedReference
      ? [
          {
            id: persistedReference.id,
            file: null,
            filename: persistedReference.originalFilename,
            fileSize: persistedReference.fileSize,
            mimeType: persistedReference.mimeType,
            lastModified: null,
            previewUrl: persistedReference.previewUrl,
            previewExpiresAt: persistedReference.previewExpiresAt,
            draftFileId: persistedReference.id,
          },
        ]
      : [],
  );
  const persistedOriginalDisplay = persistedOriginal
    ? {
        id: persistedOriginal.id,
        filename: persistedOriginal.originalFilename,
        fileSize: persistedOriginal.fileSize,
        previewUrl: persistedOriginal.previewUrl ?? null,
        previewExpiresAt: persistedOriginal.previewExpiresAt ?? null,
      }
    : null;

  return (
    <>
      <article
        id={renovationItemDomId(data.clientItemId)}
        className="@container scroll-mt-20 rounded-2xl border border-border bg-white p-4 shadow-sm sm:scroll-mt-24 sm:p-5"
      >
        <OrderImageCardHeader
          index={index}
          totalItems={totalItems}
          action={
            canRemove ? (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md p-2.5 text-muted transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`Remove image ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : null
          }
        />

        <OrderImageWorkspace
          hasPreview={hasFileUploadPreview(data.file, persistedOriginalDisplay)}
          media={
            <FileUpload
              viewerVariant="photo"
              label="Upload Original Photo"
              file={data.file}
              onFileChange={onOriginalFileChange}
              accept={STAGING_FILE_ACCEPT}
              required
              persistedFile={persistedOriginalDisplay}
              operationStatusText={originalOperationStatus}
              operationErrorText={originalOperationError}
              onRetry={onRetryOriginal}
              onRemovePersisted={onRemovePersistedOriginal}
              disabled={fileOperationDisabled}
              retryDisabled={fileOperationDisabled}
              removeDisabled={fileOperationDisabled}
              presentationVariant="workspace"
              comfortable
            />
          }
        >
          <div className="space-y-5">
            <section
              aria-labelledby={`${itemIdPrefix}-selection-title`}
              className="border-t border-border pt-5"
            >
              <h3
                id={`${itemIdPrefix}-selection-title`}
                className="text-base font-semibold uppercase tracking-[0.08em] text-primary"
              >
                Renovation Selection
              </h3>

              <div className="mt-4 grid gap-5 @min-[42rem]:grid-cols-2 @min-[42rem]:gap-6">
                <RenovationOptionGroup
                  title="Internal Renovations"
                  options={RENOVATION_INTERNAL_OPTIONS}
                  selectedIds={data.selectedInternal}
                  onToggle={toggleInternal}
                  onPreview={setPreviewOptionId}
                  currency={currency}
                />

                <RenovationOptionGroup
                  title="External Renovations"
                  options={RENOVATION_EXTERNAL_OPTIONS}
                  selectedIds={data.selectedExternal}
                  onToggle={toggleExternal}
                  onPreview={setPreviewOptionId}
                  currency={currency}
                />
              </div>
            </section>

            <section
              aria-labelledby={`${itemIdPrefix}-details-title`}
              className="border-t border-border pt-5"
            >
              <h3
                id={`${itemIdPrefix}-details-title`}
                className="text-base font-semibold uppercase tracking-[0.08em] text-primary"
              >
                Renovation Details
              </h3>

              <div className="mt-4 space-y-5">
                <div className="max-w-xl">
                  <label
                    htmlFor={`${itemIdPrefix}-room`}
                    className="mb-2 block text-base font-medium text-foreground"
                  >
                    Room / Area <span className="text-red-500">*</span>
                  </label>
                  <select
                    id={`${itemIdPrefix}-room`}
                    value={data.room}
                    onChange={(e) =>
                      onChange({ ...data, room: e.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select room...</option>
                    {RENOVATION_ROOM_OPTIONS.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p
                    id={`${itemIdPrefix}-presentation-style-label`}
                    className="text-base font-medium text-foreground"
                  >
                    Presentation Style / Choose a Style
                  </p>
                  <p
                    id={`${itemIdPrefix}-presentation-style-helper`}
                    className="mb-3 mt-1 text-sm leading-5 text-muted"
                  >
                    Choose a direction, match your references, or let us decide.
                  </p>
                  <StyleSelector
                    value={data.presentationStyle}
                    onChange={(presentationStyle) =>
                      onChange({ ...data, presentationStyle })
                    }
                    mediaByKey={exampleMediaByKey}
                    cards={RENOVATION_VISUAL_STYLE_CARDS}
                    groupName={`${itemIdPrefix}-presentation-style`}
                    ariaLabelledBy={`${itemIdPrefix}-presentation-style-label`}
                    ariaDescribedBy={`${itemIdPrefix}-presentation-style-helper`}
                    compact
                    previewTitle={(card) => `${card.label} renovation style`}
                    imageAlt={(card) =>
                      `${card.label} renovation style example`
                    }
                  />
                  {data.presentationStyle ? (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ ...data, presentationStyle: "" })
                      }
                      className="mt-2 min-h-10 rounded-md px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    >
                      Clear style selection
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Per-item delivery preferences (File Size Limit + Disclaimer Text) */}
              <div className="mt-5 border-t border-border pt-4">
                <h4 className="mb-4 text-[15px] font-semibold text-foreground">
                  Delivery Preferences
                </h4>
                <ItemDeliveryFields
                  idPrefix={itemIdPrefix}
                  data={{
                    fileSizeLimit: data.fileSizeLimit,
                    disclaimerText: data.disclaimerText,
                  }}
                  onChange={(prefs) => onChange({ ...data, ...prefs })}
                  layoutVariant="desktop-columns"
                  comfortable
                />
              </div>
            </section>

            <section
              aria-labelledby={`${itemIdPrefix}-references-title`}
              className="border-t border-border pt-5"
            >
              <h3
                id={`${itemIdPrefix}-references-title`}
                className="text-base font-semibold uppercase tracking-[0.08em] text-primary"
              >
                References
              </h3>

              <div className="mt-4 space-y-4">
                {/* Reference Link */}
                <div>
                  <label
                    htmlFor={`${itemIdPrefix}-reference-link`}
                    className="mb-2 block text-base font-medium text-foreground"
                  >
                    Reference Link (optional)
                  </label>
                  <input
                    id={`${itemIdPrefix}-reference-link`}
                    type="url"
                    value={data.referenceLink}
                    onChange={(e) =>
                      onChange({ ...data, referenceLink: e.target.value })
                    }
                    placeholder="https://example.com/inspiration"
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <ReferenceFilesUploader
                  files={displayedReferenceFiles}
                  onChange={(files) => {
                    const selection = resolveReferenceFileSelection(
                      files,
                      data.referenceFiles,
                      persistedReference,
                    );
                    if (selection.removeLegacy) onRemovePersistedReference();
                    onReferenceFilesChange(selection.references);
                  }}
                  disabled={fileOperationDisabled}
                  operationStatus={referenceOperationStatus}
                />
                {referenceOperationError ? (
                  <p className="text-sm font-medium text-red-700" role="alert">
                    {referenceOperationError}
                  </p>
                ) : null}
              </div>
            </section>

            {/* Additional Info */}
            <div className="border-t border-border pt-5">
              <label
                htmlFor={`${itemIdPrefix}-additional-information`}
                className="mb-2 block text-base font-medium text-foreground"
              >
                Additional Information
              </label>
              <textarea
                id={`${itemIdPrefix}-additional-information`}
                value={data.additionalInfo}
                onChange={(e) =>
                  onChange({ ...data, additionalInfo: e.target.value })
                }
                placeholder="Describe any specific renovation details..."
                rows={3}
                className="w-full resize-y rounded-lg border border-border px-3 py-2.5 text-base leading-6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Subtotal */}
            <ItemSubtotal totalCents={subtotal} />
          </div>
        </OrderImageWorkspace>
      </article>

      {previewOption ? (
        <ExampleDialog
          open={Boolean(previewOptionId)}
          onOpenChange={(open) => {
            if (!open) setPreviewOptionId(null);
          }}
          title={previewOption.label}
          description={
            previewMedia?.description?.trim() || previewOption.description
          }
          media={previewMedia}
          showMissingMediaPlaceholder
        />
      ) : null}
    </>
  );
}

function RenovationOptionGroup({
  title,
  options,
  selectedIds,
  onToggle,
  onPreview,
  currency,
}: {
  title: string;
  options: RenovationOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onPreview: (id: string) => void;
  currency: TransactionalCurrency;
}) {
  return (
    <div className="min-w-0">
      <h4 className="text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
        {title}
      </h4>
      <div className="mt-2 grid gap-1.5">
        {options.map((option) => {
          const selected = selectedIds.includes(option.id);
          return (
            <div
              key={option.id}
              className={`grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md border px-2 py-0.5 transition-colors focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-1 ${
                selected
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:border-primary/30 hover:bg-surface"
              }`}
            >
              <label className="grid min-h-10 min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(option.id)}
                  className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
                />
                <span className="min-w-0 text-sm leading-5 text-foreground">
                  {option.label}
                </span>
                <span className="whitespace-nowrap text-sm font-medium text-foreground/75">
                  <RegionalCentsText
                    cents={getCatalogPrice(option.priceKey, currency)}
                  />
                </span>
              </label>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onPreview(option.id)}
                  aria-label={`View ${option.label} information and example`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
