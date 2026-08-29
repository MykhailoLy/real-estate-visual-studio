import { z } from "zod";
import {
  currencyForRegion,
  DEFAULT_REGION,
  isRegionCode,
  type RegionCode,
} from "../currency.ts";
import { PHOTO_EDIT_OPTION_IDS } from "../pricing/catalog.ts";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import type { TransactionalCurrency } from "../pricing/types.ts";
import { stableStringifyJson } from "./serialization.ts";
import { createDraftClientItemId } from "./utils.ts";
import type {
  CreateOrderDraftInput,
  JsonObject,
  OrderDraftRow,
  PricingPreview,
  UpdateOrderDraftInput,
} from "./types.ts";

export const PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION = 1;
export const PHOTO_EDITING_DRAFT_ROUTE =
  "/dashboard/orders/new/photo-editing";
export const PHOTO_EDITING_DRAFT_STEP = "configure";

export type PhotoEditingAutosaveStatus =
  | "not_saved"
  | "saving"
  | "saved"
  | "save_failed"
  | "conflict";

export interface PhotoEditingDraftItemState extends JsonObject {
  selectedOptions: string[];
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  originalFilename: string | null;
}

export interface PhotoEditingDraftItemEnvelope extends JsonObject {
  clientItemId: string;
  state: PhotoEditingDraftItemState;
}

export interface PhotoEditingDraftState extends JsonObject {
  schemaVersion: typeof PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION;
  jobTitle: string;
  currentStep: typeof PHOTO_EDITING_DRAFT_STEP;
  items: PhotoEditingDraftItemEnvelope[];
  termsUi: {
    accepted: boolean;
    earlyPerformanceRequested: boolean;
    allowPortfolio: boolean;
  } & JsonObject;
  metadata: { service: "photo-editing" } & JsonObject;
}

export interface PhotoEditingFormItemDraftSource {
  clientItemId?: string;
  file?: { name?: string } | null;
  selectedOptions: string[];
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  originalFilename?: string | null;
}

export interface PhotoEditingFormDraftSource {
  jobTitle: string;
  items: PhotoEditingFormItemDraftSource[];
  orderTerms: {
    accepted: boolean;
    earlyPerformanceRequested: boolean;
    allowPortfolio: boolean;
  };
  currency: TransactionalCurrency;
  region?: RegionCode | null;
}

export interface PhotoEditingResumedFormItem
  extends Omit<PhotoEditingFormItemDraftSource, "file"> {
  clientItemId: string;
  file: null;
  originalFilename: string | null;
}

const STRING_FIELD_MAX = 5000;
const PHOTO_EDIT_OPTION_VALUES = PHOTO_EDIT_OPTION_IDS as [string, ...string[]];

const PhotoEditingDraftItemStateSchema = z
  .object({
    selectedOptions: z.array(z.enum(PHOTO_EDIT_OPTION_VALUES)).max(
      PHOTO_EDIT_OPTION_IDS.length,
    ),
    fileSizeLimit: z.string().max(200).default(""),
    disclaimerText: z.string().max(STRING_FIELD_MAX).default(""),
    additionalInfo: z.string().max(STRING_FIELD_MAX).default(""),
    originalFilename: z.string().min(1).max(255).nullable().default(null),
  })
  .strict();

export const PhotoEditingDraftStateSchema = z
  .object({
    schemaVersion: z.literal(PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION),
    jobTitle: z.string().max(120).default(""),
    currentStep: z.literal(PHOTO_EDITING_DRAFT_STEP),
    items: z
      .array(
        z
          .object({
            clientItemId: z.uuid(),
            state: PhotoEditingDraftItemStateSchema,
          })
          .strict(),
      )
      .min(1)
      .max(50),
    termsUi: z
      .object({
        accepted: z.boolean().default(false),
        earlyPerformanceRequested: z.boolean().default(false),
        allowPortfolio: z.boolean().default(false),
      })
      .strict(),
    metadata: z.object({ service: z.literal("photo-editing") }).strict(),
  })
  .strict()
  .superRefine((state, context) => {
    const seen = new Set<string>();
    state.items.forEach((item, index) => {
      if (seen.has(item.clientItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "clientItemId"],
          message: "Photo Editing item IDs must be unique.",
        });
      }
      seen.add(item.clientItemId);
    });
  }) satisfies z.ZodType<PhotoEditingDraftState>;

function trim(value: string, max = STRING_FIELD_MAX): string {
  return value.trim().slice(0, max);
}

function filename(value: { name?: string } | null | undefined): string | null {
  const name = value?.name?.trim();
  return name ? name.slice(0, 255) : null;
}

function normalizeOptions(options: string[]): string[] {
  const allowed = new Set<string>(PHOTO_EDIT_OPTION_IDS);
  return Array.from(new Set(options.filter((option) => allowed.has(option))));
}

export function createPhotoEditingFormItem(): PhotoEditingResumedFormItem {
  return {
    clientItemId: createDraftClientItemId(),
    file: null,
    selectedOptions: [],
    fileSizeLimit: "",
    disclaimerText: "",
    additionalInfo: "",
    originalFilename: null,
  };
}

export function mapPhotoEditingFormToDraftState(
  source: PhotoEditingFormDraftSource,
): PhotoEditingDraftState {
  return {
    schemaVersion: PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION,
    jobTitle: trim(source.jobTitle, 120),
    currentStep: PHOTO_EDITING_DRAFT_STEP,
    items: source.items.map((item) => ({
      clientItemId: item.clientItemId ?? createDraftClientItemId(),
      state: {
        selectedOptions: normalizeOptions(item.selectedOptions),
        fileSizeLimit: trim(item.fileSizeLimit, 200),
        disclaimerText: trim(item.disclaimerText),
        additionalInfo: trim(item.additionalInfo),
        originalFilename:
          filename(item.file) ?? item.originalFilename?.trim() ?? null,
      },
    })),
    termsUi: {
      accepted: source.orderTerms.accepted === true,
      earlyPerformanceRequested:
        source.orderTerms.earlyPerformanceRequested === true,
      allowPortfolio: source.orderTerms.allowPortfolio === true,
    },
    metadata: { service: "photo-editing" },
  };
}

export function mapPhotoEditingDraftToFormState(state: unknown): {
  jobTitle: string;
  items: PhotoEditingResumedFormItem[];
  orderTerms: {
    accepted: boolean;
    earlyPerformanceRequested: boolean;
    allowPortfolio: boolean;
  };
} {
  const parsed = PhotoEditingDraftStateSchema.parse(state);
  return {
    jobTitle: parsed.jobTitle,
    items: parsed.items.map((item) => ({
      clientItemId: item.clientItemId,
      file: null,
      selectedOptions: [...item.state.selectedOptions],
      fileSizeLimit: item.state.fileSizeLimit,
      disclaimerText: item.state.disclaimerText,
      additionalInfo: item.state.additionalInfo,
      originalFilename: item.state.originalFilename,
    })),
    orderTerms: { ...parsed.termsUi },
  };
}

export function buildPhotoEditingDraftFingerprint(
  source: PhotoEditingFormDraftSource,
): string {
  return stableStringifyJson({
    state: mapPhotoEditingFormToDraftState(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  });
}

export function hasMeaningfulPhotoEditingDraftChange(
  source: PhotoEditingFormDraftSource,
): boolean {
  if (
    source.jobTitle.trim() ||
    source.orderTerms.accepted ||
    source.orderTerms.earlyPerformanceRequested ||
    source.orderTerms.allowPortfolio ||
    source.items.length > 1
  ) {
    return true;
  }
  return source.items.some(
    (item) =>
      item.file != null ||
      item.originalFilename != null ||
      item.selectedOptions.length > 0 ||
      item.fileSizeLimit.trim() !== "" ||
      item.disclaimerText.trim() !== "" ||
      item.additionalInfo.trim() !== "",
  );
}

export function buildPhotoEditingPricingPreview(
  source: Pick<PhotoEditingFormDraftSource, "items" | "currency">,
): PricingPreview | null {
  try {
    const quote = calculateOrderQuote({
      serviceType: "photo-editing",
      currency: source.currency,
      items: source.items.map((item) => ({
        selectedOptions: normalizeOptions(item.selectedOptions),
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

export function buildPhotoEditingCreateDraftInput(
  source: PhotoEditingFormDraftSource,
): CreateOrderDraftInput<PhotoEditingDraftState> {
  const state = mapPhotoEditingFormToDraftState(source);
  return {
    serviceType: "photo-editing",
    route: PHOTO_EDITING_DRAFT_ROUTE,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildPhotoEditingPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function buildPhotoEditingUpdateDraftInput(
  source: PhotoEditingFormDraftSource,
  expectedVersion: number,
): UpdateOrderDraftInput<PhotoEditingDraftState> {
  const state = mapPhotoEditingFormToDraftState(source);
  return {
    expectedVersion,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildPhotoEditingPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function validatePhotoEditingDraftForResume(
  draft: Pick<
    OrderDraftRow,
    | "serviceType"
    | "subService"
    | "route"
    | "state"
    | "stateSchemaVersion"
    | "version"
  >,
):
  | {
      ok: true;
      state: PhotoEditingDraftState;
      form: ReturnType<typeof mapPhotoEditingDraftToFormState>;
      version: number;
    }
  | { ok: false; message: string } {
  if (
    draft.serviceType !== "photo-editing" ||
    draft.subService !== null ||
    draft.route !== PHOTO_EDITING_DRAFT_ROUTE
  ) {
    return { ok: false, message: "This draft belongs to a different order form." };
  }
  if (draft.stateSchemaVersion !== PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION) {
    return { ok: false, message: "This draft version is no longer supported." };
  }
  const parsed = PhotoEditingDraftStateSchema.safeParse(draft.state);
  if (!parsed.success) {
    return { ok: false, message: "This draft could not be restored safely." };
  }
  return {
    ok: true,
    state: parsed.data,
    form: mapPhotoEditingDraftToFormState(parsed.data),
    version: draft.version,
  };
}

export function resolvePhotoEditingDraftRegion(
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

export function shouldApplyPhotoEditingAsyncResult(
  startedSession: number,
  currentSession: number,
  startedGeneration?: number,
  currentGeneration?: number,
): boolean {
  return (
    startedSession === currentSession &&
    (startedGeneration === undefined || startedGeneration === currentGeneration)
  );
}

export function resetPhotoEditingDraftIdentity(currentSearch: string): {
  nextSearch: string;
  draftId: null;
  draftVersion: null;
  saveStatus: "not_saved";
} {
  const next = new URLSearchParams(currentSearch);
  next.delete("draft");
  return {
    nextSearch: next.toString(),
    draftId: null,
    draftVersion: null,
    saveStatus: "not_saved",
  };
}

function regionForCurrency(currency: TransactionalCurrency): RegionCode {
  const region =
    currency === "CAD" ? "CA" : currency === "EUR" ? "EU" : DEFAULT_REGION;
  return isRegionCode(region) ? region : DEFAULT_REGION;
}
