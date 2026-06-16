"use client";

import { useEffect, useMemo, useState } from "react";
import { FileImage } from "lucide-react";

// ============================================================
// LocalFilePreview — preview a still-local (not yet uploaded) File
// using a short-lived object URL, for the Review step.
//
// The object URL is created with URL.createObjectURL and revoked on
// cleanup / when the file changes to avoid memory leaks. We never
// upload the file just to display it. A file-icon fallback is shown
// when the file is not a previewable image or fails to decode.
//
// `object-contain` is used so the reviewer sees the full uploaded
// composition (not a cropped thumbnail). Plain <img> is intentional:
// next/image needs a static/remote URL, while object URLs are blobs.
// ============================================================

const PREVIEWABLE_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
];

function isPreviewableImage(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  const lower = file.name.toLowerCase();
  return PREVIEWABLE_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface LocalFilePreviewProps {
  file: File;
  alt?: string;
  className?: string;
}

export default function LocalFilePreview({
  file,
  alt,
  className = "",
}: LocalFilePreviewProps) {
  const objectUrl = useMemo<string | null>(
    () => (isPreviewableImage(file) ? URL.createObjectURL(file) : null),
    [file]
  );
  // Track WHICH url failed rather than resetting a boolean in an effect —
  // this keeps the error tied to the current url and avoids cascading
  // renders (and the no-setState-in-effect lint rule).
  const [erroredUrl, setErroredUrl] = useState<string | null>(null);
  const errored = objectUrl !== null && erroredUrl === objectUrl;

  // Revoke the object URL when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const frameClass = `relative flex items-center justify-center overflow-hidden rounded-lg border border-border bg-surface ${className}`;

  if (objectUrl && !errored) {
    return (
      <div className={frameClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={objectUrl}
          alt={alt ?? file.name}
          onError={() => setErroredUrl(objectUrl)}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <div className="flex flex-col items-center justify-center gap-1.5 px-2 text-center text-muted">
        <FileImage className="h-7 w-7 text-primary" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
          No preview
        </span>
      </div>
    </div>
  );
}
