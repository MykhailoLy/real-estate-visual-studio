export type VirtualRenovationScreen = "overview" | "configure" | "review";

/** A draft URL restores the form directly; the overview is for fresh orders. */
export function getInitialVirtualRenovationScreen(
  requestedDraftId: string | null,
): VirtualRenovationScreen {
  return requestedDraftId ? "configure" : "overview";
}
