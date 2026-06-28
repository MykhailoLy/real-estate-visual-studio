import { z } from "zod";
import {
  currencyForRegion,
  DEFAULT_REGION,
  isRegionCode,
  type RegionCode,
} from "../currency.ts";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import type { TransactionalCurrency } from "../pricing/types.ts";
import { createDraftClientItemId } from "./utils.ts";
import { stableStringifyJson } from "./serialization.ts";
import type {
  CreateOrderDraftInput,
  JsonObject,
  OrderDraftRow,
  PricingPreview,
  UpdateOrderDraftInput,
} from "./types.ts";

export const VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION = 1;
export const VIRTUAL_STAGING_DRAFT_ROUTE =
  "/dashboard/orders/new/virtual-staging";
export const VIRTUAL_STAGING_DRAFT_CURRENT_STEP = "virtual-staging-form";

const STRING_FIELD_MAX = 5000;

export type VirtualStagingAutosaveStatus =
  | "not_saved"
  | "saving"
  | "saved"
  | "save_failed"
  | "conflict";

export type VirtualStagingRequiredFieldKind =
  | "job-title"
  | "original"
  | "room"
  | "furniture-style"
  | "terms";

export interface VirtualStagingRequiredFieldInput {
  jobTitleValid: boolean;
  termsAccepted: boolean;
  items: Array<{
    clientItemId: string;
    hasOriginal: boolean;
    roomName: string;
    furnitureStyle: string;
  }>;
}

export interface MissingVirtualStagingRequiredField {
  kind: VirtualStagingRequiredFieldKind;
  itemIndex: number | null;
  clientItemId: string | null;
}

export interface VirtualStagingDraftFileMetadata {
  originalFilename: string | null;
  referenceFilename: string | null;
}

export interface VirtualStagingDraftItemState
  extends JsonObject,
    VirtualStagingDraftFileMetadata {
  roomName: string;
  furnitureStyle: string;
  fileSizeLimit: string;
  disclaimerText: string;
  referenceLink: string;
  additionalInfo: string;
  selectedAddons: string[];
}

export interface VirtualStagingDraftItem {
  clientItemId: string;
  state: VirtualStagingDraftItemState;
}

export interface VirtualStagingDraftTermsUi extends JsonObject {
  accepted: boolean;
  allowPortfolio: boolean;
}

export interface VirtualStagingDraftMetadata extends JsonObject {
  service: "virtual-staging";
}

export interface VirtualStagingDraftItemEnvelope extends JsonObject {
  clientItemId: string;
  state: VirtualStagingDraftItemState;
}

export interface VirtualStagingDraftState extends JsonObject {
  schemaVersion: typeof VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION;
  jobTitle: string;
  currentStep: typeof VIRTUAL_STAGING_DRAFT_CURRENT_STEP;
  items: VirtualStagingDraftItemEnvelope[];
  termsUi: VirtualStagingDraftTermsUi;
  metadata: VirtualStagingDraftMetadata;
}

export interface VirtualStagingFormItemDraftSource {
  clientItemId?: string;
  file?: { name?: string } | null;
  roomName: string;
  furnitureStyle: string;
  fileSizeLimit: string;
  disclaimerText: string;
  referenceLink: string;
  referenceFile?: { name?: string } | null;
  additionalInfo: string;
  selectedAddons: string[];
  originalFilename?: string | null;
  referenceFilename?: string | null;
  needsOriginalFileReselection?: boolean;
}

export interface VirtualStagingResumedFormItem {
  clientItemId: string;
  file: null;
  roomName: string;
  furnitureStyle: string;
  fileSizeLimit: string;
  disclaimerText: string;
  referenceLink: string;
  referenceFile: null;
  additionalInfo: string;
  selectedAddons: string[];
  originalFilename: string | null;
  referenceFilename: string | null;
  needsOriginalFileReselection: boolean;
}

export interface VirtualStagingFormDraftSource {
  jobTitle: string;
  items: VirtualStagingFormItemDraftSource[];
  orderTerms: {
    accepted: boolean;
    allowPortfolio: boolean;
  };
  currency: TransactionalCurrency;
  region?: RegionCode | null;
}

export interface VirtualStagingResumeResult {
  ok: true;
  state: VirtualStagingDraftState;
  form: {
    jobTitle: string;
    items: VirtualStagingResumedFormItem[];
    orderTerms: {
      accepted: boolean;
      allowPortfolio: boolean;
    };
  };
  version: number;
}

export type VirtualStagingResumeErrorCode =
  | "wrong_service"
  | "wrong_route"
  | "unsupported_schema"
  | "invalid_state";

export type VirtualStagingResumeValidation =
  | VirtualStagingResumeResult
  | { ok: false; code: VirtualStagingResumeErrorCode; message: string };

export type VirtualStagingSaveMethod = "create" | "patch";

export interface VirtualStagingDraftIdentity {
  draftId: string | null;
  draftVersion: number | null;
  savedFingerprint: string | null;
  failedAutosaveFingerprint: string | null;
  saveStatus: VirtualStagingAutosaveStatus;
  conflictMessage: string;
  resumeState: "ready";
}

export interface VirtualStagingResetResult {
  identity: VirtualStagingDraftIdentity;
  nextSearch: string;
}

const DraftItemStateSchema = z
  .object({
    roomName: z.string().max(200).default(""),
    furnitureStyle: z.string().max(200).default(""),
    fileSizeLimit: z.string().max(200).default(""),
    disclaimerText: z.string().max(STRING_FIELD_MAX).default(""),
    referenceLink: z.string().max(STRING_FIELD_MAX).default(""),
    additionalInfo: z.string().max(STRING_FIELD_MAX).default(""),
    selectedAddons: z.array(z.string().min(1).max(100)).default([]),
    originalFilename: z.string().min(1).max(255).nullable().default(null),
    referenceFilename: z.string().min(1).max(255).nullable().default(null),
  })
  .strict();

export const VirtualStagingDraftStateSchema = z
  .object({
    schemaVersion: z.literal(VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION),
    jobTitle: z.string().max(120).default(""),
    currentStep: z.literal(VIRTUAL_STAGING_DRAFT_CURRENT_STEP),
    items: z
      .array(
        z
          .object({
            clientItemId: z.uuid(),
            state: DraftItemStateSchema,
          })
          .strict(),
      )
      .min(1)
      .max(50),
    termsUi: z
      .object({
        accepted: z.boolean().default(false),
        allowPortfolio: z.boolean().default(false),
      })
      .strict(),
    metadata: z
      .object({
        service: z.literal("virtual-staging"),
      })
      .strict(),
  })
  .strict() satisfies z.ZodType<VirtualStagingDraftState>;

function trimString(value: string, max = STRING_FIELD_MAX): string {
  return value.trim().slice(0, max);
}

function fileNameFromValue(value: { name?: string } | null | undefined): string | null {
  const name = value?.name?.trim();
  return name ? name.slice(0, 255) : null;
}

export function ensureVirtualStagingClientItemId(
  item: VirtualStagingFormItemDraftSource,
): string {
  return item.clientItemId ?? createDraftClientItemId();
}

export function mapVirtualStagingFormToDraftState(
  source: VirtualStagingFormDraftSource,
): VirtualStagingDraftState {
  return {
    schemaVersion: VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION,
    jobTitle: trimString(source.jobTitle, 120),
    currentStep: VIRTUAL_STAGING_DRAFT_CURRENT_STEP,
    termsUi: {
      accepted: source.orderTerms.accepted === true,
      allowPortfolio: source.orderTerms.allowPortfolio === true,
    },
    metadata: {
      service: "virtual-staging",
    },
    items: source.items.map((item) => ({
      clientItemId: ensureVirtualStagingClientItemId(item),
      state: {
        roomName: trimString(item.roomName, 200),
        furnitureStyle: trimString(item.furnitureStyle, 200),
        fileSizeLimit: trimString(item.fileSizeLimit, 200),
        disclaimerText: trimString(item.disclaimerText),
        referenceLink: trimString(item.referenceLink),
        additionalInfo: trimString(item.additionalInfo),
        selectedAddons: [...item.selectedAddons],
        originalFilename:
          fileNameFromValue(item.file) ?? item.originalFilename?.trim() ?? null,
        referenceFilename:
          fileNameFromValue(item.referenceFile) ??
          item.referenceFilename?.trim() ??
          null,
      },
    })),
  };
}

export function buildVirtualStagingDraftFingerprint(
  source: VirtualStagingFormDraftSource,
): string {
  return stableStringifyJson({
    state: mapVirtualStagingFormToDraftState(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  });
}

export function mapVirtualStagingDraftToFormState(
  state: unknown,
): VirtualStagingResumeResult["form"] {
  const parsed = VirtualStagingDraftStateSchema.parse(state);
  return {
    jobTitle: parsed.jobTitle,
    orderTerms: {
      accepted: parsed.termsUi.accepted,
      allowPortfolio: parsed.termsUi.allowPortfolio,
    },
    items: parsed.items.map((item) => ({
      clientItemId: item.clientItemId,
      file: null,
      roomName: item.state.roomName,
      furnitureStyle: item.state.furnitureStyle,
      fileSizeLimit: item.state.fileSizeLimit,
      disclaimerText: item.state.disclaimerText,
      referenceLink: item.state.referenceLink,
      referenceFile: null,
      additionalInfo: item.state.additionalInfo,
      selectedAddons: [...item.state.selectedAddons],
      originalFilename: item.state.originalFilename,
      referenceFilename: item.state.referenceFilename,
      needsOriginalFileReselection: false,
    })),
  };
}

export function hasMeaningfulVirtualStagingDraftChange(
  source: VirtualStagingFormDraftSource,
): boolean {
  if (source.jobTitle.trim().length > 0) return true;
  if (source.orderTerms.accepted || source.orderTerms.allowPortfolio) return true;
  return source.items.some((item) => {
    return (
      item.file != null ||
      item.referenceFile != null ||
      item.roomName.trim() !== "" ||
      item.furnitureStyle.trim() !== "" ||
      item.fileSizeLimit.trim() !== "" ||
      item.disclaimerText.trim() !== "" ||
      item.referenceLink.trim() !== "" ||
      item.additionalInfo.trim() !== "" ||
      item.selectedAddons.length > 0 ||
      item.originalFilename != null ||
      item.referenceFilename != null
    );
  });
}

export function findMissingVirtualStagingRequiredFields(
  input: VirtualStagingRequiredFieldInput,
): MissingVirtualStagingRequiredField[] {
  const missing: MissingVirtualStagingRequiredField[] = [];

  if (!input.jobTitleValid) {
    missing.push({
      kind: "job-title",
      itemIndex: null,
      clientItemId: null,
    });
  }

  input.items.forEach((item, itemIndex) => {
    if (!item.hasOriginal) {
      missing.push({
        kind: "original",
        itemIndex,
        clientItemId: item.clientItemId,
      });
    }
    if (item.roomName.trim() === "") {
      missing.push({
        kind: "room",
        itemIndex,
        clientItemId: item.clientItemId,
      });
    }
    if (item.furnitureStyle.trim() === "") {
      missing.push({
        kind: "furniture-style",
        itemIndex,
        clientItemId: item.clientItemId,
      });
    }
  });

  if (!input.termsAccepted) {
    missing.push({
      kind: "terms",
      itemIndex: null,
      clientItemId: null,
    });
  }

  return missing;
}

export function buildVirtualStagingPricingPreview(
  source: Pick<VirtualStagingFormDraftSource, "items" | "currency">,
): PricingPreview | null {
  try {
    const quote = calculateOrderQuote({
      serviceType: "virtual-staging",
      currency: source.currency,
      items: source.items.map((item) => ({
        selectedAddons: item.selectedAddons,
      })),
    });
    return {
      nonAuthoritative: true,
      preview: {
        pricingVersion: quote.pricingVersion,
        currency: quote.currency,
        totalCents: quote.totalCents,
        customQuote: quote.customQuote,
        itemCount: quote.items.length,
      },
    };
  } catch {
    return null;
  }
}

export function buildVirtualStagingCreateDraftInput(
  source: VirtualStagingFormDraftSource,
): CreateOrderDraftInput<VirtualStagingDraftState> {
  const state = mapVirtualStagingFormToDraftState(source);
  return {
    serviceType: "virtual-staging",
    route: VIRTUAL_STAGING_DRAFT_ROUTE,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildVirtualStagingPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function buildVirtualStagingUpdateDraftInput(
  source: VirtualStagingFormDraftSource,
  expectedVersion: number,
): UpdateOrderDraftInput<VirtualStagingDraftState> {
  const state = mapVirtualStagingFormToDraftState(source);
  return {
    expectedVersion,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildVirtualStagingPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function selectVirtualStagingSaveMethod(
  draftId: string | null,
): VirtualStagingSaveMethod {
  return draftId ? "patch" : "create";
}

export function shouldSkipDuplicateVirtualStagingSave(
  previousSerialized: string | null,
  nextFingerprint: string,
): boolean {
  return previousSerialized === nextFingerprint;
}

export function shouldSkipFailedVirtualStagingAutosave(
  failedFingerprint: string | null,
  nextFingerprint: string,
  force: boolean,
): boolean {
  return !force && failedFingerprint === nextFingerprint;
}

export function markVirtualStagingSaveSuccess(
  currentVersion: number | null,
  nextVersion: number,
): { version: number; status: Extract<VirtualStagingAutosaveStatus, "saved"> } {
  void currentVersion;
  return { version: nextVersion, status: "saved" };
}

export function markVirtualStagingSaveConflict(): {
  status: Extract<VirtualStagingAutosaveStatus, "conflict">;
  canRetryAutomatically: false;
} {
  return { status: "conflict", canRetryAutomatically: false };
}

export function shouldApplyVirtualStagingSaveResult(
  startedSession: number,
  currentSession: number,
): boolean {
  return startedSession === currentSession;
}

export function resetVirtualStagingDraftIdentity(
  currentSearch: string,
): VirtualStagingResetResult {
  const next = new URLSearchParams(currentSearch);
  next.delete("draft");
  return {
    identity: {
      draftId: null,
      draftVersion: null,
      savedFingerprint: null,
      failedAutosaveFingerprint: null,
      saveStatus: "not_saved",
      conflictMessage: "",
      resumeState: "ready",
    },
    nextSearch: next.toString(),
  };
}

export function updateOriginalFileDraftMetadata<T extends {
  originalFilename: string | null;
  needsOriginalFileReselection: boolean;
}>(
  item: T,
  file: { name?: string } | null,
): Pick<T, "originalFilename" | "needsOriginalFileReselection"> {
  void item;
  return {
    originalFilename: fileNameFromValue(file),
    needsOriginalFileReselection: false,
  };
}

export function updateReferenceFileDraftMetadata<T extends {
  referenceFilename: string | null;
}>(
  item: T,
  file: { name?: string } | null,
): Pick<T, "referenceFilename"> {
  void item;
  return {
    referenceFilename: fileNameFromValue(file),
  };
}

export function shouldShowVirtualStagingResumedFileWarning(
  items: Array<{ needsOriginalFileReselection?: boolean; file?: unknown | null }>,
): boolean {
  void items;
  return false;
}

export function shouldShowVirtualStagingSavedImagesNotice(
  uploadedFileCount: number,
): boolean {
  return uploadedFileCount > 0;
}

export function isVirtualStagingFinalSubmissionReady(
  items: Array<{ file: File | null; uploadedOriginal?: unknown | null }>,
): boolean {
  return items.length > 0 && items.every(
    (item) => item.file !== null || item.uploadedOriginal != null,
  );
}

export function validateVirtualStagingDraftForResume(
  draft: Pick<
    OrderDraftRow,
    "serviceType" | "route" | "state" | "stateSchemaVersion" | "version"
  >,
): VirtualStagingResumeValidation {
  if (draft.serviceType !== "virtual-staging") {
    return {
      ok: false,
      code: "wrong_service",
      message: "This draft is not a Virtual Staging draft.",
    };
  }
  if (draft.route !== VIRTUAL_STAGING_DRAFT_ROUTE) {
    return {
      ok: false,
      code: "wrong_route",
      message: "This draft belongs to a different order route.",
    };
  }
  if (draft.stateSchemaVersion !== VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "unsupported_schema",
      message: "This draft version is no longer supported.",
    };
  }

  const parsed = VirtualStagingDraftStateSchema.safeParse(draft.state);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_state",
      message: "This draft could not be restored safely.",
    };
  }

  return {
    ok: true,
    state: parsed.data,
    form: mapVirtualStagingDraftToFormState(parsed.data),
    version: draft.version,
  };
}

function regionForCurrency(currency: TransactionalCurrency): RegionCode {
  const region =
    currency === "CAD" ? "CA" : currency === "EUR" ? "EU" : DEFAULT_REGION;
  return isRegionCode(region) ? region : DEFAULT_REGION;
}

export function resolveVirtualStagingDraftRegion(
  draft: Pick<OrderDraftRow, "currency" | "region">,
): RegionCode {
  if (
    draft.region &&
    isRegionCode(draft.region) &&
    currencyForRegion(draft.region) === draft.currency
  ) {
    return draft.region;
  }
  return regionForCurrency(draft.currency);
}

export function currencyForDraftRegion(region: RegionCode | null): TransactionalCurrency {
  return currencyForRegion(region ?? DEFAULT_REGION);
}
