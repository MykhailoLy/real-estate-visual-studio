import { z } from "zod";
import {
  containsDisallowedDraftPayloadValue,
  ORDER_DRAFT_API_MAX_BODY_BYTES,
} from "../order-drafts/api.ts";
import { TransactionalCurrencySchema, UuidSchema } from "../order-drafts/schema.ts";
import {
  buildVirtualStagingPricingPreview,
  VIRTUAL_STAGING_DRAFT_CURRENT_STEP,
  VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION,
} from "../order-drafts/virtual-staging.ts";
import { STAGING_ADDON_IDS } from "../pricing/catalog.ts";
import type { TransactionalCurrency } from "../pricing/types.ts";

// Only free text belongs here. Reject embedded media and private storage references
// even when supplied in a legitimate text field instead of an extra file field.
const privateReference =
  /(?:\b(?:data|blob|file):|\b(?:order-files|deliverables|drafts|pending|rework|storage\/v1\/object|(?:VS|VR|FP|PE|ORD)-\d+)\/|[?&](?:token|signature|sig|x-(?:amz|goog)-signature)=)/i;
function textField(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) =>
        !value.includes("\0") &&
        value.isWellFormed() &&
        !privateReference.test(value) &&
        !containsDisallowedDraftPayloadValue(value),
    );
}

const item = z.strictObject({
  clientItemId: UuidSchema.transform((id) => id.toLowerCase()),
  state: z.strictObject({
    roomName: textField(200),
    furnitureStyle: textField(200),
    additionalInfo: textField(5000),
    selectedAddons: z
      .array(z.enum(STAGING_ADDON_IDS))
      .max(STAGING_ADDON_IDS.length)
      .refine((ids) => new Set(ids).size === ids.length),
  }),
});

const draft = z.strictObject({
  jobTitle: textField(120),
  defaultFurnitureStyle: textField(200),
  items: z
    .array(item)
    .min(1)
    .max(50)
    .refine((items) => new Set(items.map((entry) => entry.clientItemId)).size === items.length),
});

export const ClaimInput = z.strictObject({
  guestDraftId: UuidSchema.transform((id) => id.toLowerCase()),
  expectedVersion: z.number().int().min(1).max(2147483647),
});
// Reserve 1 KiB for the save envelope, including the UUID and largest allowed version.
export const GUEST_DRAFT_MAX_BYTES = ORDER_DRAFT_API_MAX_BODY_BYTES - 1024;
export const GUEST_DRAFT_SIZE_ERROR = `The serialized draft must be at most ${GUEST_DRAFT_MAX_BYTES} UTF-8 bytes.`;
const encoder = new TextEncoder();

// Measure incoming JSON before trim/UUID transforms. Keep the read schema
// compatible with drafts that were accepted before this write limit.
const incomingDraft = z.preprocess((value, ctx) => {
  if (typeof value !== "object" || value === null) return value;
  try {
    if (encoder.encode(JSON.stringify(value)).byteLength <= GUEST_DRAFT_MAX_BYTES) return value;
    ctx.addIssue({ code: "custom", message: GUEST_DRAFT_SIZE_ERROR });
  } catch {
    ctx.addIssue({ code: "custom", message: "The draft must be a JSON object." });
  }
  return z.NEVER;
}, draft);

export const CreateInput = z.strictObject({ draft: incomingDraft, currency: TransactionalCurrencySchema });
export const SaveInput = CreateInput.extend(ClaimInput.partial().shape);
const fixedState = {
  schemaVersion: VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION,
  currentStep: VIRTUAL_STAGING_DRAFT_CURRENT_STEP,
  metadata: { service: "virtual-staging" },
  termsUi: { accepted: false, earlyPerformanceRequested: false, allowPortfolio: false },
} as const;

export const GuestState = draft.extend({
  schemaVersion: z.literal(fixedState.schemaVersion),
  currentStep: z.literal(fixedState.currentStep),
  metadata: z.strictObject({ service: z.literal("virtual-staging") }),
  termsUi: z.strictObject({
    accepted: z.literal(false),
    earlyPerformanceRequested: z.literal(false),
    allowPortfolio: z.literal(false),
  }),
});
export type GuestState = z.infer<typeof GuestState>;
export type ClaimInput = z.infer<typeof ClaimInput>;
export function buildGuestState(input: z.infer<typeof draft>): GuestState {
  return GuestState.parse({ ...input, ...fixedState });
}
export function guestQuote(state: GuestState, currency: TransactionalCurrency) {
  return buildVirtualStagingPricingPreview({ currency, items: state.items.map((item) => item.state) });
}
