import { safeInternalPath } from "./safe-redirect.ts";

export const DASHBOARD_REQUEST_PATH_HEADER =
  "x-picchuspot-dashboard-destination";

const DEFAULT_DASHBOARD_PATH = "/dashboard";

/**
 * Keep login recovery inside the client portal and omit Next's internal RSC
 * cache-buster while preserving user-facing query parameters.
 */
export function safeDashboardRequestPath(
  raw: string | null | undefined,
): string {
  const candidate = safeInternalPath(raw, DEFAULT_DASHBOARD_PATH);

  try {
    const parsed = new URL(candidate, "https://picchuspot.internal");
    if (
      parsed.pathname !== DEFAULT_DASHBOARD_PATH &&
      !parsed.pathname.startsWith(`${DEFAULT_DASHBOARD_PATH}/`)
    ) {
      return DEFAULT_DASHBOARD_PATH;
    }

    parsed.searchParams.delete("_rsc");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return DEFAULT_DASHBOARD_PATH;
  }
}
