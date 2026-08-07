import {
  PROPERTY_ANALYTICS_EVENTS,
  type PropertyAnalyticsEvent,
} from "./property-analytics.ts";

export const PROPERTY_ANALYTICS_PERIODS = ["7d", "30d", "90d", "all"] as const;

export type PropertyAnalyticsPeriod = (typeof PROPERTY_ANALYTICS_PERIODS)[number];

export interface PropertyAnalyticsTimeRange {
  key: PropertyAnalyticsPeriod;
  label: "7 days" | "30 days" | "90 days" | "All time";
  startAt: string | null;
}

export interface PropertyAnalyticsRepository {
  countEvent(input: {
    propertyId: string;
    event: PropertyAnalyticsEvent;
    startAt: string | null;
  }): Promise<number>;
  countEnquiries(input: {
    propertyId: string;
    startAt: string | null;
  }): Promise<number>;
  listPageViewCreatedAt(input: {
    propertyId: string;
    startAt: string | null;
  }): Promise<string[]>;
  listEnquiryCreatedAt(input: {
    propertyId: string;
    startAt: string | null;
  }): Promise<string[]>;
}

export interface PropertyAnalyticsActivityDay {
  date: string;
  pageViews: number;
  enquiries: number;
}

export interface PropertyAnalyticsSummary {
  state: "ready";
  range: PropertyAnalyticsTimeRange;
  eventCounts: Record<PropertyAnalyticsEvent, number>;
  enquiryCount: number;
  activity: PropertyAnalyticsActivityDay[];
}

export type PropertyAnalyticsSummaryResult =
  | PropertyAnalyticsSummary
  | { state: "unconfigured" | "unavailable" };

export function resolvePropertyAnalyticsPeriod(
  value: string | undefined,
  now = new Date(),
): PropertyAnalyticsTimeRange {
  const key = PROPERTY_ANALYTICS_PERIODS.includes(
    value as PropertyAnalyticsPeriod,
  )
    ? (value as PropertyAnalyticsPeriod)
    : "30d";

  const days = key === "7d" ? 7 : key === "30d" ? 30 : key === "90d" ? 90 : 0;
  const startAt = days
    ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  return {
    key,
    label: key === "7d" ? "7 days" : key === "30d" ? "30 days" : key === "90d" ? "90 days" : "All time",
    startAt,
  };
}

function emptyEventCounts(): Record<PropertyAnalyticsEvent, number> {
  return Object.fromEntries(
    PROPERTY_ANALYTICS_EVENTS.map((event) => [event, 0]),
  ) as Record<PropertyAnalyticsEvent, number>;
}

function utcDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function buildActivity(
  pageViews: readonly string[],
  enquiries: readonly string[],
): PropertyAnalyticsActivityDay[] {
  const days = new Map<string, PropertyAnalyticsActivityDay>();

  for (const timestamp of pageViews) {
    const date = utcDate(timestamp);
    if (!date) continue;
    const current = days.get(date) ?? { date, pageViews: 0, enquiries: 0 };
    current.pageViews += 1;
    days.set(date, current);
  }

  for (const timestamp of enquiries) {
    const date = utcDate(timestamp);
    if (!date) continue;
    const current = days.get(date) ?? { date, pageViews: 0, enquiries: 0 };
    current.enquiries += 1;
    days.set(date, current);
  }

  return [...days.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

export async function getPropertyAnalyticsSummary(input: {
  configured: boolean;
  propertyId: string;
  period?: string;
  repository?: PropertyAnalyticsRepository;
  now?: Date;
}): Promise<PropertyAnalyticsSummaryResult> {
  if (!input.configured || !input.repository) {
    return { state: "unconfigured" };
  }

  const range = resolvePropertyAnalyticsPeriod(input.period, input.now);
  try {
    const eventCountResults = await Promise.all(
      PROPERTY_ANALYTICS_EVENTS.map(async (event) => [
        event,
        await input.repository!.countEvent({
          propertyId: input.propertyId,
          event,
          startAt: range.startAt,
        }),
      ] as const),
    );
    const [enquiryCount, pageViews, enquiries] = await Promise.all([
      input.repository.countEnquiries({
        propertyId: input.propertyId,
        startAt: range.startAt,
      }),
      input.repository.listPageViewCreatedAt({
        propertyId: input.propertyId,
        startAt: range.startAt,
      }),
      input.repository.listEnquiryCreatedAt({
        propertyId: input.propertyId,
        startAt: range.startAt,
      }),
    ]);

    return {
      state: "ready",
      range,
      eventCounts: {
        ...emptyEventCounts(),
        ...Object.fromEntries(eventCountResults),
      },
      enquiryCount,
      activity: buildActivity(pageViews, enquiries),
    };
  } catch {
    return { state: "unavailable" };
  }
}

export function percentageOf(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}
