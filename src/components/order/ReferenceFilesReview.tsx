"use client";

import { ExternalLink } from "lucide-react";
import ReferenceFileThumbnail from "@/components/order/ReferenceFileThumbnail";
import {
  formatReferenceFileSize,
  normalizeReferenceLink,
  type ReferenceFileValue,
} from "@/lib/reference-files";

export default function ReferenceFilesReview({
  referenceLink,
  files,
}: {
  referenceLink: string;
  files: ReferenceFileValue[];
}) {
  const normalizedLink = normalizeReferenceLink(referenceLink);
  if (!normalizedLink && files.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface/40 p-3">
      <p className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
        References
      </p>
      {normalizedLink && (
        <a
          href={normalizedLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 break-all text-dashboard-action font-medium text-primary underline-offset-2 hover:underline"
        >
          {normalizedLink}
          <ExternalLink className="h-3.5 w-3.5 flex-none" aria-hidden />
        </a>
      )}
      {files.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((reference) => {
            return (
              <li
                key={reference.id}
                className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-white p-2"
              >
                <ReferenceFileThumbnail
                  reference={reference}
                  className="h-10 w-10 rounded"
                  iconClassName="h-4 w-4"
                />
                <div className="min-w-0">
                  <p className="break-all text-dashboard-metadata font-medium text-foreground">
                    {reference.filename}
                  </p>
                  <p className="text-dashboard-metadata text-muted">
                    {formatReferenceFileSize(reference.fileSize)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
