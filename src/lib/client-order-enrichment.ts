export const SUB_SERVICE_ENRICHMENT_TIMEOUT_MS = 1_250;

export interface SubServiceEnrichmentTarget {
  id: string;
  sub_service?: string | null;
}

export interface SubServiceEnrichmentRow {
  order_id: string;
  details: Record<string, unknown> | null;
}

export interface SubServiceLookupResult {
  rows: SubServiceEnrichmentRow[];
  errorMessage: string | null;
}

type SubServiceLookup = (
  orderIds: string[],
  signal: AbortSignal,
) => Promise<SubServiceLookupResult>;

interface EnrichmentOptions {
  timeoutMs?: number;
  warn?: (message: string) => void;
}

/** Best-effort cosmetic enrichment. Owned order summaries remain authoritative. */
export async function enrichOrderSubServices(
  orders: SubServiceEnrichmentTarget[],
  lookup: SubServiceLookup,
  options: EnrichmentOptions = {},
): Promise<void> {
  if (orders.length === 0) return;

  const timeoutMs =
    options.timeoutMs ?? SUB_SERVICE_ENRICHMENT_TIMEOUT_MS;
  const warn = options.warn ?? console.warn;

  try {
    const { rows, errorMessage } = await lookup(
      orders.map((order) => order.id),
      AbortSignal.timeout(timeoutMs),
    );

    if (errorMessage) {
      warn("[client-orders] sub_service lookup skipped: request failed");
      return;
    }

    const byOrder = new Map<string, string | null>();
    for (const row of rows) {
      const subService = row.details?.sub_service;
      byOrder.set(
        row.order_id,
        typeof subService === "string" ? subService : null,
      );
    }

    for (const order of orders) {
      order.sub_service = byOrder.get(order.id) ?? null;
    }
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    warn(
      `[client-orders] sub_service lookup skipped: ${timedOut ? "timed out" : "request failed"}`,
    );
  }
}
