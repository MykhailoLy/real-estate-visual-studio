import type { Interactions } from "@google/genai";
import { z } from "zod";
import {
  PHOTO_EDIT_PRICE_KEYS,
  PRICING_VERSION,
  RENOVATION_EXTERNAL_IDS,
  RENOVATION_EXTERNAL_PRICE_KEYS,
  RENOVATION_INTERNAL_IDS,
  RENOVATION_INTERNAL_PRICE_KEYS,
  STAGING_ADDON_IDS,
  getCatalogPrice,
} from "../pricing/catalog.ts";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import {
  LOCAL_PRICING_SERVICE_IDS,
  getLocalPricingEntry,
  getLocalPricingPresentation,
} from "../pricing/local-catalog.ts";
import { TRANSACTIONAL_CURRENCIES } from "../pricing/types.ts";
import type {
  OrderPricingInput,
  OrderQuote,
  TransactionalCurrency,
} from "../pricing/types.ts";

export const SUPPORT_PRICING_TOOL_NAMES = [
  "get_remote_service_quote",
  "get_local_service_pricing",
] as const;

export type SupportPricingToolName =
  (typeof SUPPORT_PRICING_TOOL_NAMES)[number];

export const REMOTE_SUPPORT_PRICING_SERVICE_IDS = [
  "virtual-staging",
  "image-enhancement",
  "day-to-dusk",
  "item-removal-virtual-cleaning",
  "shadow-removal",
  "background-removal",
  "background-change",
  "colour-change",
  "turn-on-lights",
  "water-effect",
  "aerial-colour-fade",
  "aerial-drop-pin",
  "aerial-single-lot-highlight",
  "aerial-multiple-lot-highlight",
  "aerial-full-markup",
  "360-image-enhancement",
  "360-virtual-staging",
  "floor-plan-2d-bw",
  "floor-plan-2d-colour",
  "floor-plan-3d",
  "floor-plan-2d-3d-bundle",
  "virtual-renovation",
] as const;

export type RemoteSupportPricingServiceId =
  (typeof REMOTE_SUPPORT_PRICING_SERVICE_IDS)[number];

const PHOTO_EDITING_SERVICE_OPTION_IDS = {
  "image-enhancement": PHOTO_EDIT_PRICE_KEYS["image-enhancement-re"],
  "day-to-dusk": PHOTO_EDIT_PRICE_KEYS["day-to-dusk-pe"],
  "item-removal-virtual-cleaning":
    PHOTO_EDIT_PRICE_KEYS["item-removal-cleaning-pe"],
  "shadow-removal": PHOTO_EDIT_PRICE_KEYS["shadow-removal"],
  "background-removal": PHOTO_EDIT_PRICE_KEYS["background-removal"],
  "background-change": PHOTO_EDIT_PRICE_KEYS["background-change"],
  "colour-change": PHOTO_EDIT_PRICE_KEYS["colour-change-pe"],
  "turn-on-lights": PHOTO_EDIT_PRICE_KEYS["turn-on-lights-pe"],
  "water-effect": PHOTO_EDIT_PRICE_KEYS["water-effect"],
  "aerial-colour-fade": PHOTO_EDIT_PRICE_KEYS["aerial-colour-fade-pe"],
  "aerial-drop-pin": PHOTO_EDIT_PRICE_KEYS["aerial-drop-pin-pe"],
  "aerial-single-lot-highlight":
    PHOTO_EDIT_PRICE_KEYS["aerial-single-lot-highlight-pe"],
  "aerial-multiple-lot-highlight":
    PHOTO_EDIT_PRICE_KEYS["aerial-multiple-lot-highlight-pe"],
  "aerial-full-markup": PHOTO_EDIT_PRICE_KEYS["aerial-full-markup-pe"],
} as const;

type PhotoEditingSupportServiceId =
  keyof typeof PHOTO_EDITING_SERVICE_OPTION_IDS;

const FLOOR_PLAN_SERVICE_TYPE_IDS = {
  "floor-plan-2d-bw": "2d-bw",
  "floor-plan-2d-colour": "2d-colour",
  "floor-plan-3d": "3d",
  "floor-plan-2d-3d-bundle": "2d-3d-bundle",
} as const;

type FloorPlanSupportServiceId = keyof typeof FLOOR_PLAN_SERVICE_TYPE_IDS;

const REMOTE_SERVICE_SCHEMA = z.enum(REMOTE_SUPPORT_PRICING_SERVICE_IDS);
const CURRENCY_SCHEMA = z.enum(TRANSACTIONAL_CURRENCIES);
const STAGING_ADDON_SCHEMA = z.enum(
  STAGING_ADDON_IDS as [
    (typeof STAGING_ADDON_IDS)[number],
    ...(typeof STAGING_ADDON_IDS)[number][],
  ],
);
const RENOVATION_OPTION_IDS = [
  ...RENOVATION_INTERNAL_IDS,
  ...RENOVATION_EXTERNAL_IDS,
] as const;
const RENOVATION_OPTION_SCHEMA = z.enum(
  RENOVATION_OPTION_IDS as [
    (typeof RENOVATION_OPTION_IDS)[number],
    ...(typeof RENOVATION_OPTION_IDS)[number][],
  ],
);
const LOCAL_SERVICE_SCHEMA = z.enum(LOCAL_PRICING_SERVICE_IDS);

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

const RemoteSupportQuoteArgumentsSchema = z
  .object({
    service: REMOTE_SERVICE_SCHEMA,
    quantity: z.number().int().positive().safe(),
    currency: CURRENCY_SCHEMA,
    addons: z.array(STAGING_ADDON_SCHEMA).optional(),
    renovation_options: z.array(RENOVATION_OPTION_SCHEMA).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const addons = value.addons ?? [];
    const renovationOptions = value.renovation_options ?? [];

    if (hasDuplicates(addons)) {
      context.addIssue({
        code: "custom",
        path: ["addons"],
        message: "Duplicate Virtual Staging add-ons are not allowed.",
      });
    }
    if (hasDuplicates(renovationOptions)) {
      context.addIssue({
        code: "custom",
        path: ["renovation_options"],
        message: "Duplicate Virtual Renovation options are not allowed.",
      });
    }
    if (value.service !== "virtual-staging" && addons.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["addons"],
        message: "Add-ons are supported only for Virtual Staging.",
      });
    }
    if (
      value.service !== "virtual-renovation" &&
      renovationOptions.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["renovation_options"],
        message:
          "Renovation options are supported only for Virtual Renovation.",
      });
    }
    if (
      value.service === "virtual-renovation" &&
      renovationOptions.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["renovation_options"],
        message: "At least one Virtual Renovation option is required.",
      });
    }
  });

const LocalSupportPricingArgumentsSchema = z
  .object({
    service: LOCAL_SERVICE_SCHEMA,
  })
  .strict();

type RemoteSupportQuoteArguments = z.infer<
  typeof RemoteSupportQuoteArgumentsSchema
>;

export class SupportPricingToolValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Support pricing tool arguments are invalid.");
    this.name = "SupportPricingToolValidationError";
    this.issues = issues;
  }
}

export class UnknownSupportPricingToolError extends Error {
  constructor() {
    super("Support pricing tool is not authorised.");
    this.name = "UnknownSupportPricingToolError";
  }
}

function validationIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "arguments";
    return `${path}: ${issue.message}`;
  });
}

function parseRemoteSupportQuoteArguments(
  rawArguments: unknown,
): RemoteSupportQuoteArguments {
  const result = RemoteSupportQuoteArgumentsSchema.safeParse(rawArguments);
  if (!result.success) {
    throw new SupportPricingToolValidationError(
      validationIssues(result.error),
    );
  }
  return result.data;
}

function parseLocalSupportPricingArguments(rawArguments: unknown) {
  const result = LocalSupportPricingArgumentsSchema.safeParse(rawArguments);
  if (!result.success) {
    throw new SupportPricingToolValidationError(
      validationIssues(result.error),
    );
  }
  return result.data;
}

export interface SupportPricingLineItem {
  id: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

export interface RemoteSupportQuotedResult {
  status: "quoted";
  quoteKind: "estimate" | "preliminary";
  service: RemoteSupportPricingServiceId;
  currency: TransactionalCurrency;
  quantity: number;
  unitPriceCents: number | null;
  baseSubtotalCents: number;
  addOnSubtotalCents: number;
  discountEligibility: "eligible" | "excluded";
  discountExplanation: string;
  discountPercent: number;
  discountAmountCents: number;
  finalSubtotalBeforeTaxCents: number;
  taxCalculated: false;
  currencyPolicy: "fixed-catalog-prices-not-live-conversion";
  pricingVersion: typeof PRICING_VERSION;
  lineItems: SupportPricingLineItem[];
}

export interface RemoteSupportManualReviewResult {
  status: "manual-review";
  service: RemoteSupportPricingServiceId;
  currency: TransactionalCurrency;
  quantity: number;
  reasonCode:
    | "custom-quote-quantity"
    | "calculator-quantity-limit"
    | "safe-tool-limit";
  explanation: string;
  pricingVersion: typeof PRICING_VERSION;
}

export type RemoteSupportPricingResult =
  | RemoteSupportQuotedResult
  | RemoteSupportManualReviewResult;

function manualReviewResult(
  argumentsValue: RemoteSupportQuoteArguments,
  reasonCode: RemoteSupportManualReviewResult["reasonCode"],
  explanation: string,
): RemoteSupportManualReviewResult {
  return {
    status: "manual-review",
    service: argumentsValue.service,
    currency: argumentsValue.currency,
    quantity: argumentsValue.quantity,
    reasonCode,
    explanation,
    pricingVersion: PRICING_VERSION,
  };
}

function isPhotoEditingSupportService(
  service: RemoteSupportPricingServiceId,
): service is PhotoEditingSupportServiceId {
  return service in PHOTO_EDITING_SERVICE_OPTION_IDS;
}

function isFloorPlanSupportService(
  service: RemoteSupportPricingServiceId,
): service is FloorPlanSupportServiceId {
  return service in FLOOR_PLAN_SERVICE_TYPE_IDS;
}

function buildCanonicalPricingInput(
  argumentsValue: RemoteSupportQuoteArguments,
): OrderPricingInput {
  const { service, quantity, currency } = argumentsValue;

  if (service === "virtual-staging") {
    return {
      serviceType: "virtual-staging",
      currency,
      items: Array.from({ length: quantity }, () => ({
        selectedAddons: argumentsValue.addons ?? [],
      })),
    };
  }

  if (service === "virtual-renovation") {
    const renovationOptions = argumentsValue.renovation_options ?? [];
    const selectedInternal = renovationOptions.filter(
      (option) => option in RENOVATION_INTERNAL_PRICE_KEYS,
    );
    const selectedExternal = renovationOptions.filter(
      (option) => option in RENOVATION_EXTERNAL_PRICE_KEYS,
    );
    return {
      serviceType: "virtual-renovation",
      currency,
      items: Array.from({ length: quantity }, () => ({
        selectedInternal,
        selectedExternal,
      })),
    };
  }

  if (isFloorPlanSupportService(service)) {
    return {
      serviceType: "3d-floor-plans",
      currency,
      items: [
        {
          planType: FLOOR_PLAN_SERVICE_TYPE_IDS[service],
          numberOfFloors: quantity,
        },
      ],
    };
  }

  if (isPhotoEditingSupportService(service)) {
    const optionId = Object.entries(PHOTO_EDIT_PRICE_KEYS).find(
      ([, priceKey]) =>
        priceKey === PHOTO_EDITING_SERVICE_OPTION_IDS[service],
    )?.[0];
    if (!optionId) {
      throw new SupportPricingToolValidationError([
        "service: The selected service cannot be represented safely.",
      ]);
    }
    return {
      serviceType: "photo-editing",
      currency,
      items: Array.from({ length: quantity }, () => ({
        selectedOptions: [optionId],
        baseOptionId: optionId,
      })),
    };
  }

  throw new SupportPricingToolValidationError([
    "service: The selected service cannot be represented safely.",
  ]);
}

function lineItemsFromQuote(
  service: RemoteSupportPricingServiceId,
  quantity: number,
  quote: OrderQuote,
): SupportPricingLineItem[] {
  const firstItem = quote.items[0];
  if (!firstItem) return [];

  if (service === "virtual-staging") {
    return [
      {
        id: "virtual-staging",
        quantity,
        unitPriceCents: firstItem.unitPriceCents,
        subtotalCents: quote.baseSubtotalCents,
      },
      ...firstItem.addOns.map((addOn) => ({
        id: addOn.id,
        quantity,
        unitPriceCents: addOn.unitPriceCents,
        subtotalCents: addOn.unitPriceCents * quantity,
      })),
    ];
  }

  if (service === "virtual-renovation") {
    return firstItem.addOns.map((option) => ({
      id: option.id,
      quantity,
      unitPriceCents: option.unitPriceCents,
      subtotalCents: option.unitPriceCents * quantity,
    }));
  }

  return [
    {
      id: service,
      quantity,
      unitPriceCents: firstItem.unitPriceCents,
      subtotalCents: quote.baseSubtotalCents,
    },
  ];
}

function quotedResultFromCanonicalQuote(
  argumentsValue: RemoteSupportQuoteArguments,
  quote: OrderQuote,
): RemoteSupportQuotedResult {
  if (quote.subtotalAfterDiscountCents === null) {
    throw new SupportPricingToolValidationError([
      "quantity: The canonical calculator requires a custom quote.",
    ]);
  }

  const excluded = argumentsValue.service === "virtual-renovation";
  return {
    status: "quoted",
    quoteKind: excluded ? "preliminary" : "estimate",
    service: argumentsValue.service,
    currency: argumentsValue.currency,
    quantity: argumentsValue.quantity,
    unitPriceCents:
      argumentsValue.service === "virtual-renovation"
        ? null
        : (quote.items[0]?.unitPriceCents ?? null),
    baseSubtotalCents: quote.baseSubtotalCents,
    addOnSubtotalCents: quote.addOnSubtotalCents,
    discountEligibility: excluded ? "excluded" : "eligible",
    discountExplanation: excluded
      ? "Virtual Renovation is excluded from automatic volume discounts."
      : quote.volumeDiscountPercent === 0
        ? "Eligible for standard volume discounts; no discount applies at this quantity."
        : `The canonical ${quote.volumeDiscountPercent}% volume discount applies to the eligible base subtotal only.`,
    discountPercent: quote.volumeDiscountPercent,
    discountAmountCents: quote.volumeDiscountCents,
    finalSubtotalBeforeTaxCents: quote.subtotalAfterDiscountCents,
    taxCalculated: false,
    currencyPolicy: "fixed-catalog-prices-not-live-conversion",
    pricingVersion: PRICING_VERSION,
    lineItems: lineItemsFromQuote(
      argumentsValue.service,
      argumentsValue.quantity,
      quote,
    ),
  };
}

function quote360Service(
  argumentsValue: RemoteSupportQuoteArguments & {
    service: "360-image-enhancement" | "360-virtual-staging";
  },
): RemoteSupportQuotedResult {
  const unitPriceCents = getCatalogPrice(
    argumentsValue.service,
    argumentsValue.currency,
  );
  const subtotalCents = unitPriceCents * argumentsValue.quantity;
  return {
    status: "quoted",
    quoteKind: "estimate",
    service: argumentsValue.service,
    currency: argumentsValue.currency,
    quantity: argumentsValue.quantity,
    unitPriceCents,
    baseSubtotalCents: subtotalCents,
    addOnSubtotalCents: 0,
    discountEligibility: "excluded",
    discountExplanation:
      "360-degree services are excluded from standard volume discounts.",
    discountPercent: 0,
    discountAmountCents: 0,
    finalSubtotalBeforeTaxCents: subtotalCents,
    taxCalculated: false,
    currencyPolicy: "fixed-catalog-prices-not-live-conversion",
    pricingVersion: PRICING_VERSION,
    lineItems: [
      {
        id: argumentsValue.service,
        quantity: argumentsValue.quantity,
        unitPriceCents,
        subtotalCents,
      },
    ],
  };
}

export function getRemoteServiceQuote(
  rawArguments: unknown,
): RemoteSupportPricingResult {
  const argumentsValue = parseRemoteSupportQuoteArguments(rawArguments);

  if (argumentsValue.quantity > 500) {
    return manualReviewResult(
      argumentsValue,
      "safe-tool-limit",
      "This quantity is outside the safe scope of the automated read-only pricing tool and requires manual review.",
    );
  }

  if (
    isFloorPlanSupportService(argumentsValue.service) &&
    argumentsValue.quantity > 20
  ) {
    return manualReviewResult(
      argumentsValue,
      "calculator-quantity-limit",
      "The canonical floor-plan calculator supports up to 20 floors per quote; this request requires manual review.",
    );
  }

  if (
    (argumentsValue.service === "virtual-staging" ||
      isPhotoEditingSupportService(argumentsValue.service) ||
      isFloorPlanSupportService(argumentsValue.service)) &&
    argumentsValue.quantity >= 50
  ) {
    return manualReviewResult(
      argumentsValue,
      "custom-quote-quantity",
      "Orders of 50 or more eligible images or floors require a custom quote.",
    );
  }

  if (
    argumentsValue.service === "360-image-enhancement" ||
    argumentsValue.service === "360-virtual-staging"
  ) {
    return quote360Service(
      argumentsValue as RemoteSupportQuoteArguments & {
        service: "360-image-enhancement" | "360-virtual-staging";
      },
    );
  }

  return quotedResultFromCanonicalQuote(
    argumentsValue,
    calculateOrderQuote(buildCanonicalPricingInput(argumentsValue)),
  );
}

export interface LocalSupportPricingResult {
  status: "priced" | "quote-only";
  service: (typeof LOCAL_PRICING_SERVICE_IDS)[number];
  currency: "EUR";
  serviceLabel: string;
  overviewPriceLabel: string;
  packages: Array<{
    id: string;
    packageLabel: string | null;
    priceCents: number;
    priceQualifier: "fixed" | "from";
    qualificationText: string | null;
  }>;
  extraUnit: {
    id: string;
    priceCents: number;
    unit: "edited-photo";
    qualificationText: string | null;
  } | null;
  remoteVolumeDiscountsApplied: false;
}

export function getLocalServicePricing(
  rawArguments: unknown,
): LocalSupportPricingResult {
  const argumentsValue = parseLocalSupportPricingArguments(rawArguments);
  const entry = getLocalPricingEntry(argumentsValue.service);
  const presentation = getLocalPricingPresentation(
    argumentsValue.service,
    "en",
    true,
  );

  if (entry.kind === "quote-only") {
    return {
      status: "quote-only",
      service: argumentsValue.service,
      currency: "EUR",
      serviceLabel: presentation.serviceLabel,
      overviewPriceLabel: presentation.overviewPriceLabel,
      packages: [],
      extraUnit: null,
      remoteVolumeDiscountsApplied: false,
    };
  }

  const packageRows = presentation.rows.slice(0, entry.packages.length);
  const extraRow = entry.extraUnit
    ? presentation.rows.find((row) => row.id === entry.extraUnit?.id)
    : null;
  return {
    status: "priced",
    service: argumentsValue.service,
    currency: "EUR",
    serviceLabel: presentation.serviceLabel,
    overviewPriceLabel: presentation.overviewPriceLabel,
    packages: entry.packages.map((item, index) => ({
      id: item.id,
      packageLabel: packageRows[index]?.packageLabel ?? null,
      priceCents: item.priceCents,
      priceQualifier: item.priceQualifier,
      qualificationText: packageRows[index]?.detailLabel ?? null,
    })),
    extraUnit: entry.extraUnit
      ? {
          id: entry.extraUnit.id,
          priceCents: entry.extraUnit.priceCents,
          unit: entry.extraUnit.unit,
          qualificationText: extraRow?.detailLabel ?? null,
        }
      : null,
    remoteVolumeDiscountsApplied: false,
  };
}

export type SupportPricingToolResult =
  | RemoteSupportPricingResult
  | LocalSupportPricingResult;

export function executeSupportPricingTool(
  name: string,
  rawArguments: unknown,
): SupportPricingToolResult {
  switch (name) {
    case "get_remote_service_quote":
      return getRemoteServiceQuote(rawArguments);
    case "get_local_service_pricing":
      return getLocalServicePricing(rawArguments);
    default:
      throw new UnknownSupportPricingToolError();
  }
}

export const GEMINI_SUPPORT_PRICING_TOOLS: Interactions.Tool[] = [
  {
    type: "function",
    name: "get_remote_service_quote",
    description:
      "Returns authoritative current PicchuSpot pricing for a supported remote service when the customer asks for a current price, discount, or calculated quote. Do not call it for general service-selection or policy questions. Virtual Staging add-ons and Virtual Renovation options apply uniformly to every requested image.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        service: {
          type: "string",
          enum: REMOTE_SUPPORT_PRICING_SERVICE_IDS,
          description: "The supported PicchuSpot remote service to price.",
        },
        quantity: {
          type: "integer",
          minimum: 1,
          description: "Exact number of images or floors to price.",
        },
        currency: {
          type: "string",
          enum: TRANSACTIONAL_CURRENCIES,
          description:
            "Official fixed-price currency. Unsupported currencies must not be converted.",
        },
        addons: {
          type: "array",
          uniqueItems: true,
          items: { type: "string", enum: STAGING_ADDON_IDS },
          description:
            "Optional Virtual Staging add-ons applied to every image. Omit for other services.",
        },
        renovation_options: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: { type: "string", enum: RENOVATION_OPTION_IDS },
          description:
            "Required only for Virtual Renovation. The selected options apply to every image.",
        },
      },
      required: ["service", "quantity", "currency"],
    },
  },
  {
    type: "function",
    name: "get_local_service_pricing",
    description:
      "Returns authoritative canonical EUR pricing for a supported local Alicante or Costa Blanca service when the customer asks for its current local price. Do not call it for non-pricing questions.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        service: {
          type: "string",
          enum: LOCAL_PRICING_SERVICE_IDS,
          description: "The supported local service to price in EUR.",
        },
      },
      required: ["service"],
    },
  },
];
