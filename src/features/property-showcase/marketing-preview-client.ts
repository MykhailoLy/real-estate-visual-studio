export const PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS = 400;

export function shouldApplyPropertyMarketingPreview(
  responseSequence: number,
  latestSequence: number,
  aborted: boolean,
): boolean {
  return !aborted && responseSequence === latestSequence;
}
