export interface OrderImageNavigationItem {
  id: string;
  targetId: string;
}

export function buildOrderImageNavigationItems<T>(
  items: readonly T[],
  getStableId: (item: T, index: number) => string,
  getTargetId: (item: T, index: number) => string,
): OrderImageNavigationItem[] {
  return items.map((item, index) => ({
    id: getStableId(item, index),
    targetId: getTargetId(item, index),
  }));
}

export function resolveOrderImageTarget(
  items: readonly OrderImageNavigationItem[],
  itemId: string,
): string | null {
  return items.find((item) => item.id === itemId)?.targetId ?? null;
}

export function shouldShowOrderImageNavigator(itemCount: number): boolean {
  return itemCount > 1;
}

interface OrderImagePosition {
  id: string | null;
  top: number;
}

interface ActiveOrderImageSelectionOptions {
  workingLine?: number;
  isAtScrollEnd?: boolean;
}

export function selectActiveOrderImageId(
  positions: readonly OrderImagePosition[],
  {
    workingLine = 0,
    isAtScrollEnd = false,
  }: ActiveOrderImageSelectionOptions = {},
): string | null {
  const candidates = positions.filter(
    (position): position is OrderImagePosition & { id: string } =>
      position.id !== null,
  );

  if (candidates.length === 0) return null;
  if (isAtScrollEnd) return candidates.at(-1)?.id ?? null;

  return candidates.reduce((selected, candidate) => {
    const selectedDistance = Math.abs(selected.top - workingLine);
    const candidateDistance = Math.abs(candidate.top - workingLine);

    if (candidateDistance < selectedDistance) return candidate;
    if (
      candidateDistance === selectedDistance &&
      candidate.top >= workingLine &&
      selected.top < workingLine
    ) {
      return candidate;
    }

    return selected;
  }).id;
}
