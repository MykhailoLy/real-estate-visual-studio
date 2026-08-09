"use client";

import Image from "next/image";
import { useState } from "react";

type PropertyBrandLogoProps = {
  url?: string;
  brandName: string;
  sizes: string;
  className: string;
  testId: string;
};

/** Each placement owns its image failure state, so a transient failure in one
 * context cannot suppress an otherwise valid logo elsewhere on the page. */
export default function PropertyBrandLogo({
  url,
  brandName,
  sizes,
  className,
  testId,
}: PropertyBrandLogoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!url || failedUrl === url) return null;

  return (
    <div data-testid={testId} className={className}>
      <Image
        src={url}
        alt={`${brandName} logo`}
        fill
        sizes={sizes}
        className="object-contain"
        onError={() => setFailedUrl(url)}
      />
    </div>
  );
}
