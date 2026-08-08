"use client";

import type { PropertyAnalyticsEvent } from "./property-analytics.ts";

type AnalyticsFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function postPropertyAnalyticsEvent(
  input: {
    propertySlug: string;
    event: PropertyAnalyticsEvent;
  },
  fetchImpl: AnalyticsFetch = fetch,
): Promise<void> {
  try {
    await fetchImpl("/api/property-analytics", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertySlug: input.propertySlug,
        event: input.event,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt a visitor action.
  }
}

export function trackPropertyEvent(input: {
  propertySlug: string;
  event: PropertyAnalyticsEvent;
}): void {
  void postPropertyAnalyticsEvent(input);
}
