import { z } from "zod";
import {
  MAX_REFERENCE_FILE_SIZE_BYTES,
  MAX_REFERENCE_FILES,
  REFERENCE_FILE_MIME_TYPES,
  type ReferenceFileValue,
} from "../reference-files.ts";

export const PrepareDraftReferenceFileSchema = z.object({
  itemClientId: z.string().uuid(),
  referenceId: z.string().uuid(),
  position: z.number().int().min(0).max(MAX_REFERENCE_FILES - 1),
  filename: z.string().min(1).max(255),
  fileSize: z.number().int().min(1).max(MAX_REFERENCE_FILE_SIZE_BYTES),
  mimeType: z.enum(REFERENCE_FILE_MIME_TYPES),
});

export type PrepareDraftReferenceFileInput = z.infer<
  typeof PrepareDraftReferenceFileSchema
>;

export interface DraftReferenceFileSummary extends ReferenceFileValue {
  file: null;
  draftFileId: string;
  itemClientId: string;
  position: number;
  storagePath: null;
}

export interface PreparedDraftReferenceFile {
  reference: DraftReferenceFileSummary;
  upload: {
    bucket: "order-files";
    path: string;
    token: string;
    signedUrl: string;
  };
}
