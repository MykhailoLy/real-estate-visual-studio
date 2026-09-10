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

export function selectActiveOrderImageId(
  entries: readonly { id: string | null; isIntersecting: boolean; top: number }[],
): string | null {
  return (
    entries
      .filter((entry) => entry.isIntersecting && entry.id !== null)
      .sort((left, right) => Math.abs(left.top) - Math.abs(right.top))[0]?.id ??
    null
  );
}
