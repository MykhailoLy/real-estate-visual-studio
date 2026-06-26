import { z } from "zod";
import { SUPPORTED_REGIONS } from "../currency.ts";
import { TRANSACTIONAL_CURRENCIES } from "../pricing/types.ts";
import {
  ORDER_DRAFT_FILE_KINDS,
  ORDER_DRAFT_FILE_STATUSES,
  ORDER_DRAFT_STATE_SCHEMA_VERSION,
  ORDER_DRAFT_STATUSES,
} from "./constants.ts";
import type { ServiceType } from "../server-validation.ts";
import type { TransactionalServiceType } from "../pricing/types.ts";
import { ORDER_FILES_BUCKET } from "../upload-config.ts";
import type { JsonObject } from "./types.ts";

const JOB_TITLE_MIN = 3;
const JOB_TITLE_MAX = 120;
const SERVICE_TYPES = [
  "virtual-staging",
  "virtual-renovation",
  "3d-floor-plans",
  "photo-editing",
] as const satisfies readonly ServiceType[] & readonly TransactionalServiceType[];

export const UuidSchema = z.uuid();
export const ServiceTypeSchema = z.enum(SERVICE_TYPES);
export const TransactionalCurrencySchema = z.enum(TRANSACTIONAL_CURRENCIES);
export const OrderDraftStatusSchema = z.enum(ORDER_DRAFT_STATUSES);
export const OrderDraftFileStatusSchema = z.enum(ORDER_DRAFT_FILE_STATUSES);
export const OrderDraftFileKindSchema = z.enum(ORDER_DRAFT_FILE_KINDS);
export const RegionCodeSchema = z.enum(SUPPORTED_REGIONS);

export const JobTitleSchema = z
  .string({ message: "Job Title is required" })
  .trim()
  .min(JOB_TITLE_MIN, "Job Title must be at least 3 characters")
  .max(JOB_TITLE_MAX, "Job Title must be at most 120 characters");

export const DraftJobTitleSchema = z
  .string({ message: "Draft Job Title must be a string" })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .max(JOB_TITLE_MAX, "Draft Job Title must be at most 120 characters"),
  );

export const DashboardNewOrderRouteSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^\/dashboard\/orders\/new(?:\/[a-z0-9-]+)*$/,
    "Route must be a dashboard new-order route",
  );

export const JsonPrimitiveSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export type JsonSchemaValue =
  | z.infer<typeof JsonPrimitiveSchema>
  | JsonSchemaValue[]
  | { [key: string]: JsonSchemaValue };

export const JsonValueSchema: z.ZodType<JsonSchemaValue> = z.lazy(() =>
  z.union([
    JsonPrimitiveSchema,
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export const JsonObjectSchema = z.record(z.string(), JsonValueSchema) as z.ZodType<JsonObject>;

export const DraftFileReferenceSchema = z.object({
  draftFileId: UuidSchema,
  kind: OrderDraftFileKindSchema,
  originalFilename: z.string().min(1).max(255).optional(),
});

export const BaseDraftItemSchema = z.object({
  clientItemId: UuidSchema,
  state: JsonObjectSchema.default({}),
  files: z
    .object({
      original: DraftFileReferenceSchema.nullable().optional(),
      reference: DraftFileReferenceSchema.nullable().optional(),
    })
    .optional(),
});

export const BaseDraftStateEnvelopeSchema = z.object({
  schemaVersion: z
    .number()
    .int()
    .min(1)
    .default(ORDER_DRAFT_STATE_SCHEMA_VERSION),
  jobTitle: DraftJobTitleSchema,
  currentStep: z.string().min(1).max(100),
  items: z.array(BaseDraftItemSchema).min(1).max(50),
  notes: z.string().max(5000).optional(),
  termsUi: JsonObjectSchema.optional(),
  metadata: JsonObjectSchema.optional(),
});

export function createDraftStateEnvelopeSchema<T extends z.ZodType<JsonObject>>(
  itemStateSchema: T,
) {
  return BaseDraftStateEnvelopeSchema.extend({
    items: z
      .array(
        BaseDraftItemSchema.extend({
          state: itemStateSchema,
        }),
      )
      .min(1)
      .max(50),
  });
}

export const PricingPreviewSchema = z.object({
  nonAuthoritative: z.literal(true),
  preview: JsonObjectSchema,
});

export const CreateOrderDraftInputSchema = z
  .object({
    serviceType: ServiceTypeSchema,
    subService: z.string().min(1).max(100).nullable().optional(),
    route: DashboardNewOrderRouteSchema,
    title: DraftJobTitleSchema.nullable().optional(),
    currentStep: z.string().min(1).max(100).optional(),
    state: BaseDraftStateEnvelopeSchema,
    pricingPreview: PricingPreviewSchema.nullable().optional(),
    pricingVersionSeen: z.string().min(1).max(100).nullable().optional(),
    currency: TransactionalCurrencySchema,
    region: RegionCodeSchema.nullable().optional(),
  })
  .strict();

export const UpdateOrderDraftInputSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    currentStep: z.string().min(1).max(100).optional(),
    title: DraftJobTitleSchema.nullable().optional(),
    state: BaseDraftStateEnvelopeSchema.optional(),
    pricingPreview: PricingPreviewSchema.nullable().optional(),
    pricingVersionSeen: z.string().min(1).max(100).nullable().optional(),
    currency: TransactionalCurrencySchema.optional(),
    region: RegionCodeSchema.nullable().optional(),
  })
  .strict();

export const OrderDraftStatusTransitionSchema = z
  .object({
    status: OrderDraftStatusSchema,
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const OrderDraftFileRowSchema = z.object({
  id: UuidSchema,
  draftId: UuidSchema,
  itemClientId: UuidSchema,
  itemIndex: z.number().int().nullable(),
  kind: OrderDraftFileKindSchema,
  bucket: z.literal(ORDER_FILES_BUCKET),
  storagePath: z.string().min(1).max(500),
  originalFilename: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(255),
  contentHash: z.string().nullable(),
  uploadStatus: OrderDraftFileStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  movedAt: z.string().datetime().nullable(),
});
