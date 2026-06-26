import type { UploadKind } from "../upload-config.ts";

export const ORDER_DRAFT_STATE_SCHEMA_VERSION = 1;
export const ORDER_DRAFT_ACTIVE_RETENTION_DAYS = 30;
export const ORDER_DRAFT_EXPIRY_WARNING_DAYS = 7;
export const ORDER_DRAFT_CONVERTED_RETENTION_DAYS = 90;

export const ORDER_DRAFT_STATUSES = [
  "active",
  "converting",
  "converted",
  "deleted",
  "expired",
] as const;

export const ORDER_DRAFT_FILE_STATUSES = [
  "pending",
  "uploaded",
  "failed",
  "deleted",
  "moved",
] as const;

export const ORDER_DRAFT_FILE_KINDS = [
  "original",
  "reference",
] as const satisfies readonly UploadKind[];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function calculateActiveDraftExpiry(from: Date): Date {
  return addUtcDays(from, ORDER_DRAFT_ACTIVE_RETENTION_DAYS);
}

export function isInsideDraftExpiryWarningWindow(
  expiresAt: Date,
  now: Date,
): boolean {
  const warningStartsAt = addUtcDays(
    expiresAt,
    -ORDER_DRAFT_EXPIRY_WARNING_DAYS,
  );
  return now.getTime() >= warningStartsAt.getTime();
}
