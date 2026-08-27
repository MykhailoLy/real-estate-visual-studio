import { z } from "zod";
import {
  currencyForRegion,
  DEFAULT_REGION,
  isRegionCode,
  type RegionCode,
} from "../currency.ts";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import {
  FLOOR_PLAN_MAX_FLOORS,
  FLOOR_PLAN_MIN_FLOORS,
  FLOOR_PLAN_TYPE_IDS,
} from "../pricing/catalog.ts";
import type { TransactionalCurrency } from "../pricing/types.ts";
import {
  ALLOWED_FLOOR_PLAN_MIME_TYPES,
  ALLOWED_REFERENCE_MIME_TYPES,
  type UploadKind,
} from "../upload-config.ts";
import { stableStringifyJson } from "./serialization.ts";
import { createDraftClientItemId } from "./utils.ts";
import type {
  CreateOrderDraftInput,
  JsonObject,
  OrderDraftRow,
  PricingPreview,
  UpdateOrderDraftInput,
} from "./types.ts";

export const FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION = 1;
export const FLOOR_PLANS_DRAFT_ROUTE = "/dashboard/orders/new/3d-floor-plans";
export const FLOOR_PLANS_DRAFT_STEP = "configure";
export { FLOOR_PLAN_MAX_FLOORS, FLOOR_PLAN_MIN_FLOORS };

export type FloorPlansAutosaveStatus =
  | "not_saved"
  | "saving"
  | "saved"
  | "save_failed"
  | "conflict";

export interface FloorPlanDraftItemState extends JsonObject {
  planType: string;
  numberOfFloors: number;
  fileSizeLimit: string;
  disclaimerText: string;
  style3d: string;
  planView3d: string;
  pageOrientation: string;
  planOrientation: string;
  flooringByRoom: Record<string, string>;
  showAddress: boolean;
  streetAddress: string;
  showTitle: boolean;
  projectTitle: string;
  disclaimerOption: string;
  customDisclaimer: string;
  referenceLink: string;
  additionalInfo: string;
  originalFilename: string | null;
  referenceFilename: string | null;
}

export interface FloorPlanDraftItemEnvelope extends JsonObject {
  clientItemId: string;
  state: FloorPlanDraftItemState;
}

export interface FloorPlansDraftState extends JsonObject {
  schemaVersion: typeof FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION;
  jobTitle: string;
  currentStep: typeof FLOOR_PLANS_DRAFT_STEP;
  items: FloorPlanDraftItemEnvelope[];
  termsUi: { accepted: boolean; allowPortfolio: boolean } & JsonObject;
  metadata: { service: "3d-floor-plans" } & JsonObject;
}

export interface FloorPlanFormItemDraftSource {
  clientItemId?: string;
  file?: { name?: string } | null;
  referenceFile?: { name?: string } | null;
  planType: string;
  numberOfFloors: number;
  fileSizeLimit: string;
  disclaimerText: string;
  style3d: string;
  planView3d: string;
  pageOrientation: string;
  planOrientation: string;
  flooringByRoom: Record<string, string>;
  showAddress: boolean;
  streetAddress: string;
  showTitle: boolean;
  projectTitle: string;
  disclaimerOption: string;
  customDisclaimer: string;
  referenceLink: string;
  additionalInfo: string;
  originalFilename?: string | null;
  referenceFilename?: string | null;
}

export interface FloorPlansFormDraftSource {
  jobTitle: string;
  items: FloorPlanFormItemDraftSource[];
  orderTerms: { accepted: boolean; allowPortfolio: boolean };
  currency: TransactionalCurrency;
  region?: RegionCode | null;
}

export interface FloorPlanResumedFormItem
  extends Omit<FloorPlanFormItemDraftSource, "file" | "referenceFile"> {
  clientItemId: string;
  file: null;
  referenceFile: null;
  originalFilename: string | null;
  referenceFilename: string | null;
}

const STRING_FIELD_MAX = 5000;
const SHORT_FIELD_MAX = 200;
const DEFAULT_DISCLAIMER_OPTION = "Do not show disclaimer";
const FLOOR_PLAN_TYPE_ID_SET = new Set<string>(FLOOR_PLAN_TYPE_IDS);
const FloorPlanTypeDraftSchema = z.union([
  z.literal(""),
  z.enum(FLOOR_PLAN_TYPE_IDS as [string, ...string[]]),
]);
const FloorPlanFloorCountSchema = z
  .number()
  .int()
  .min(FLOOR_PLAN_MIN_FLOORS)
  .max(FLOOR_PLAN_MAX_FLOORS);

export function isCanonicalFloorPlanType(value: string): boolean {
  return FLOOR_PLAN_TYPE_ID_SET.has(value);
}

export function isValidFloorPlanFloorCount(value: number): boolean {
  return FloorPlanFloorCountSchema.safeParse(value).success;
}

export function parseFloorPlanFloorCountInput(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return isValidFloorPlanFloorCount(parsed) ? parsed : null;
}

const FloorPlanDraftItemStateSchema = z
  .object({
    planType: FloorPlanTypeDraftSchema.default(""),
    numberOfFloors: FloorPlanFloorCountSchema.default(FLOOR_PLAN_MIN_FLOORS),
    fileSizeLimit: z.string().max(SHORT_FIELD_MAX).default(""),
    disclaimerText: z.string().max(2000).default(""),
    style3d: z.string().max(SHORT_FIELD_MAX).default(""),
    planView3d: z.string().max(SHORT_FIELD_MAX).default(""),
    pageOrientation: z.string().max(SHORT_FIELD_MAX).default(""),
    planOrientation: z.string().max(SHORT_FIELD_MAX).default(""),
    flooringByRoom: z.record(z.string(), z.string().max(SHORT_FIELD_MAX)).default({}),
    showAddress: z.boolean().default(false),
    streetAddress: z.string().max(1000).default(""),
    showTitle: z.boolean().default(false),
    projectTitle: z.string().max(1000).default(""),
    disclaimerOption: z.string().max(SHORT_FIELD_MAX).default(DEFAULT_DISCLAIMER_OPTION),
    customDisclaimer: z.string().max(2000).default(""),
    referenceLink: z.string().max(STRING_FIELD_MAX).default(""),
    additionalInfo: z.string().max(STRING_FIELD_MAX).default(""),
    originalFilename: z.string().min(1).max(255).nullable().default(null),
    referenceFilename: z.string().min(1).max(255).nullable().default(null),
  })
  .strict();

export const FloorPlansDraftStateSchema = z
  .object({
    schemaVersion: z.literal(FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION),
    jobTitle: z.string().max(120).default(""),
    currentStep: z.literal(FLOOR_PLANS_DRAFT_STEP),
    items: z
      .array(
        z
          .object({
            clientItemId: z.uuid(),
            state: FloorPlanDraftItemStateSchema,
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
    metadata: z.object({ service: z.literal("3d-floor-plans") }).strict(),
  })
  .strict()
  .superRefine((state, context) => {
    const seen = new Set<string>();
    state.items.forEach((item, index) => {
      if (seen.has(item.clientItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "clientItemId"],
          message: "Floor Plan item IDs must be unique.",
        });
      }
      seen.add(item.clientItemId);
    });
  }) satisfies z.ZodType<FloorPlansDraftState>;

function trim(value: string, max = STRING_FIELD_MAX): string {
  return value.trim().slice(0, max);
}

function filename(value: { name?: string } | null | undefined): string | null {
  const name = value?.name?.trim();
  return name ? name.slice(0, 255) : null;
}

function normalizeFlooringByRoom(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value)
      .map(([room, flooring]) => [
        trim(room, SHORT_FIELD_MAX),
        trim(flooring, SHORT_FIELD_MAX),
      ])
      .filter(([room, flooring]) => Boolean(room) && Boolean(flooring)),
  );
}

export function createFloorPlanFormItem(): FloorPlanResumedFormItem {
  return {
    clientItemId: createDraftClientItemId(),
    file: null,
    referenceFile: null,
    planType: "",
    numberOfFloors: FLOOR_PLAN_MIN_FLOORS,
    fileSizeLimit: "",
    disclaimerText: "",
    style3d: "",
    planView3d: "",
    pageOrientation: "",
    planOrientation: "",
    flooringByRoom: {},
    showAddress: false,
    streetAddress: "",
    showTitle: false,
    projectTitle: "",
    disclaimerOption: DEFAULT_DISCLAIMER_OPTION,
    customDisclaimer: "",
    referenceLink: "",
    additionalInfo: "",
    originalFilename: null,
    referenceFilename: null,
  };
}

export function mapFloorPlansFormToDraftState(
  source: FloorPlansFormDraftSource,
): FloorPlansDraftState {
  const state = {
    schemaVersion: FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION,
    jobTitle: trim(source.jobTitle, 120),
    currentStep: FLOOR_PLANS_DRAFT_STEP,
    items: source.items.map((item) => ({
      clientItemId: item.clientItemId ?? createDraftClientItemId(),
      state: {
        planType: item.planType,
        numberOfFloors: item.numberOfFloors,
        fileSizeLimit: trim(item.fileSizeLimit, SHORT_FIELD_MAX),
        disclaimerText: trim(item.disclaimerText, 2000),
        style3d: trim(item.style3d, SHORT_FIELD_MAX),
        planView3d: trim(item.planView3d, SHORT_FIELD_MAX),
        pageOrientation: trim(item.pageOrientation, SHORT_FIELD_MAX),
        planOrientation: trim(item.planOrientation, SHORT_FIELD_MAX),
        flooringByRoom: normalizeFlooringByRoom(item.flooringByRoom),
        showAddress: item.showAddress === true,
        streetAddress: trim(item.streetAddress, 1000),
        showTitle: item.showTitle === true,
        projectTitle: trim(item.projectTitle, 1000),
        disclaimerOption:
          trim(item.disclaimerOption, SHORT_FIELD_MAX) || DEFAULT_DISCLAIMER_OPTION,
        customDisclaimer: trim(item.customDisclaimer, 2000),
        referenceLink: trim(item.referenceLink),
        additionalInfo: trim(item.additionalInfo),
        originalFilename:
          filename(item.file) ?? item.originalFilename?.trim().slice(0, 255) ?? null,
        referenceFilename:
          filename(item.referenceFile) ??
          item.referenceFilename?.trim().slice(0, 255) ??
          null,
      },
    })),
    termsUi: {
      accepted: source.orderTerms.accepted === true,
      allowPortfolio: source.orderTerms.allowPortfolio === true,
    },
    metadata: { service: "3d-floor-plans" },
  };

  return FloorPlansDraftStateSchema.parse(state);
}

export function mapFloorPlansDraftToFormState(state: unknown): {
  jobTitle: string;
  items: FloorPlanResumedFormItem[];
  orderTerms: { accepted: boolean; allowPortfolio: boolean };
} {
  const parsed = FloorPlansDraftStateSchema.parse(state);
  return {
    jobTitle: parsed.jobTitle,
    items: parsed.items.map((item) => ({
      clientItemId: item.clientItemId,
      file: null,
      referenceFile: null,
      ...item.state,
      flooringByRoom: { ...item.state.flooringByRoom },
    })),
    orderTerms: { ...parsed.termsUi },
  };
}

export function buildFloorPlansDraftFingerprint(
  source: FloorPlansFormDraftSource,
): string {
  return stableStringifyJson({
    state: mapFloorPlansFormToDraftState(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  });
}

export function hasMeaningfulFloorPlansDraftChange(
  source: FloorPlansFormDraftSource,
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
      item.planType.trim() !== "" ||
      item.numberOfFloors !== 1 ||
      item.fileSizeLimit.trim() !== "" ||
      item.disclaimerText.trim() !== "" ||
      item.style3d.trim() !== "" ||
      item.planView3d.trim() !== "" ||
      item.pageOrientation.trim() !== "" ||
      item.planOrientation.trim() !== "" ||
      Object.keys(item.flooringByRoom).length > 0 ||
      item.showAddress ||
      item.streetAddress.trim() !== "" ||
      item.showTitle ||
      item.projectTitle.trim() !== "" ||
      item.disclaimerOption !== DEFAULT_DISCLAIMER_OPTION ||
      item.customDisclaimer.trim() !== "" ||
      item.referenceLink.trim() !== "" ||
      item.additionalInfo.trim() !== "",
  );
}

export function buildFloorPlansPricingPreview(
  source: Pick<FloorPlansFormDraftSource, "items" | "currency">,
): PricingPreview | null {
  try {
    const quote = calculateOrderQuote({
      serviceType: "3d-floor-plans",
      currency: source.currency,
      items: source.items.map((item) => ({
        planType: item.planType,
        numberOfFloors: item.numberOfFloors,
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

export function buildFloorPlansCreateDraftInput(
  source: FloorPlansFormDraftSource,
): CreateOrderDraftInput<FloorPlansDraftState> {
  const state = mapFloorPlansFormToDraftState(source);
  return {
    serviceType: "3d-floor-plans",
    route: FLOOR_PLANS_DRAFT_ROUTE,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildFloorPlansPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function buildFloorPlansUpdateDraftInput(
  source: FloorPlansFormDraftSource,
  expectedVersion: number,
): UpdateOrderDraftInput<FloorPlansDraftState> {
  const state = mapFloorPlansFormToDraftState(source);
  return {
    expectedVersion,
    title: state.jobTitle || null,
    currentStep: state.currentStep,
    state,
    pricingPreview: buildFloorPlansPricingPreview(source),
    currency: source.currency,
    region: source.region ?? regionForCurrency(source.currency),
  };
}

export function validateFloorPlansDraftForResume(
  draft: Pick<
    OrderDraftRow,
    "serviceType" | "subService" | "route" | "state" | "stateSchemaVersion" | "version"
  >,
):
  | {
      ok: true;
      state: FloorPlansDraftState;
      form: ReturnType<typeof mapFloorPlansDraftToFormState>;
      version: number;
    }
  | { ok: false; message: string } {
  if (
    draft.serviceType !== "3d-floor-plans" ||
    draft.subService !== null ||
    draft.route !== FLOOR_PLANS_DRAFT_ROUTE
  ) {
    return { ok: false, message: "This draft belongs to a different order form." };
  }
  if (draft.stateSchemaVersion !== FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION) {
    return { ok: false, message: "This draft version is no longer supported." };
  }
  const parsed = FloorPlansDraftStateSchema.safeParse(draft.state);
  if (!parsed.success) {
    return { ok: false, message: "This draft could not be restored safely." };
  }
  return {
    ok: true,
    state: parsed.data,
    form: mapFloorPlansDraftToFormState(parsed.data),
    version: draft.version,
  };
}

export function resolveFloorPlansDraftRegion(
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

export function shouldApplyFloorPlansAsyncResult(
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

export function resetFloorPlansDraftIdentity(currentSearch: string): {
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

export function getFloorPlanDraftUploadContentType(
  file: { name: string; type?: string | null },
  kind: UploadKind,
): string {
  const extension = file.name.split(".").pop()?.trim().toLowerCase() ?? "";
  const inferredByExtension: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    dwg: "application/octet-stream",
    dxf: "application/octet-stream",
    fbx: "application/octet-stream",
  };
  const inferred = inferredByExtension[extension];
  const browserType = file.type?.trim().toLowerCase() ?? "";
  const allowed =
    kind === "reference"
      ? ALLOWED_REFERENCE_MIME_TYPES
      : ALLOWED_FLOOR_PLAN_MIME_TYPES;

  if (kind === "original" && ["dwg", "dxf", "fbx"].includes(extension)) {
    return "application/octet-stream";
  }
  if (browserType && allowed.includes(browserType as never)) return browserType;
  if (inferred && allowed.includes(inferred as never)) return inferred;
  return browserType || "application/octet-stream";
}

function regionForCurrency(currency: TransactionalCurrency): RegionCode {
  const region =
    currency === "CAD" ? "CA" : currency === "EUR" ? "EU" : DEFAULT_REGION;
  return isRegionCode(region) ? region : DEFAULT_REGION;
}
