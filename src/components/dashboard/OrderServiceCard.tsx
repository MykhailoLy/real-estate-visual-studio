"use client";

import { useState } from "react";
import ClientPortalLink from "./ClientPortalLink";
import Image from "next/image";
import { ArrowRight, Clock, Images, Lock } from "lucide-react";
import {
  ORDER_SERVICE_CARDS,
  type OrderServiceCard as OrderServiceCardData,
} from "@/lib/order-services";
import { getGalleryPairLabels } from "@/lib/gallery";
import type { OrderCardImage } from "@/lib/order-card-media";
import type { OrderExamplePair } from "@/lib/order-card-examples";
import OrderExamplesModal from "./OrderExamplesModal";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import { getOrderServicePriceLabel } from "@/lib/order-service-price-label";
import { PORTFOLIO_VIEWER_VARIANTS } from "@/components/media/static-image-variant";
import { cn } from "@/lib/utils";

// ============================================================
// OrderServiceCard — one service tile in the New Order hub.
//
// The shell stays a non-interactive <article>. Dashboard cards add a full-card
// portal link below the Examples button, so the card is the primary order
// target while the modal control remains independently accessible. The New
// Order catalog retains its separate Start Order link. Inactive cards remain
// non-navigable. Any service with complete Portfolio examples (active or
// inactive, excluding the temporary Photo Editing card) shows a View Examples
// button that opens an in-dashboard modal.
//
// Media priority: Portfolio Before/After preview → order-card image
// → branded CSS fallback. All non-serializable bits (the icon) are
// resolved client-side from the registry by slug.
// ============================================================

interface OrderServiceCardProps {
  slug: string;
  /** Complete Before/After pairs for this service (may be empty). */
  examples: OrderExamplePair[];
  /** Admin-managed order-card cover image, or null. */
  cardImage: OrderCardImage | null;
  layout?: "catalog" | "dashboard";
}

const HALF_SIZES =
  "(min-width: 3200px) 7.5vw, (min-width: 2400px) 9vw, (min-width: 1536px) 13vw, (min-width: 1280px) 17vw, (min-width: 640px) 25vw, 50vw";
const COVER_SIZES =
  "(min-width: 3200px) 15vw, (min-width: 2400px) 18vw, (min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw";
const DASHBOARD_HALF_SIZES =
  "(min-width: 3200px) 8vw, (min-width: 2400px) 8vw, (min-width: 1920px) 10vw, (min-width: 1360px) 10vw, (min-width: 1024px) 15vw, (min-width: 640px) 25vw, 50vw";
const DASHBOARD_COVER_SIZES =
  "(min-width: 3200px) 16vw, (min-width: 2400px) 16vw, (min-width: 1920px) 20vw, (min-width: 1360px) 20vw, (min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw";

function PortfolioPreview({
  pair,
  beforeLabel,
  afterLabel,
  sizes,
}: {
  pair: OrderExamplePair;
  beforeLabel: string;
  afterLabel: string;
  sizes: string;
}) {
  return (
    <div className="relative aspect-[3/1] w-full overflow-hidden bg-stone-100">
      <div className="grid h-full grid-cols-2">
        <div className="relative h-full overflow-hidden">
          <Image
            src={pair.beforeUrl}
            alt={pair.beforeAlt}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            loading="lazy"
          />
          <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-1 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-white">
            {beforeLabel}
          </span>
        </div>
        <div className="relative h-full overflow-hidden border-l-2 border-white">
          <Image
            src={pair.afterUrl}
            alt={pair.afterAlt}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            loading="lazy"
          />
          <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-1 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-white">
            {afterLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function CoverImage({
  image,
  title,
  sizes,
}: {
  image: OrderCardImage;
  title: string;
  sizes: string;
}) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-stone-100">
      <Image
        src={image.url}
        alt={image.alt ?? title}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
        loading="lazy"
      />
    </div>
  );
}

function FallbackVisual({ service }: { service: OrderServiceCardData }) {
  const Icon = service.icon;
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-stone-100">
      <div
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-surface to-secondary/10"
      >
        <Icon className="h-9 w-9 text-primary/60" />
        <span className="px-4 text-center text-xs font-semibold tracking-wide text-primary/70">
          {service.title}
        </span>
      </div>
    </div>
  );
}

export default function OrderServiceCard({
  slug,
  examples,
  cardImage,
  layout = "catalog",
}: OrderServiceCardProps) {
  const currency = useDisplayCurrency();
  const [modalOpen, setModalOpen] = useState(false);

  const service = ORDER_SERVICE_CARDS.find((s) => s.slug === slug);
  if (!service) return null;

  const isActive = service.availability === "active" && service.route !== null;
  const hasExamples =
    examples.length > 0 && service.portfolioServiceSlug !== null && !service.temporary;
  const labels = service.portfolioServiceSlug
    ? getGalleryPairLabels(service.portfolioServiceSlug, "en")
    : null;
  const isDashboard = layout === "dashboard";
  const halfSizes = layout === "dashboard" ? DASHBOARD_HALF_SIZES : HALF_SIZES;
  const coverSizes = layout === "dashboard" ? DASHBOARD_COVER_SIZES : COVER_SIZES;

  return (
    <article
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        isDashboard && isActive && "cursor-pointer hover:border-primary/35",
      )}
    >
      {isDashboard && isActive && (
        <ClientPortalLink
          href={service.route as string}
          aria-label={`Start a ${service.title} order`}
          className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <span className="sr-only">Start a {service.title} order</span>
        </ClientPortalLink>
      )}

      {/* ── Media region ── */}
      <div className="relative">
        {hasExamples && labels ? (
          <PortfolioPreview
            pair={examples[0]}
            beforeLabel={labels.before}
            afterLabel={labels.after}
            sizes={halfSizes}
          />
        ) : cardImage ? (
          <CoverImage image={cardImage} title={service.title} sizes={coverSizes} />
        ) : (
          <FallbackVisual service={service} />
        )}

        {service.badge && (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-primary/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm">
            {service.badge}
          </span>
        )}

        {hasExamples && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label={`View ${service.title} examples`}
            title="View examples"
            className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Images className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Examples</span>
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary group-focus-within:text-primary">{service.title}</h2>
        <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted">
          {service.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">
              {getOrderServicePriceLabel(service, currency)}
            </p>
            {service.turnaroundLabel && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <Clock className="h-3 w-3" aria-hidden />
                {service.turnaroundLabel}
              </p>
            )}
          </div>

          {isActive && !isDashboard ? (
            <ClientPortalLink
              href={service.route as string}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Start Order
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ClientPortalLink>
          ) : !isActive ? (
            <span
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-stone-100 px-3.5 py-2 text-sm font-semibold text-muted"
              aria-disabled="true"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {service.availability === "custom-quote" ? "Custom Quote" : "Coming Soon"}
            </span>
          ) : null}
        </div>
      </div>

      {hasExamples && labels && service.portfolioServiceSlug && (
        <OrderExamplesModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={service.title}
          serviceSlug={service.portfolioServiceSlug}
          viewerVariant={PORTFOLIO_VIEWER_VARIANTS[service.portfolioServiceSlug]}
          pairs={examples}
        />
      )}
    </article>
  );
}
