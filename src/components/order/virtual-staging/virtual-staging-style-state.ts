import { STAGING_STYLE_OPTIONS } from "../../../data/order-options.ts";

export const EMPTY_VIRTUAL_STAGING_FURNITURE_STYLE = "";

export interface FurnitureStyleItem {
  furnitureStyle: string;
}

export interface ExampleMediaSources {
  imageUrl?: string | null;
  beforeUrl?: string | null;
  afterUrl?: string | null;
}

export function isVirtualStagingFurnitureStyle(
  value: unknown,
): value is (typeof STAGING_STYLE_OPTIONS)[number] {
  return (
    typeof value === "string" &&
    (STAGING_STYLE_OPTIONS as readonly string[]).includes(value)
  );
}

/** Derive a safe order default for new and legacy draft state. */
export function deriveVirtualStagingDefaultFurnitureStyle(
  storedDefault: unknown,
  items: readonly FurnitureStyleItem[],
): string {
  if (isVirtualStagingFurnitureStyle(storedDefault)) return storedDefault;

  const firstValidItemStyle = items.find((item) =>
    isVirtualStagingFurnitureStyle(item.furnitureStyle),
  )?.furnitureStyle;

  return firstValidItemStyle ?? EMPTY_VIRTUAL_STAGING_FURNITURE_STYLE;
}

export function countIndividualFurnitureStyles(
  items: readonly FurnitureStyleItem[],
  defaultFurnitureStyle: string,
): number {
  return items.filter(
    (item) => item.furnitureStyle !== defaultFurnitureStyle,
  ).length;
}

export type GlobalFurnitureStyleChangeRequest =
  | { kind: "unchanged"; overrideCount: 0 }
  | { kind: "apply"; overrideCount: 0 }
  | { kind: "confirm"; overrideCount: number };

export function requestGlobalFurnitureStyleChange(
  items: readonly FurnitureStyleItem[],
  currentDefault: string,
  nextDefault: string,
): GlobalFurnitureStyleChangeRequest {
  if (nextDefault === currentDefault) {
    return { kind: "unchanged", overrideCount: 0 };
  }

  const overrideCount = countIndividualFurnitureStyles(
    items,
    currentDefault,
  );
  return overrideCount > 0
    ? { kind: "confirm", overrideCount }
    : { kind: "apply", overrideCount: 0 };
}

/** Replace only furnitureStyle; all uploads and other per-image data survive. */
export function applyFurnitureStyleToAll<T extends FurnitureStyleItem>(
  items: readonly T[],
  furnitureStyle: string,
): T[] {
  return items.map((item) =>
    item.furnitureStyle === furnitureStyle
      ? item
      : { ...item, furnitureStyle },
  );
}

/** Change one image without mutating the order default or sibling images. */
export function applyIndividualFurnitureStyle<T extends FurnitureStyleItem>(
  items: readonly T[],
  index: number,
  furnitureStyle: string,
): T[] {
  return items.map((item, itemIndex) =>
    itemIndex === index && item.furnitureStyle !== furnitureStyle
      ? { ...item, furnitureStyle }
      : item,
  );
}

export function inheritFurnitureStyle<T extends FurnitureStyleItem>(
  item: T,
  defaultFurnitureStyle: string,
): T {
  return item.furnitureStyle === defaultFurnitureStyle
    ? item
    : { ...item, furnitureStyle: defaultFurnitureStyle };
}

export function hasExampleMedia(
  media: ExampleMediaSources | null | undefined,
): boolean {
  return Boolean(media?.imageUrl || media?.beforeUrl || media?.afterUrl);
}

export function resolveFurnitureStyleThumbnail(
  media: ExampleMediaSources | null | undefined,
  staticFallback: string | null,
): string | null {
  return media?.afterUrl ?? media?.imageUrl ?? staticFallback;
}
