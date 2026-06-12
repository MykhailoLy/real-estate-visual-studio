// GalleryServiceNav — horizontal scrollable service pill navigation
// shown at the top of every gallery detail page.
//
// Server component: the parent page passes pre-built hrefs so the
// nav works for both /gallery/[slug] (EN) and /es/gallery/[slug] (ES).

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface GalleryServiceNavItem {
  slug: string;
  label: string;
  href: string;
}

interface GalleryServiceNavProps {
  services: GalleryServiceNavItem[];
  currentSlug: string;
  /** Eyebrow label above the pills. */
  eyebrow?: string;
}

export default function GalleryServiceNav({
  services,
  currentSlug,
  eyebrow = "Browse services",
}: GalleryServiceNavProps) {
  return (
    <nav aria-label={eyebrow}>
      {eyebrow && (
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted mb-3">
          {eyebrow}
        </p>
      )}
      {/* Horizontal scroll container — no scrollbar on desktop, finger-friendly on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="flex items-center gap-2 flex-nowrap pb-1">
          {services.map((svc) => {
            const isCurrent = svc.slug === currentSlug;
            return (
              <Link
                key={svc.slug}
                href={svc.href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isCurrent
                    ? "bg-primary text-white shadow-sm"
                    : "bg-stone-100 text-foreground/70 hover:bg-stone-200 hover:text-primary"
                )}
              >
                {svc.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
