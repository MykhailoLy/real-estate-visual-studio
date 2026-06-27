import type { OrderDraftClientErrorCode } from "./client.ts";

export function removeDraftSummaryById<T extends { id: string }>(
  drafts: readonly T[],
  draftId: string,
): T[] {
  return drafts.filter((draft) => draft.id !== draftId);
}

export function shouldRefreshDraftListAfterDeleteError(
  code: OrderDraftClientErrorCode,
): boolean {
  return (
    code === "version_conflict" ||
    code === "not_found" ||
    code === "invalid_status"
  );
}
