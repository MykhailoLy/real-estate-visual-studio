import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import TrackedLink from "@/components/analytics/TrackedLink";
import ServicePlaceholder, {
  type ServiceVariant,
} from "@/components/home/ServicePlaceholder";

export interface PricingHubImage {
  url: string;
  alt: string;
}

interface PricingHubServiceTileProps {
  href: string;
  name: string;
  priceLabel: ReactNode;
  image: PricingHubImage | null;
  fallbackVariant: ServiceVariant;
  headingLevel?: 3 | 4;
}

const IMAGE_SIZES =
  "(min-width: 1280px) 30vw, (min-width: 768px) 46vw, 100vw";

export default function PricingHubServiceTile({
  href,
  name,
  priceLabel,
  image,
  fallbackVariant,
  headingLevel = 3,
}: PricingHubServiceTileProps) {
  const Heading = headingLevel === 4 ? "h4" : "h3";

  return (
    <TrackedLink
      href={href}
      analyticsLabel={`View ${name} pricing`}
      analyticsLocation="pricing_card"
      analyticsEvent="pricing_cta"
      className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
    >
      <article>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes={IMAGE_SIZES}
              loading="lazy"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
            />
          ) : (
            <ServicePlaceholder
              variant={fallbackVariant}
              showInnerLabels={false}
            />
          )}
        </div>

        <div className="flex items-start justify-between gap-4 border-b border-stone-200 py-4">
          <div className="min-w-0">
            <Heading className="text-xl font-bold leading-tight tracking-tight text-primary lg:text-2xl">
              {name}
            </Heading>
            <p className="mt-1.5 text-sm font-semibold text-secondary-dark lg:text-base">
              {priceLabel}
            </p>
          </div>

          <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-primary transition-colors group-hover:text-secondary-dark sm:text-sm sm:normal-case sm:tracking-normal">
            <span className="hidden sm:inline">View pricing</span>
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </span>
        </div>
      </article>
    </TrackedLink>
  );
}
