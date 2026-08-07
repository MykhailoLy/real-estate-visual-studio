import "server-only";

import { createServerClient } from "@/lib/supabase";
import {
  type PropertyAnalyticsDependencies,
  type PropertyAnalyticsEvent,
  type PublishedPropertyAnalyticsContext,
} from "./property-analytics";
import {
  getPropertyAnalyticsSummary,
  type PropertyAnalyticsRepository,
  type PropertyAnalyticsSummaryResult,
} from "./property-analytics-dashboard";
import { PropertyShowcaseSchema } from "./schema";

const ANALYTICS_RATE_LIMIT_WINDOW_MS = 60_000;
const ANALYTICS_RATE_LIMIT_MAX_EVENTS = 120;
const QUERY_PAGE_SIZE = 1_000;

type PropertyRow = {
  id: string;
  slug: string;
  content: unknown;
  published: boolean;
};

type TimestampRow = { created_at: string };

const analyticsRateLimitWindows = new Map<
  string,
  { count: number; resetAt: number }
>();

export function isPropertyAnalyticsSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function checkPropertyAnalyticsRateLimit(
  propertySlug: string,
  now = Date.now(),
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const existing = analyticsRateLimitWindows.get(propertySlug);
  const window =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + ANALYTICS_RATE_LIMIT_WINDOW_MS }
      : existing;

  if (window.count >= ANALYTICS_RATE_LIMIT_MAX_EVENTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  window.count += 1;
  analyticsRateLimitWindows.set(propertySlug, window);
  return { allowed: true };
}

async function findPublishedProperty(
  slug: string,
): Promise<PublishedPropertyAnalyticsContext | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("property_showcases")
    .select("id, slug, content, published")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) throw new Error(`Property lookup failed: ${error.code}`);
  if (!data) return null;

  const row = data as PropertyRow;
  const property = PropertyShowcaseSchema.safeParse(row.content);
  if (!property.success || property.data.slug !== row.slug || !row.published) {
    return null;
  }

  return { id: row.id, slug: row.slug };
}

async function insertEvent(input: {
  propertyId: string;
  propertySlug: string;
  event: PropertyAnalyticsEvent;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("property_analytics_events").insert({
    property_id: input.propertyId,
    property_slug: input.propertySlug,
    event_type: input.event,
  });
  if (error) throw new Error(`Analytics insert failed: ${error.code}`);
}

export function createPropertyAnalyticsDependencies(): PropertyAnalyticsDependencies {
  return {
    checkRateLimit: ({ propertySlug }) =>
      Promise.resolve(checkPropertyAnalyticsRateLimit(propertySlug)),
    findPublishedProperty,
    insertEvent,
    logError: (message, details) => {
      console.error(message, details);
    },
  };
}

function withStartAt<T extends { gte: (column: string, value: string) => T }>(
  query: T,
  startAt: string | null,
): T {
  return startAt ? query.gte("created_at", startAt) : query;
}

async function countEvent(input: {
  propertyId: string;
  event: PropertyAnalyticsEvent;
  startAt: string | null;
}): Promise<number> {
  const supabase = createServerClient();
  const { count, error } = await withStartAt(
    supabase
      .from("property_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("property_id", input.propertyId)
      .eq("event_type", input.event),
    input.startAt,
  );
  if (error) throw new Error(`Analytics count failed: ${error.code}`);
  return count ?? 0;
}

async function countEnquiries(input: {
  propertyId: string;
  startAt: string | null;
}): Promise<number> {
  const supabase = createServerClient();
  const { count, error } = await withStartAt(
    supabase
      .from("property_leads")
      .select("id", { count: "exact", head: true })
      .eq("property_id", input.propertyId),
    input.startAt,
  );
  if (error) throw new Error(`Property lead count failed: ${error.code}`);
  return count ?? 0;
}

async function listTimestamps(input: {
  table: "property_analytics_events" | "property_leads";
  propertyId: string;
  startAt: string | null;
  event?: PropertyAnalyticsEvent;
}): Promise<string[]> {
  const supabase = createServerClient();
  const timestamps: string[] = [];

  for (let offset = 0; ; offset += QUERY_PAGE_SIZE) {
    let query = supabase
      .from(input.table)
      .select("created_at")
      .eq("property_id", input.propertyId)
      .order("created_at", { ascending: true })
      .range(offset, offset + QUERY_PAGE_SIZE - 1);
    if (input.event) query = query.eq("event_type", input.event);
    if (input.startAt) query = query.gte("created_at", input.startAt);

    const { data, error } = await query;
    if (error) throw new Error(`Analytics activity query failed: ${error.code}`);
    const rows = (data ?? []) as TimestampRow[];
    timestamps.push(...rows.map((row) => row.created_at));
    if (rows.length < QUERY_PAGE_SIZE) return timestamps;
  }
}

function createPropertyAnalyticsRepository(): PropertyAnalyticsRepository {
  return {
    countEvent,
    countEnquiries,
    listPageViewCreatedAt: (input) =>
      listTimestamps({ ...input, table: "property_analytics_events", event: "property_page_viewed" }),
    listEnquiryCreatedAt: (input) =>
      listTimestamps({ ...input, table: "property_leads" }),
  };
}

export async function getPropertyAnalyticsForAdmin(input: {
  propertyId: string;
  period?: string;
}): Promise<PropertyAnalyticsSummaryResult> {
  return getPropertyAnalyticsSummary({
    configured: isPropertyAnalyticsSupabaseConfigured(),
    propertyId: input.propertyId,
    period: input.period,
    repository: createPropertyAnalyticsRepository(),
  });
}
