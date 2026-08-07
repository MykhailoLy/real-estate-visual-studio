import type { PropertyImageFocalPoint } from "./types.ts";

export const CENTER_FOCAL_POINT: Readonly<PropertyImageFocalPoint> = {
  x: 0.5,
  y: 0.5,
};

function clampCoordinate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}
export function normalizePropertyImageFocalPoint(
  value: Partial<PropertyImageFocalPoint> | null | undefined,
): PropertyImageFocalPoint {
  return {
    x: clampCoordinate(value?.x),
    y: clampCoordinate(value?.y),
  };
}

export function focalPointToObjectPosition(
  value: Partial<PropertyImageFocalPoint> | null | undefined,
): string {
  const focalPoint = normalizePropertyImageFocalPoint(value);
  return `${Number((focalPoint.x * 100).toFixed(3))}% ${Number((focalPoint.y * 100).toFixed(3))}%`;
}
