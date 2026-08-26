import { z } from "zod";
import {
  currencyForRegion,
  DEFAULT_REGION,
  isRegionCode,
  type RegionCode,
} from "../currency.ts";
import {
  RENOVATION_EXTERNAL_IDS,
  RENOVATION_INTERNAL_IDS,
} from "../pricing/catalog.ts";
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

export const VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION = 1;
export const VIRTUAL_RENOVATION_DRAFT_ROUTE =
  "/dashboard/orders/new/virtual-renovation";
export const VIRTUAL_RENOVATION_DRAFT_STEP = "configure";

export type VirtualRenovationAutosaveStatus =
  | "not_saved"
  | "saving"
  | "saved"
  | "save_failed"
  | "conflict";

export interface VirtualRenovationDraftItemState extends JsonObject {
  selectedInternal: string[];
  selectedExternal: string[];
  room: string;
  presentationStyle: string;
  fileSizeLimit: string;
  disclaimerText: string;
  referenceLink: string;
  additionalInfo: string;
  originalFilename: string | null;
  referenceFilename: string | null;
}

export interface VirtualRenovationDraftItemEnvelope extends JsonObject {
  clientItemId: string;
  state: VirtualRenovationDraftItemState;
}

export interface VirtualRenovationDraftState extends JsonObject {
  schemaVersion: typeof VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION;
  jobTitle: string;
  currentStep: typeof VIRTUAL_RENOVATION_DRAFT_STEP;
  items: VirtualRenovationDraftItemEnvelope[];
  termsUi: { accepted: boolean; allowPortfolio: boolean } & JsonObject;
  metadata: { service: "virtual-renovation" } & JsonObject;
}

export interface VirtualRenovationFormItemDraftSource {
  clientItemId?: string;
  file?: { name?: string } | null;
  referenceFile?: { name?: string } | null;
  selectedInternal: string[];
  selectedExternal: string[];
  room: string;
  presentationStyle: string;
  fileSizeLimit: string;
  disclaimerText: string;
  referenceLink: string;
  additionalInfo: string;
  originalFilename?: string | null;
  referenceFilename?: string | null;
}

export interface VirtualRenovationFormDraftSource {
  jobTitle: string;
  items: VirtualRenovationFormItemDraftSource[];
  orderTerms: { accepted: boolean; allowPortfolio: boolean };
  currency: TransactionalCurrency;
  region?: RegionCode | null;
}

export interface VirtualRenovationResumedFormItem
  extends Omit<VirtualRenovationFormItemDraftSource, "file" | "referenceFile"> {
  clientItemId: string;
  file: null;
  referenceFile: null;
  originalFilename: string | null;
  referenceFilename: string | null;
}

const STRING_FIELD_MAX = 5000;
const INTERNAL_VALUES = RENOVATION_INTERNAL_IDS as [string, ...string[]];
const EXTERNAL_VALUES = RENOVATION_EXTERNAL_IDS as [string, ...string[]];

const VirtualRenovationDraftItemStateSchema = z
  .object({
    selectedInternal: z.array(z.enum(INTERNAL_VALUES)).max(RENOVATION_INTERNAL_IDS.length),
    selectedExternal: z.array(z.enum(EXTERNAL_VALUES)).max(RENOVATION_EXTERNAL_IDS.length),
    room: z.string().max(200).default(""),
    presentationStyle: z.string().max(200).default(""),
    fileSizeLimit: z.string().max(200).default(""),
    disclaimerText: z.string().max(STRING_FIELD_MAX).default(""),
    referenceLink: z.string().max(STRING_FIELD_MAX).default(""),
    additionalInfo: z.string().max(STRING_FIELD_MAX).default(""),
    originalFilename: z.string().min(1).max(255).nullable().default(null),
    referenceFilename: z.string().min(1).max(255).nullable().default(null),
  })
  .strict();

export const VirtualRenovationDraftStateSchema = z
  .object({
    schemaVersion: z.literal(VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION),
    jobTitle: z.string().max(120).default(""),
    currentStep: z.literal(VIRTUAL_RENOVATION_DRAFT_STEP),
    items: z
      .array(
        z
          .object({
            clientItemId: z.uuid(),
            state: VirtualRenovationDraftItemStateSchema,
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
    metadata: z.object({ service: z.literal("virtual-renovation") }).strict(),
  })
  .strict()
  .superRefine((state, context) => {
    const seen = new Set<string>();
    state.items.forEach((item, index) => {
      if (seen.has(item.clientItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "clientItemId"],
          message: "Virtual Renovation item IDs must be unique.",
        });
      }
      seen.add(item.clientItemId);
    });
  }) satisfies z.ZodType<VirtualRenovationDraftState>;

function trim(value: string, max = STRING_FIELD_MAX): string {
  return value.trim().slice(0, max);
}

function filename(value: { name?: string } | null | undefined): string | null {
  const name = value?.name?.trim();
  return name ? name.slice(0, 255) : null;
}

function normalizeOptions(options: string[], allowedValues: readonly string[]): string[] {
  const allowed = new Set(allowedValues);
  return Array.from(new Set(options.filter((option) => allowed.has(option))));
}

export function createVirtualRenovationFormItem(): VirtualRenovationResumedFormItem {
  return {
    clientItemId: createDraftClientItemId(),
    file: null,
    referenceFile: null,
    selectedInternal: [],
    selectedExternal: [],
    room: "",
    presentationStyle: "",
    fileSizeLimit: "",
    disclaimerText: "",
    referenceLink: "",
    additionalInfo: "",
    originalFilename: null,
    referenceFilename: null,
  };
}

export function mapVirtualRenovationFormToDraftState(
  source: VirtualRenovationFormDraftSource,
): VirtualRenovationDraftState {
  return {
    schemaVersion: VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION,
    jobTitle: trim(source.jobTitle, 120),
    currentStep: VIRTUAL_RENOVATION_DRAFT_STEP,
    items: source.items.map((item) => ({
      clientItemId: item.clientItemId ?? createDraftClientItemId(),
      state: {
        selectedInternal: normalizeOptions(item.selectedInternal, RENOVATION_INTERNAL_IDS),
        selectedExternal: normalizeOptions(item.selectedExternal, RENOVATION_EXTERNAL_IDS),
        room: trim(item.room, 200),
        presentationStyle: trim(item.presentationStyle, 200),
        fileSizeLimit: trim(item.fileSizeLimit, 200),
        disclaimerText: trim(item.disclaimerText),
        referenceLink: trim(item.referenceLink),
        additionalInfo: trim(item.additionalInfo),
        originalFilename:
          filename(item.file) ?? item.originalFilename?.trim() ?? null,
        referenceFilename:
          filename(item.referenceFile) ?? item.referenceFilename?.trim() ?? null,
      },
    })),
    termsUi: {
      accepted: source.orderTerms.accepted === true,
      allowPortfolio: source.orderTerms.allowPortfolio === true,
    },
    metadata: { service: "virtual-renovation" },
  };
}

export function mapVirtualRenovationDraftToFormState(state: unknown): {
  jobTitle: string;
  items: VirtualRenovationResumedFormItem[];
  orderTerms: { accepted: boolean; allowPortfolio: boolean };
} {
  const parsed = VirtualRenovationDraftStateSchema.parse(state);
  return {
    jobTitle: parsed.jobTitle,
    items: parsed.items.map((item) => ({
      clientItemId: item.clientItemId,
      file: null,
      referenceFile: null,
      ...item.state,
      selectedInternal: [...item.state.selectedInternal],
      selectedExternal: [...item.state.selectedExternal],
    })),
    orderTerms: { ...parsed.termsUi },
  };
}

export function buildVirtualRenovationDraftFingerprint(
  source: VirtualRenovationFormDraftSource,
): string {
  return stableStringifyJson({
    state: mapVirtualRenovationFormToDraftState(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  });
}

export function hasMeaningfulVirtualRenovationDraftChange(
  source: VirtualRenovationFormDraftSource,
): boolean {
  if (
    source.jobTitle.trim() ||
    source.orderTerms.accepted ||
    source.orderTerms.allowPortfolio ||
    source.items.length > 1
  ) {
    return true;
  }
  return source.items.some(
    (item) =>
      item.file != null ||
      item.referenceFile != null ||
      item.originalFilename != null ||
      item.referenceFilename != null ||
      item.selectedInternal.length > 0 ||
      item.selectedExternal.length > 0 ||
      item.room.trim() !== "" ||
      item.presentationStyle.trim() !== "" ||
      item.fileSizeLimit.trim() !== "" ||
      item.disclaimerText.trim() !== "" ||
      item.referenceLink.trim() !== "" ||
      item.additionalInfo.trim() !== "",
  );
}

export function buildVirtualRenovationPricingPreview(
  source: Pick<VirtualRenovationFormDraftSource, "items" | "currency">,
): PricingPreview | null {
  try {
    const quote = calculateOrderQuote({
      serviceType: "virtual-renovation",
      currency: source.currency,
      items: source.items.map((item) => ({
        selectedInternal: normalizeOptions(item.selectedInternal, RENOVATION_INTERNAL_IDS),
        selectedExternal: normalizeOptions(item.selectedExternal, RENOVATION_EXTERNAL_IDS),
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

export function buildVirtualRenovationCreateDraftInput(
  source: VirtualRenovationFormDraftSource,
): CreateOrderDraftInput<VirtualRenovationDraftState> {
  const state = mapVirtualRenovationFormToDraftState(source);
  return {
    serviceType: "virtual-renovation",
    route: VIRTUAL_RENOVATION_DRAFT_ROUTE,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildVirtualRenovationPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function buildVirtualRenovationUpdateDraftInput(
  source: VirtualRenovationFormDraftSource,
  expectedVersion: number,
): UpdateOrderDraftInput<VirtualRenovationDraftState> {
  const state = mapVirtualRenovationFormToDraftState(source);
  return {
    expectedVersion,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildVirtualRenovationPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function validateVirtualRenovationDraftForResume(
  draft: Pick<
    OrderDraftRow,
    "serviceType" | "subService" | "route" | "state" | "stateSchemaVersion" | "version"
  >,
):
  | {
      ok: true;
      state: VirtualRenovationDraftState;
      form: ReturnType<typeof mapVirtualRenovationDraftToFormState>;
      version: number;
    }
  | { ok: false; message: string } {
  if (
    draft.serviceType !== "virtual-renovation" ||
    draft.subService !== null ||
    draft.route !== VIRTUAL_RENOVATION_DRAFT_ROUTE
  ) {
    return { ok: false, message: "This draft belongs to a different order form." };
  }
  if (draft.stateSchemaVersion !== VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION) {
    return { ok: false, message: "This draft version is no longer supported." };
  }
  const parsed = VirtualRenovationDraftStateSchema.safeParse(draft.state);
  if (!parsed.success) {
    return { ok: false, message: "This draft could not be restored safely." };
  }
  return {
    ok: true,
    state: parsed.data,
    form: mapVirtualRenovationDraftToFormState(parsed.data),
    version: draft.version,
  };
}

export function resolveVirtualRenovationDraftRegion(
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

export function shouldApplyVirtualRenovationAsyncResult(
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

export function resetVirtualRenovationDraftIdentity(currentSearch: string): {
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
