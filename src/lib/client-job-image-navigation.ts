import { getFilePreviewKind } from "./file-preview.ts";

export interface JobImageViewerItem {
  id: string;
  filename: string;
  mimeType: string | null;
  signedUrlEndpoint: string;
}

interface NavigationSourceFile {
  id: string;
  itemIndex: number;
  kind: "original" | "reference";
  filename: string;
  mimeType: string | null;
}

interface NavigationDeliverableRow {
  deliverable: {
    id: string;
    item_index: number | null;
    filename: string;
    mime_type: string | null;
  };
}

interface BuildClientJobImageGalleriesInput {
  orderId: string;
  itemIndexes: number[];
  sourceFiles: NavigationSourceFile[];
  currentDeliverables: NavigationDeliverableRow[];
}

export interface ClientJobImageGalleries {
  originals: JobImageViewerItem[];
  delivered: JobImageViewerItem[];
  orderFiles: JobImageViewerItem[];
}

function isImage(filename: string, mimeType: string | null): boolean {
  return getFilePreviewKind(filename, mimeType) === "image";
}

export function buildClientJobImageGalleries({
  orderId,
  itemIndexes,
  sourceFiles,
  currentDeliverables,
}: BuildClientJobImageGalleriesInput): ClientJobImageGalleries {
  const originals = itemIndexes.flatMap((itemIndex) => {
    const source = sourceFiles.find(
      (file) => file.itemIndex === itemIndex && file.kind === "original",
    );
    if (!source || !isImage(source.filename, source.mimeType)) return [];

    return [{
      id: `source:${source.id}`,
      filename: source.filename,
      mimeType: source.mimeType,
      signedUrlEndpoint: `/api/client/orders/${orderId}/source-files/${source.id}/download-url`,
    }];
  });

  const deliveredForItem = (itemIndex: number) => currentDeliverables.flatMap(({ deliverable }) => {
    if (
      deliverable.item_index !== itemIndex ||
      !isImage(deliverable.filename, deliverable.mime_type)
    ) {
      return [];
    }

    return [{
      id: `deliverable:${deliverable.id}`,
      filename: deliverable.filename,
      mimeType: deliverable.mime_type,
      signedUrlEndpoint: `/api/client/deliverables/${deliverable.id}/download-url`,
    }];
  });

  const orderFiles = currentDeliverables.flatMap(({ deliverable }) => {
    if (
      deliverable.item_index !== null ||
      !isImage(deliverable.filename, deliverable.mime_type)
    ) {
      return [];
    }

    return [{
      id: `deliverable:${deliverable.id}`,
      filename: deliverable.filename,
      mimeType: deliverable.mime_type,
      signedUrlEndpoint: `/api/client/deliverables/${deliverable.id}/download-url`,
    }];
  });

  return {
    originals,
    delivered: itemIndexes.flatMap(deliveredForItem),
    orderFiles,
  };
}

export function getAdjacentViewerIndex(
  currentIndex: number,
  total: number,
  direction: -1 | 1,
): number | null {
  const nextIndex = currentIndex + direction;
  return nextIndex >= 0 && nextIndex < total ? nextIndex : null;
}
