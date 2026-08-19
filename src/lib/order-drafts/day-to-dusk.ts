import { z } from "zod";
import {
  DAY_TO_DUSK_OPTION_ID,
  DAY_TO_DUSK_SUB_SERVICE,
  DUSK_STYLE_DEFAULT,
  DUSK_STYLE_ID_VALUES,
  type DuskStyleId,
} from "../day-to-dusk.ts";
import {
  currencyForRegion,
  DEFAULT_REGION,
  isRegionCode,
  type RegionCode,
} from "../currency.ts";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import type { TransactionalCurrency } from "../pricing/types.ts";
import type { ReferenceFileValue } from "../reference-files.ts";
import { stableStringifyJson } from "./serialization.ts";
import { createDraftClientItemId } from "./utils.ts";
import type {
  CreateOrderDraftInput,
  JsonObject,
  OrderDraftRow,
  PricingPreview,
  UpdateOrderDraftInput,
} from "./types.ts";

export const DAY_TO_DUSK_DRAFT_STATE_SCHEMA_VERSION = 1;
export const DAY_TO_DUSK_DRAFT_ROUTE = "/dashboard/orders/new/day-to-dusk";
export type DayToDuskDraftStep = "configure" | "review";
export type DayToDuskAutosaveStatus =
  | "not_saved"
  | "saving"
  | "saved"
  | "save_failed"
  | "conflict";

export interface DayToDuskFormItemDraftSource {
  clientItemId?: string;
  file?: { name?: string } | null;
  referenceLink?: string;
  referenceFiles?: ReferenceFileValue[];
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  duskStyle: DuskStyleId;
  turnOnInteriorLights: boolean;
  turnOnExteriorLights: boolean;
  addPoolLights: boolean;
  originalFilename?: string | null;
}

export interface DayToDuskFormDraftSource {
  jobTitle: string;
  step: DayToDuskDraftStep;
  items: DayToDuskFormItemDraftSource[];
  orderTerms: { accepted: boolean; allowPortfolio: boolean };
  shareEnabled: boolean;
  currency: TransactionalCurrency;
  region?: RegionCode | null;
}

export interface DayToDuskDraftItemState extends JsonObject {
  referenceLink: string;
  referenceFiles: Array<{
    id: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    lastModified: number | null;
  } & JsonObject>;
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  duskStyle: DuskStyleId;
  turnOnInteriorLights: boolean;
  turnOnExteriorLights: boolean;
  addPoolLights: boolean;
  originalFilename: string | null;
}

export interface DayToDuskDraftState extends JsonObject {
  schemaVersion: typeof DAY_TO_DUSK_DRAFT_STATE_SCHEMA_VERSION;
  jobTitle: string;
  currentStep: DayToDuskDraftStep;
  items: Array<{
    clientItemId: string;
    state: DayToDuskDraftItemState;
  } & JsonObject>;
  termsUi: { accepted: boolean; allowPortfolio: boolean } & JsonObject;
  metadata: {
    service: "day-to-dusk";
    shareEnabled: boolean;
  } & JsonObject;
}

const ReferenceMetadataSchema = z
  .object({
    id: z.string().min(1).max(100),
    filename: z.string().min(1).max(255),
    fileSize: z.number().int().min(0).max(20 * 1024 * 1024),
    mimeType: z.string().min(1).max(255),
    lastModified: z.number().int().nonnegative().nullable().default(null),
  })
  .strict();

export const DayToDuskDraftStateSchema = z
  .object({
    schemaVersion: z.literal(DAY_TO_DUSK_DRAFT_STATE_SCHEMA_VERSION),
    jobTitle: z.string().max(120).default(""),
    currentStep: z.enum(["configure", "review"]).default("configure"),
    items: z
      .array(
        z
          .object({
            clientItemId: z.string().uuid(),
            state: z
              .object({
                referenceLink: z.string().max(5000).default(""),
                referenceFiles: z.array(ReferenceMetadataSchema).max(10).default([]),
                fileSizeLimit: z.string().max(200).default(""),
                disclaimerText: z.string().max(5000).default(""),
                additionalInfo: z.string().max(5000).default(""),
                duskStyle: z.enum(DUSK_STYLE_ID_VALUES).default(DUSK_STYLE_DEFAULT),
                turnOnInteriorLights: z.boolean().default(true),
                turnOnExteriorLights: z.boolean().default(true),
                addPoolLights: z.boolean().default(false),
                originalFilename: z.string().min(1).max(255).nullable().default(null),
              })
              .strict(),
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
        service: z.literal("day-to-dusk"),
        shareEnabled: z.boolean().default(false),
      })
      .strict(),
  })
  .strict();

const trim = (value: string | undefined, max = 5000) =>
  (value ?? "").trim().slice(0, max);

export function ensureDayToDuskClientItemId(
  item: DayToDuskFormItemDraftSource,
): string {
  return item.clientItemId ?? createDraftClientItemId();
}

export function buildDayToDuskDraftFileSlotKey(clientItemId: string): string {
  return `${clientItemId}:original`;
}

export function mapDayToDuskFormToDraftState(
  source: DayToDuskFormDraftSource,
): DayToDuskDraftState {
  return {
    schemaVersion: DAY_TO_DUSK_DRAFT_STATE_SCHEMA_VERSION,
    jobTitle: trim(source.jobTitle, 120),
    currentStep: source.step,
    termsUi: {
      accepted: source.orderTerms.accepted === true,
      allowPortfolio: source.orderTerms.allowPortfolio === true,
    },
    metadata: { service: "day-to-dusk", shareEnabled: source.shareEnabled },
    items: source.items.map((item) => ({
      clientItemId: ensureDayToDuskClientItemId(item),
      state: {
        referenceLink: trim(item.referenceLink),
        referenceFiles: (item.referenceFiles ?? []).map((reference) => ({
          id: reference.id,
          filename: reference.filename,
          fileSize: reference.fileSize,
          mimeType: reference.mimeType,
          lastModified: reference.lastModified,
        })),
        fileSizeLimit: trim(item.fileSizeLimit, 200),
        disclaimerText: trim(item.disclaimerText),
        additionalInfo: trim(item.additionalInfo),
        duskStyle: item.duskStyle,
        turnOnInteriorLights: item.turnOnInteriorLights,
        turnOnExteriorLights: item.turnOnExteriorLights,
        addPoolLights: item.addPoolLights,
        originalFilename: item.file?.name?.trim() || item.originalFilename?.trim() || null,
      },
    })),
  };
}

export function mapDayToDuskDraftToFormState(state: unknown) {
  const parsed = DayToDuskDraftStateSchema.parse(state);
  return {
    jobTitle: parsed.jobTitle,
    step: parsed.currentStep,
    orderTerms: { ...parsed.termsUi },
    shareEnabled: parsed.metadata.shareEnabled,
    items: parsed.items.map((item) => ({
      clientItemId: item.clientItemId,
      file: null,
      referenceLink: item.state.referenceLink,
      referenceFiles: item.state.referenceFiles.map((reference) => ({
        ...reference,
        file: null,
      })),
      fileSizeLimit: item.state.fileSizeLimit,
      disclaimerText: item.state.disclaimerText,
      additionalInfo: item.state.additionalInfo,
      duskStyle: item.state.duskStyle,
      turnOnInteriorLights: item.state.turnOnInteriorLights,
      turnOnExteriorLights: item.state.turnOnExteriorLights,
      addPoolLights: item.state.addPoolLights,
      originalFilename: item.state.originalFilename,
    })),
  };
}

export function hasMeaningfulDayToDuskDraftChange(
  source: DayToDuskFormDraftSource,
): boolean {
  return Boolean(
    source.jobTitle.trim() ||
      source.orderTerms.accepted ||
      source.orderTerms.allowPortfolio ||
      source.items.some(
        (item) =>
          item.file ||
          item.originalFilename ||
          item.referenceLink?.trim() ||
          (item.referenceFiles?.length ?? 0) > 0 ||
          item.fileSizeLimit.trim() ||
          item.disclaimerText.trim() ||
          item.additionalInfo.trim() ||
          item.duskStyle !== DUSK_STYLE_DEFAULT ||
          !item.turnOnInteriorLights ||
          !item.turnOnExteriorLights ||
          item.addPoolLights,
      ),
  );
}

export function buildDayToDuskDraftFingerprint(
  source: DayToDuskFormDraftSource,
): string {
  return stableStringifyJson({
    state: mapDayToDuskFormToDraftState(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  });
}

function buildPricingPreview(source: DayToDuskFormDraftSource): PricingPreview | null {
  try {
    const quote = calculateOrderQuote({
      serviceType: "photo-editing",
      currency: source.currency,
      items: source.items.map(() => ({ selectedOptions: [DAY_TO_DUSK_OPTION_ID] })),
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

export function buildDayToDuskCreateDraftInput(
  source: DayToDuskFormDraftSource,
): CreateOrderDraftInput<DayToDuskDraftState> {
  const state = mapDayToDuskFormToDraftState(source);
  return {
    serviceType: "photo-editing",
    subService: DAY_TO_DUSK_SUB_SERVICE,
    route: DAY_TO_DUSK_DRAFT_ROUTE,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function buildDayToDuskUpdateDraftInput(
  source: DayToDuskFormDraftSource,
  expectedVersion: number,
): UpdateOrderDraftInput<DayToDuskDraftState> {
  const state = mapDayToDuskFormToDraftState(source);
  return {
    expectedVersion,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function validateDayToDuskDraftForResume(
  draft: Pick<
    OrderDraftRow,
    "serviceType" | "subService" | "route" | "state" | "stateSchemaVersion" | "version"
  >,
) {
  if (
    draft.serviceType !== "photo-editing" ||
    draft.subService !== DAY_TO_DUSK_SUB_SERVICE ||
    draft.route !== DAY_TO_DUSK_DRAFT_ROUTE
  ) {
    return { ok: false as const, message: "This draft belongs to a different order form." };
  }
  if (draft.stateSchemaVersion !== DAY_TO_DUSK_DRAFT_STATE_SCHEMA_VERSION) {
    return { ok: false as const, message: "This draft version is no longer supported." };
  }
  const parsed = DayToDuskDraftStateSchema.safeParse(draft.state);
  if (!parsed.success) {
    return { ok: false as const, message: "This draft could not be restored safely." };
  }
  return {
    ok: true as const,
    form: mapDayToDuskDraftToFormState(parsed.data),
    version: draft.version,
  };
}

export function resolveDayToDuskDraftRegion(
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
  const region = currency === "CAD" ? "CA" : currency === "EUR" ? "EU" : DEFAULT_REGION;
  return isRegionCode(region) ? region : DEFAULT_REGION;
}
