import { z } from "zod";
import { canonicalPropertyUrl } from "./sharing.ts";
import type { PropertyLanguageCode, PropertyShowcase } from "./types.ts";

const OptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !value.includes("\0"), "Text contains an invalid character.")
    .optional()
    .default("");

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const PropertyLeadInputSchema = z
  .object({
    propertySlug: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    locale: z.enum(["en", "es", "de", "fr", "nl", "pl", "uk", "ru"]),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    phone: OptionalText(40),
    preferredDate: OptionalText(10).refine(
      (value) => !value || isCalendarDate(value),
      "Preferred date must use YYYY-MM-DD.",
    ),
    preferredTime: OptionalText(5).refine(
      (value) => !value || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value),
      "Preferred time must use HH:MM.",
    ),
    message: OptionalText(2000),
    website: OptionalText(200),
    turnstileToken: OptionalText(4096),
  })
  .strict();

export type PropertyLeadInput = z.infer<typeof PropertyLeadInputSchema>;

export type PropertyLeadNotificationStatus = "sent" | "failed" | "skipped";

export interface PublishedPropertyLeadContext {
  id: string;
  property: PropertyShowcase;
}

export interface PropertyLeadInsert {
  propertyId: string;
  propertySlug: string;
  name: string;
  email: string;
  phone?: string;
  preferredDate?: string;
  preferredTime?: string;
  message?: string;
  locale: PropertyLanguageCode;
  source: "property-showcase";
  notificationEmailStatus: "pending";
}

export interface PropertyLeadNotificationInput {
  leadId: string;
  property: PropertyShowcase;
  applicant: PropertyLeadInput;
  recipientEmail?: string;
  publicUrl: string;
  receivedAt: string;
}

export interface PropertyLeadDependencies {
  checkRateLimit(request: Request): Promise<
    | { allowed: true }
    | { allowed: false; retryAfterSeconds: number }
  >;
  verifySpam(input: {
    request: Request;
    token: string;
  }): Promise<"valid" | "invalid" | "unavailable">;
  findPublishedProperty(
    slug: string,
  ): Promise<PublishedPropertyLeadContext | null>;
  insertLead(input: PropertyLeadInsert): Promise<{ id: string }>;
  updateNotification(input: {
    leadId: string;
    status: PropertyLeadNotificationStatus;
    error?: string;
  }): Promise<void>;
  sendNotification(input: PropertyLeadNotificationInput): Promise<{
    status: PropertyLeadNotificationStatus;
    error?: string;
  }>;
  now?: () => Date;
  logError?: (message: string, error?: unknown) => void;
}

function optional(value: string): string | undefined {
  return value || undefined;
}

function firstName(name: string): string {
  return name.split(/\s+/).filter(Boolean)[0] ?? name;
}

export function propertyLeadWhatsAppUrl(input: {
  whatsapp?: string;
  applicantName: string;
  propertyTitle: string;
  publicUrl: string;
  preferredDate?: string;
  preferredTime?: string;
  locale: PropertyLanguageCode;
}): string | undefined {
  const phone = input.whatsapp?.replace(/\D/g, "");
  if (!phone) return undefined;
  const appointment = [input.preferredDate, input.preferredTime]
    .filter(Boolean)
    .join(" ");
  const message = input.locale === "es"
    ? [
        `Hola, soy ${firstName(input.applicantName)}.`,
        `He solicitado una visita para ${input.propertyTitle}.`,
        appointment ? `Fecha/hora preferida: ${appointment}.` : "",
        input.publicUrl,
      ]
    : [
        `Hello, I am ${firstName(input.applicantName)}.`,
        `I requested a viewing for ${input.propertyTitle}.`,
        appointment ? `Preferred date/time: ${appointment}.` : "",
        input.publicUrl,
      ];
  return `https://wa.me/${phone}?text=${encodeURIComponent(
    message.filter(Boolean).join(" "),
  )}`;
}

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers });
}

export async function handlePropertyLeadRequest(
  request: Request,
  dependencies: PropertyLeadDependencies,
): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = PropertyLeadInputSchema.safeParse(raw);
  if (!parsed.success || parsed.data.website) {
    return jsonError("Please check the viewing request fields.", 400);
  }
  const input = parsed.data;

  let rateLimit;
  try {
    rateLimit = await dependencies.checkRateLimit(request);
  } catch (error) {
    dependencies.logError?.("property-leads: rate limit unavailable", error);
    return jsonError("Viewing requests are temporarily unavailable.", 503);
  }
  if (!rateLimit.allowed) {
    return jsonError("Too many viewing requests. Please try again later.", 429, {
      "Retry-After": String(Math.max(1, rateLimit.retryAfterSeconds)),
    });
  }

  let spamResult: "valid" | "invalid" | "unavailable";
  try {
    spamResult = await dependencies.verifySpam({
      request,
      token: input.turnstileToken,
    });
  } catch (error) {
    dependencies.logError?.("property-leads: spam verification failed", error);
    spamResult = "unavailable";
  }
  if (spamResult === "invalid") {
    return jsonError("Security check failed. Please try again.", 400);
  }
  if (spamResult === "unavailable") {
    return jsonError("Security verification is temporarily unavailable.", 503);
  }

  let context: PublishedPropertyLeadContext | null;
  try {
    context = await dependencies.findPublishedProperty(input.propertySlug);
  } catch (error) {
    dependencies.logError?.("property-leads: property lookup failed", error);
    return jsonError("Could not verify this property.", 500);
  }
  if (!context) {
    return jsonError("Published property not found.", 404);
  }

  const property = context.property;
  const publicUrl = canonicalPropertyUrl(property.slug);
  const receivedAt = (dependencies.now?.() ?? new Date()).toISOString();
  let lead: { id: string };
  try {
    lead = await dependencies.insertLead({
      propertyId: context.id,
      propertySlug: property.slug,
      name: input.name,
      email: input.email,
      phone: optional(input.phone),
      preferredDate: optional(input.preferredDate),
      preferredTime: optional(input.preferredTime),
      message: optional(input.message),
      locale: input.locale,
      source: "property-showcase",
      notificationEmailStatus: "pending",
    });
  } catch (error) {
    dependencies.logError?.("property-leads: insert failed", error);
    return jsonError("Could not save the viewing request.", 500);
  }

  let notification: {
    status: PropertyLeadNotificationStatus;
    error?: string;
  };
  try {
    notification = await dependencies.sendNotification({
      leadId: lead.id,
      property,
      applicant: input,
      recipientEmail: property.agent.email?.trim() || undefined,
      publicUrl,
      receivedAt,
    });
  } catch (error) {
    dependencies.logError?.("property-leads: notification failed", error);
    notification = {
      status: "failed",
      error: error instanceof Error ? error.message : "Notification failed.",
    };
  }

  try {
    await dependencies.updateNotification({
      leadId: lead.id,
      status: notification.status,
      error: notification.error,
    });
  } catch (error) {
    dependencies.logError?.("property-leads: status update failed", error);
  }

  const whatsappUrl = propertyLeadWhatsAppUrl({
    whatsapp: property.agent.whatsapp,
    applicantName: input.name,
    propertyTitle:
      property.title[input.locale] ??
      property.title[property.primaryLanguage ?? "en"] ??
      property.title.en,
    publicUrl,
    preferredDate: optional(input.preferredDate),
    preferredTime: optional(input.preferredTime),
    locale: input.locale,
  });

  return Response.json(
    {
      ok: true,
      notificationStatus: notification.status,
      ...(whatsappUrl ? { whatsappUrl } : {}),
    },
    { status: notification.status === "failed" ? 202 : 201 },
  );
}
