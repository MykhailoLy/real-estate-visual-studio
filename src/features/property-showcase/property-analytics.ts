import { z } from "zod";

export const PROPERTY_ANALYTICS_EVENTS = [
  "property_page_viewed",
  "request_viewing_opened",
  "agent_whatsapp_clicked",
  "agent_phone_clicked",
  "agent_email_clicked",
  "gallery_opened",
  "property_shared",
  "floor_plan_downloaded",
  "brochure_downloaded",
  "video_started",
  "virtual_tour_opened",
  "interactive_floor_plan_opened",
] as const;

export type PropertyAnalyticsEvent = (typeof PROPERTY_ANALYTICS_EVENTS)[number];

const PropertySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const PropertyAnalyticsInputSchema = z
  .object({
    propertySlug: PropertySlugSchema,
    event: z.enum(PROPERTY_ANALYTICS_EVENTS),
  })
  .strict();

export type PropertyAnalyticsInput = z.infer<typeof PropertyAnalyticsInputSchema>;

export interface PublishedPropertyAnalyticsContext {
  id: string;
  slug: string;
}

export interface PropertyAnalyticsDependencies {
  checkRateLimit(input: {
    propertySlug: string;
  }): Promise<
    | { allowed: true }
    | { allowed: false; retryAfterSeconds: number }
  >;
  findPublishedProperty(
    slug: string,
  ): Promise<PublishedPropertyAnalyticsContext | null>;
  insertEvent(input: {
    propertyId: string;
    propertySlug: string;
    event: PropertyAnalyticsEvent;
  }): Promise<void>;
  logError?: (message: string, error?: unknown) => void;
}

const MAX_ANALYTICS_REQUEST_BODY_BYTES = 512;

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers });
}

export async function handlePropertyAnalyticsRequest(
  request: Request,
  dependencies: PropertyAnalyticsDependencies,
): Promise<Response> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return jsonError("Invalid analytics request.", 400);
  }

  if (new TextEncoder().encode(text).byteLength > MAX_ANALYTICS_REQUEST_BODY_BYTES) {
    return jsonError("Analytics request is too large.", 413);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return jsonError("Invalid analytics request.", 400);
  }

  const parsed = PropertyAnalyticsInputSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Unsupported analytics event.", 400);
  }
  const input = parsed.data;

  let rateLimit;
  try {
    rateLimit = await dependencies.checkRateLimit({
      propertySlug: input.propertySlug,
    });
  } catch (error) {
    dependencies.logError?.("property-analytics: rate limit unavailable", error);
    return jsonError("Analytics are temporarily unavailable.", 503);
  }
  if (!rateLimit.allowed) {
    return jsonError("Too many analytics events. Please try again later.", 429, {
      "Retry-After": String(Math.max(1, rateLimit.retryAfterSeconds)),
    });
  }

  let property: PublishedPropertyAnalyticsContext | null;
  try {
    property = await dependencies.findPublishedProperty(input.propertySlug);
  } catch (error) {
    dependencies.logError?.("property-analytics: property lookup failed", error);
    return jsonError("Analytics are temporarily unavailable.", 503);
  }
  if (!property) {
    return jsonError("Published property not found.", 404);
  }

  try {
    await dependencies.insertEvent({
      propertyId: property.id,
      propertySlug: property.slug,
      event: input.event,
    });
  } catch (error) {
    dependencies.logError?.("property-analytics: insert failed", error);
    return jsonError("Analytics are temporarily unavailable.", 503);
  }

  return Response.json({ ok: true }, { status: 202 });
}

export function shouldTrackPropertyAnalytics(previewMode: boolean): boolean {
  return !previewMode;
}
