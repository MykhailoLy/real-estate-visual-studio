import { z } from "zod";
import {
  AERIAL_EDITING_DEFAULT,
  AERIAL_EDITING_ID_VALUES,
  DAY_SKY_STYLE_DEFAULT,
  DAY_SKY_STYLE_ID_VALUES,
  SINGLE_EXPOSURE_SUB_SERVICE,
  THREE_STATE_DEFAULT,
  THREE_STATE_VALUES,
  getSingleExposureSelectedOptions,
  isAerialDetailRequirementSatisfied,
  isDaySkyStyleActive,
  normalizeSingleExposureStandardAddOns,
  type AerialEditingId,
  type DaySkyStyleId,
  type SingleExposureStandardAddOnId,
  type ThreeStateValue,
} from "../image-enhancement.ts";
import {
  currencyForRegion,
  DEFAULT_REGION,
  isRegionCode,
  type RegionCode,
} from "../currency.ts";
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
import type { ReferenceFileValue } from "../reference-files.ts";

export const SINGLE_EXPOSURE_DRAFT_STATE_SCHEMA_VERSION = 1;
export const SINGLE_EXPOSURE_DRAFT_ROUTE =
  "/dashboard/orders/new/image-enhancement/single-exposure";

export type SingleExposureFormStep = "configure" | "review";
export type SingleExposureAutosaveStatus =
  | "not_saved"
  | "saving"
  | "saved"
  | "save_failed"
  | "conflict";

export function buildSingleExposureDraftFileSlotKey(
  clientItemId: string,
  kind: "original" | "reference",
): string {
  return `${clientItemId}:${kind}`;
}

export interface SingleExposureDraftItemState extends JsonObject {
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  referenceLink: string;
  referenceFiles: Array<{
    id: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    lastModified: number | null;
  } & JsonObject>;
  grassRepair: ThreeStateValue;
  skyReplacement: ThreeStateValue;
  tvScreenReplacement: ThreeStateValue;
  addFireToFireplace: ThreeStateValue;
  daySkyStyle: DaySkyStyleId;
  selectedAddons: SingleExposureStandardAddOnId[];
  aerialEditing: AerialEditingId;
  aerialEditingInstructions: string;
  originalFilename: string | null;
  referenceFilename: string | null;
}

export interface SingleExposureDraftItemEnvelope extends JsonObject {
  clientItemId: string;
  state: SingleExposureDraftItemState;
}

export interface SingleExposureDraftState extends JsonObject {
  schemaVersion: typeof SINGLE_EXPOSURE_DRAFT_STATE_SCHEMA_VERSION;
  jobTitle: string;
  currentStep: SingleExposureFormStep;
  items: SingleExposureDraftItemEnvelope[];
  termsUi: { accepted: boolean; allowPortfolio: boolean } & JsonObject;
  metadata: {
    service: "image-enhancement-single-exposure";
  } & JsonObject;
}

export interface SingleExposureFormItemDraftSource {
  clientItemId?: string;
  file?: { name?: string } | null;
  referenceFile?: { name?: string } | null;
  referenceLink?: string;
  referenceFiles?: ReferenceFileValue[];
  aerialReferenceImage?: { name?: string } | null;
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  grassRepair: ThreeStateValue;
  skyReplacement: ThreeStateValue;
  tvScreenReplacement: ThreeStateValue;
  addFireToFireplace: ThreeStateValue;
  daySkyStyle: DaySkyStyleId;
  selectedAddons: SingleExposureStandardAddOnId[];
  aerialEditing: AerialEditingId;
  aerialEditingInstructions: string;
  originalFilename?: string | null;
  referenceFilename?: string | null;
}

export interface SingleExposureFormDraftSource {
  jobTitle: string;
  step: SingleExposureFormStep;
  items: SingleExposureFormItemDraftSource[];
  orderTerms: { accepted: boolean; allowPortfolio: boolean };
  currency: TransactionalCurrency;
  region?: RegionCode | null;
}

export interface SingleExposureResumedFormItem
  extends Omit<SingleExposureFormItemDraftSource, "file" | "referenceFile"> {
  clientItemId: string;
  file: null;
  referenceFile: null;
  referenceLink: string;
  referenceFiles: ReferenceFileValue[];
  originalFilename: string | null;
  referenceFilename: string | null;
}

const STRING_FIELD_MAX = 5000;

const DraftItemStateSchema = z
  .object({
    fileSizeLimit: z.string().max(200).default(""),
    disclaimerText: z.string().max(STRING_FIELD_MAX).default(""),
    additionalInfo: z.string().max(STRING_FIELD_MAX).default(""),
    referenceLink: z.string().max(STRING_FIELD_MAX).default(""),
    referenceFiles: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          filename: z.string().min(1).max(255),
          fileSize: z.number().int().min(0).max(20 * 1024 * 1024),
          mimeType: z.string().min(1).max(255),
          lastModified: z.number().int().nonnegative().nullable().default(null),
        }).strict(),
      )
      .max(10)
      .default([]),
    grassRepair: z.enum(THREE_STATE_VALUES).default(THREE_STATE_DEFAULT),
    skyReplacement: z.enum(THREE_STATE_VALUES).default(THREE_STATE_DEFAULT),
    tvScreenReplacement: z.enum(THREE_STATE_VALUES).default(THREE_STATE_DEFAULT),
    addFireToFireplace: z.enum(THREE_STATE_VALUES).default(THREE_STATE_DEFAULT),
    daySkyStyle: z.enum(DAY_SKY_STYLE_ID_VALUES).default(DAY_SKY_STYLE_DEFAULT),
    selectedAddons: z
      .array(
        z.enum([
          "item-removal-cleaning-pe",
          "shadow-removal",
          "turn-on-lights-pe",
          "colour-change-pe",
        ]),
      )
      .default([]),
    aerialEditing: z
      .enum(AERIAL_EDITING_ID_VALUES)
      .default(AERIAL_EDITING_DEFAULT),
    aerialEditingInstructions: z.string().max(STRING_FIELD_MAX).default(""),
    originalFilename: z.string().min(1).max(255).nullable().default(null),
    referenceFilename: z.string().min(1).max(255).nullable().default(null),
  })
  .strict();

export const SingleExposureDraftStateSchema = z
  .object({
    schemaVersion: z.literal(SINGLE_EXPOSURE_DRAFT_STATE_SCHEMA_VERSION),
    jobTitle: z.string().max(120).default(""),
    currentStep: z.enum(["configure", "review"]).default("configure"),
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
        service: z.literal("image-enhancement-single-exposure"),
      })
      .strict(),
  })
  .strict() satisfies z.ZodType<SingleExposureDraftState>;

function trim(value: string, max = STRING_FIELD_MAX): string {
  return value.trim().slice(0, max);
}

function filename(value: { name?: string } | null | undefined): string | null {
  const name = value?.name?.trim();
  return name ? name.slice(0, 255) : null;
}

export function ensureSingleExposureClientItemId(
  item: SingleExposureFormItemDraftSource,
): string {
  return item.clientItemId ?? createDraftClientItemId();
}

export function mapSingleExposureFormToDraftState(
  source: SingleExposureFormDraftSource,
): SingleExposureDraftState {
  return {
    schemaVersion: SINGLE_EXPOSURE_DRAFT_STATE_SCHEMA_VERSION,
    jobTitle: trim(source.jobTitle, 120),
    currentStep: source.step,
    termsUi: {
      accepted: source.orderTerms.accepted === true,
      allowPortfolio: source.orderTerms.allowPortfolio === true,
    },
    metadata: { service: "image-enhancement-single-exposure" },
    items: source.items.map((item) => ({
      clientItemId: ensureSingleExposureClientItemId(item),
      state: {
        fileSizeLimit: trim(item.fileSizeLimit, 200),
        disclaimerText: trim(item.disclaimerText),
        additionalInfo: trim(item.additionalInfo),
        referenceLink: trim(item.referenceLink ?? ""),
        referenceFiles: (item.referenceFiles ?? []).map((reference) => ({
          id: reference.id,
          filename: reference.filename,
          fileSize: reference.fileSize,
          mimeType: reference.mimeType,
          lastModified: reference.lastModified,
        })),
        grassRepair: item.grassRepair,
        skyReplacement: item.skyReplacement,
        tvScreenReplacement: item.tvScreenReplacement,
        addFireToFireplace: item.addFireToFireplace,
        daySkyStyle: item.daySkyStyle,
        selectedAddons: normalizeSingleExposureStandardAddOns(
          item.selectedAddons,
        ),
        aerialEditing: item.aerialEditing,
        aerialEditingInstructions: trim(item.aerialEditingInstructions),
        originalFilename:
          filename(item.file) ?? item.originalFilename?.trim() ?? null,
        referenceFilename:
          filename(item.referenceFile) ?? item.referenceFilename?.trim() ?? null,
      },
    })),
  };
}

export function mapSingleExposureDraftToFormState(state: unknown): {
  jobTitle: string;
  step: SingleExposureFormStep;
  items: SingleExposureResumedFormItem[];
  orderTerms: { accepted: boolean; allowPortfolio: boolean };
} {
  const parsed = SingleExposureDraftStateSchema.parse(
    normalizeLegacySingleExposureDraftState(state),
  );
  return {
    jobTitle: parsed.jobTitle,
    step: parsed.currentStep,
    orderTerms: { ...parsed.termsUi },
    items: parsed.items.map((item) => ({
      clientItemId: item.clientItemId,
      file: null,
      referenceFile: null,
      referenceLink: item.state.referenceLink,
      referenceFiles: item.state.referenceFiles.map((reference) => ({
        ...reference,
        file: null,
      })),
      fileSizeLimit: item.state.fileSizeLimit,
      disclaimerText: item.state.disclaimerText,
      additionalInfo: item.state.additionalInfo,
      grassRepair: item.state.grassRepair,
      skyReplacement: item.state.skyReplacement,
      tvScreenReplacement: item.state.tvScreenReplacement,
      addFireToFireplace: item.state.addFireToFireplace,
      daySkyStyle: item.state.daySkyStyle,
      selectedAddons: normalizeSingleExposureStandardAddOns(
        item.state.selectedAddons,
      ),
      aerialEditing: item.state.aerialEditing,
      aerialEditingInstructions: item.state.aerialEditingInstructions,
      originalFilename: item.state.originalFilename,
      referenceFilename: item.state.referenceFilename,
    })),
  };
}

export function buildSingleExposureDraftFingerprint(
  source: SingleExposureFormDraftSource,
): string {
  return stableStringifyJson({
    state: mapSingleExposureFormToDraftState(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  });
}

export function hasMeaningfulSingleExposureDraftChange(
  source: SingleExposureFormDraftSource,
): boolean {
  if (source.jobTitle.trim() || source.orderTerms.accepted || source.orderTerms.allowPortfolio) {
    return true;
  }
  return source.items.some(
    (item) =>
      item.file != null ||
      item.referenceFile != null ||
      (item.referenceFiles?.length ?? 0) > 0 ||
      (item.referenceLink?.trim() ?? "") !== "" ||
      item.originalFilename != null ||
      item.referenceFilename != null ||
      item.fileSizeLimit.trim() !== "" ||
      item.disclaimerText.trim() !== "" ||
      item.additionalInfo.trim() !== "" ||
      item.selectedAddons.length > 0 ||
      item.aerialEditing !== AERIAL_EDITING_DEFAULT ||
      item.aerialEditingInstructions.trim() !== "" ||
      item.grassRepair !== THREE_STATE_DEFAULT ||
      item.skyReplacement !== THREE_STATE_DEFAULT ||
      item.tvScreenReplacement !== THREE_STATE_DEFAULT ||
      item.addFireToFireplace !== THREE_STATE_DEFAULT ||
      item.daySkyStyle !== DAY_SKY_STYLE_DEFAULT,
  );
}

export function isSingleExposureItemConfigurationValid(input: {
  hasOriginal: boolean;
  hasReference: boolean;
  skyReplacement: ThreeStateValue;
  daySkyStyle: unknown;
  aerialEditing: AerialEditingId;
  aerialEditingInstructions: string;
}): boolean {
  if (!input.hasOriginal) return false;
  if (
    isDaySkyStyleActive(input.skyReplacement) &&
    !(DAY_SKY_STYLE_ID_VALUES as readonly unknown[]).includes(input.daySkyStyle)
  ) {
    return false;
  }
  return isAerialDetailRequirementSatisfied(
    input.aerialEditing,
    input.aerialEditingInstructions,
    input.hasReference,
  );
}

export function buildSingleExposurePricingPreview(
  source: Pick<SingleExposureFormDraftSource, "items" | "currency">,
): PricingPreview | null {
  try {
    const quote = calculateOrderQuote({
      serviceType: "photo-editing",
      currency: source.currency,
      items: source.items.map((item) => ({
        selectedOptions: getSingleExposureSelectedOptions(
          item.selectedAddons,
          item.aerialEditing,
        ),
        baseOptionId: "image-enhancement-re",
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

export function buildSingleExposureCreateDraftInput(
  source: SingleExposureFormDraftSource,
): CreateOrderDraftInput<SingleExposureDraftState> {
  const state = mapSingleExposureFormToDraftState(source);
  return {
    serviceType: "photo-editing",
    subService: SINGLE_EXPOSURE_SUB_SERVICE,
    route: SINGLE_EXPOSURE_DRAFT_ROUTE,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildSingleExposurePricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function buildSingleExposureUpdateDraftInput(
  source: SingleExposureFormDraftSource,
  expectedVersion: number,
): UpdateOrderDraftInput<SingleExposureDraftState> {
  const state = mapSingleExposureFormToDraftState(source);
  return {
    expectedVersion,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildSingleExposurePricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function validateSingleExposureDraftForResume(
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
      form: ReturnType<typeof mapSingleExposureDraftToFormState>;
      version: number;
    }
  | { ok: false; message: string } {
  if (
    draft.serviceType !== "photo-editing" ||
    draft.subService !== SINGLE_EXPOSURE_SUB_SERVICE ||
    draft.route !== SINGLE_EXPOSURE_DRAFT_ROUTE
  ) {
    return { ok: false, message: "This draft belongs to a different order form." };
  }
  if (draft.stateSchemaVersion !== SINGLE_EXPOSURE_DRAFT_STATE_SCHEMA_VERSION) {
    return { ok: false, message: "This draft version is no longer supported." };
  }
  const parsed = SingleExposureDraftStateSchema.safeParse(
    normalizeLegacySingleExposureDraftState(draft.state),
  );
  if (!parsed.success) {
    return { ok: false, message: "This draft could not be restored safely." };
  }
  return {
    ok: true,
    form: mapSingleExposureDraftToFormState(parsed.data),
    version: draft.version,
  };
}

export function normalizeLegacySingleExposureDraftState(state: unknown): unknown {
  if (!state || typeof state !== "object" || Array.isArray(state)) return state;
  const root = state as Record<string, unknown>;
  if (!Array.isArray(root.items)) return state;
  return {
    ...root,
    items: root.items.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
      const envelope = entry as Record<string, unknown>;
      const rawState = envelope.state;
      if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
        return entry;
      }
      const item = rawState as Record<string, unknown>;
      const existing = Array.isArray(item.referenceFiles) ? item.referenceFiles : [];
      const legacy = item.aerialReferenceImage ?? item.referenceImage;
      let migrated = existing;
      if (existing.length === 0 && legacy && typeof legacy === "object") {
        const legacyRecord = legacy as Record<string, unknown>;
        const legacyName = typeof legacyRecord.name === "string"
          ? legacyRecord.name
          : typeof item.referenceFilename === "string"
            ? item.referenceFilename
            : "reference.jpg";
        migrated = [{
          id: `legacy-${String(envelope.clientItemId ?? "reference")}`,
          filename: legacyName,
          fileSize: typeof legacyRecord.size === "number" ? legacyRecord.size : 0,
          mimeType: typeof legacyRecord.type === "string" ? legacyRecord.type : "image/jpeg",
          lastModified: null,
        }];
      }
      const { aerialReferenceImage: _aerial, referenceImage: _reference, ...rest } = item;
      void _aerial;
      void _reference;
      return {
        ...envelope,
        state: { ...rest, referenceFiles: migrated },
      };
    }),
  };
}

export function resolveSingleExposureDraftRegion(
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

function regionForCurrency(currency: TransactionalCurrency): RegionCode {
  const region =
    currency === "CAD" ? "CA" : currency === "EUR" ? "EU" : DEFAULT_REGION;
  return isRegionCode(region) ? region : DEFAULT_REGION;
}
