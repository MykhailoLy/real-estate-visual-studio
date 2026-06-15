import "server-only";
import {
  getDeliverablesForClient,
  type ClientDeliverable,
} from "@/lib/client-deliverables";
import { getCurrentDeliverableRows } from "@/lib/client-deliverable-display";
import {
  getOrdersForClient,
  type ClientOrder,
} from "@/lib/client-orders";
import { getServiceLabel } from "@/lib/display/service-labels";
import { getReviewsForClient } from "@/lib/client-reviews";
import {
  getClientSourceFilesForOrder,
  type ClientSourceFile,
} from "@/lib/client-source-files";
import type { OrderOwnership } from "@/lib/order-ownership";

export interface ClientFileOrderSummary {
  id: string;
  order_number: string;
  service_type: string;
  service_label: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ClientDeliveredFileHubItem extends ClientDeliverable {
  kind: "delivered";
  order: ClientFileOrderSummary;
}

export interface ClientUploadedFileHubItem {
  id: string;
  kind: "original" | "reference";
  order_id: string;
  order_number: string;
  item_index: number;
  filename: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
  order: ClientFileOrderSummary;
}

export interface ClientFilesHubData {
  orders: ClientOrder[];
  deliveredFiles: ClientDeliveredFileHubItem[];
  uploadedFiles: ClientUploadedFileHubItem[];
}

function mapOrderSummary(order: ClientOrder): ClientFileOrderSummary {
  return {
    id: order.id,
    order_number: order.order_number,
    service_type: order.service_type,
    service_label: getServiceLabel(order.service_type),
    status: order.status,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

function mapSourceFile(
  file: ClientSourceFile,
  order: ClientOrder,
): ClientUploadedFileHubItem {
  const summary = mapOrderSummary(order);
  return {
    id: file.id,
    kind: file.kind,
    order_id: order.id,
    order_number: order.order_number,
    item_index: file.itemIndex,
    filename: file.filename,
    file_size: file.fileSize,
    mime_type: file.mimeType,
    uploaded_at: order.created_at,
    order: summary,
  };
}

export async function getClientFilesHubData(
  ownership: OrderOwnership,
): Promise<ClientFilesHubData> {
  if (!ownership?.userId || !ownership?.email) {
    return { orders: [], deliveredFiles: [], uploadedFiles: [] };
  }

  const [orders, allDeliverables, reviews] = await Promise.all([
    getOrdersForClient(ownership),
    getDeliverablesForClient(ownership),
    getReviewsForClient(ownership),
  ]);

  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const currentDeliverables = getCurrentDeliverableRows(allDeliverables, reviews);

  const deliveredFiles = currentDeliverables.flatMap(({ deliverable }) => {
    const order = ordersById.get(deliverable.order_id);
    if (!order) return [];
    return [
      {
        ...deliverable,
        kind: "delivered" as const,
        order: mapOrderSummary(order),
      },
    ];
  });

  const sourceFileGroups = await Promise.all(
    orders.map(async (order) => {
      const files = await getClientSourceFilesForOrder(order.id, ownership);
      return files.map((file) => mapSourceFile(file, order));
    }),
  );

  const uploadedFiles = sourceFileGroups
    .flat()
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));

  return {
    orders,
    deliveredFiles,
    uploadedFiles,
  };
}
