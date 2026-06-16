// ============================================================
// DASHBOARD SCROLL HELPERS
//
// The client dashboard owns exactly ONE intended vertical page-scroll
// container: `ClientDashboardLayout`'s <main>, tagged with
// `data-dashboard-scroll-container`. The browser/body itself does not
// scroll the portal shell, so `window.scrollTo` is NOT the right tool
// for moving the order flow between steps — we must scroll that main
// container (falling back to the window only if the attribute is ever
// missing, e.g. an order form rendered outside the dashboard).
// ============================================================

export const DASHBOARD_SCROLL_ATTR = "data-dashboard-scroll-container";
const DASHBOARD_SCROLL_SELECTOR = `[${DASHBOARD_SCROLL_ATTR}]`;

/** The dashboard's single scroll container, or null when unavailable. */
export function getDashboardScrollContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(DASHBOARD_SCROLL_SELECTOR);
}

/**
 * Scroll the dashboard main container back to the top. Used on step
 * transitions (Configure ↔ Review) where the dashboard main element —
 * not the window — owns scrolling.
 */
export function scrollDashboardToTop(behavior: ScrollBehavior = "smooth"): void {
  const container = getDashboardScrollContainer();
  if (container) {
    container.scrollTo({ top: 0, behavior });
    return;
  }
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior });
  }
}

/**
 * Scroll a specific element (by id) into view inside the dashboard main
 * container. Used when returning to Configure to edit a specific photo
 * card. `scrollIntoView` automatically targets the nearest scrollable
 * ancestor, which is the tagged dashboard main container.
 */
export function scrollElementIntoViewWithinDashboard(
  elementId: string,
  behavior: ScrollBehavior = "smooth"
): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(elementId);
  if (el) el.scrollIntoView({ behavior, block: "start" });
}
