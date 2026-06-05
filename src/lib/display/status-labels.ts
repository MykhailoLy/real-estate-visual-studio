export type DisplayTone = "amber" | "blue" | "green" | "purple" | "slate";

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  "in-progress": "In Progress",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  rework_requested: "Pending Rework",
  rework_in_progress: "Rework in Progress",
  rework_delivered: "New Version Ready",
  approved: "Approved",
  resolved: "Resolved",
};

export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? fallbackStatusLabel(status);
}

export function getReviewStatusLabel(status: string): string {
  return REVIEW_STATUS_LABELS[status] ?? fallbackStatusLabel(status);
}

export function getBillingStatusLabel(status: string): string {
  if (status === "delivered" || status === "completed") return "Delivered";
  if (status === "confirmed" || status === "in-progress") return "In Progress";
  return getOrderStatusLabel(status);
}

export function getOrderStatusTone(status: string): DisplayTone {
  if (status === "pending") return "amber";
  if (status === "confirmed" || status === "in-progress") return "blue";
  if (status === "delivered" || status === "completed") return "green";
  if (status === "cancelled") return "slate";
  return "slate";
}

export function getReviewStatusTone(status: string): DisplayTone {
  if (status === "rework_requested") return "amber";
  if (status === "rework_in_progress") return "blue";
  if (status === "rework_delivered") return "purple";
  if (status === "approved" || status === "resolved") return "green";
  return "slate";
}

function fallbackStatusLabel(status: string): string {
  return status
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
