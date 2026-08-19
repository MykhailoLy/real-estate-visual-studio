"use client";

import Image from "next/image";
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
        <Image
          src={previewUrl}
          alt=""
          fill
          unoptimized
          className="object-cover"
        />
      ) : (
        <FileText className={`${iconClassName} text-muted`} aria-hidden />
      )}
    </div>
  );
}
