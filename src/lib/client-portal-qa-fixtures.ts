import type { DashboardJob } from "./client-dashboard/mock-data.ts";
import type { OrderDraftSummary } from "./order-drafts/types.ts";

/**
 * Render-only dashboard density fixtures. These values never map to an order,
 * draft, Supabase row, API request, or mutation.
 */
export const CLIENT_PORTAL_QA_DRAFTS: readonly OrderDraftSummary[] = [
  qaDraft("qa-draft-alicante", "Alicante Apartment", "virtual-staging", "/dashboard/orders/new/virtual-staging", "2026-08-31T08:45:00.000Z"),
  qaDraft("qa-draft-villa", "Villa Photos", "photo-editing", "/dashboard/orders/new/image-enhancement", "2026-08-30T15:20:00.000Z"),
  qaDraft("qa-draft-coastal", "Coastal Living Room", "virtual-staging", "/dashboard/orders/new/virtual-staging", "2026-08-30T11:05:00.000Z"),
  qaDraft("qa-draft-dusk", "Garden Dusk", "photo-editing", "/dashboard/orders/new/day-to-dusk", "2026-08-29T16:30:00.000Z"),
  qaDraft("qa-draft-plan", "Penthouse Plan", "3d-floor-plans", "/dashboard/orders/new/3d-floor-plans", "2026-08-29T09:15:00.000Z"),
  qaDraft("qa-draft-bedroom", "Marina Bedroom", "virtual-renovation", "/dashboard/orders/new/virtual-renovation", "2026-08-28T13:40:00.000Z"),
  qaDraft("qa-draft-studio", "Studio Refresh", "photo-editing", "/dashboard/orders/new/item-removal-virtual-cleaning", "2026-08-28T10:00:00.000Z"),
  qaDraft("qa-draft-exterior", "Hillside Exterior", "photo-editing", "/dashboard/orders/new/day-to-dusk", "2026-08-27T17:10:00.000Z"),
];

export const CLIENT_PORTAL_QA_COMPLETED_JOBS: readonly DashboardJob[] = [
  qaCompletedJob("qa-completed-alicante", "Alicante Apartment", "Virtual Staging", "QA-VS-001", "2026-08-30"),
  qaCompletedJob("qa-completed-villa", "Villa Photos", "Image Enhancement", "QA-IE-002", "2026-08-29"),
  qaCompletedJob("qa-completed-coastal", "Coastal Living Room", "Virtual Renovation", "QA-VR-003", "2026-08-28"),
  qaCompletedJob("qa-completed-garden", "Garden Dusk", "Day to Dusk", "QA-DD-004", "2026-08-27"),
  qaCompletedJob("qa-completed-plan", "Penthouse Plan", "Floor Plans", "QA-FP-005", "2026-08-26"),
  qaCompletedJob("qa-completed-studio", "Studio Refresh", "Item Removal & Virtual Cleaning", "QA-IR-006", "2026-08-25"),
];

function qaDraft(
  id: string,
  title: string,
  serviceType: OrderDraftSummary["serviceType"],
  route: string,
  updatedAt: string,
): OrderDraftSummary {
  return {
    id,
    serviceType,
    subService: null,
    route,
    title,
    currentStep: "configure",
    status: "active",
    version: 1,
    updatedAt,
    expiresAt: "2027-08-31T00:00:00.000Z",
    convertedOrderId: null,
    finalization: null,
    thumbnail: null,
  };
}

function qaCompletedJob(
  id: string,
  title: string,
  serviceType: string,
  reference: string,
  submittedDate: string,
): DashboardJob {
  return {
    id,
    title,
    serviceType,
    reference,
    status: "completed",
    submittedDate,
    estimatedCompletion: submittedDate,
    progress: 100,
    costCents: 0,
    imageCount: 1,
  };
}
