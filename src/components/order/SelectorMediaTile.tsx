import Image from "next/image";
import { ImageIcon } from "lucide-react";

interface SelectorMediaTileProps {
  url: string | null;
  alt: string;
  sizes?: string;
  rounded?: string;
}

/** Responsive admin-managed media frame with a safe missing-media fallback. */
export default function SelectorMediaTile({
  url,
  alt,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  rounded = "rounded-t-2xl",
}: SelectorMediaTileProps) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/10 via-surface to-secondary/10 ${rounded}`}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          loading="lazy"
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-light"
          aria-hidden="true"
        >
          <ImageIcon className="h-8 w-8" />
          <span className="text-[11px] font-medium uppercase tracking-[0.15em]">
            Example coming soon
          </span>
        </div>
      )}
    </div>
  );
}
