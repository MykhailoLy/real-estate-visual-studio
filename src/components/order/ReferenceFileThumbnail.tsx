"use client";

import { FileText } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  isImageReference,
  type ReferenceFileValue,
} from "@/lib/reference-files";

export default function ReferenceFileThumbnail({
  reference,
  className,
  iconClassName,
}: {
  reference: ReferenceFileValue;
  className: string;
  iconClassName: string;
}) {
  const objectUrl = useMemo(
    () =>
      reference.file && isImageReference(reference)
        ? URL.createObjectURL(reference.file)
        : null,
    [reference],
  );

  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );

  const previewUrl = objectUrl ?? reference.previewUrl;
  return (
    <div
      className={`relative flex flex-none items-center justify-center overflow-hidden bg-surface ${className}`}
    >
      {isImageReference(reference) && previewUrl ? (
        // Local object URLs and private signed draft URLs must bypass next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <FileText className={`${iconClassName} text-muted`} aria-hidden />
      )}
    </div>
  );
}
