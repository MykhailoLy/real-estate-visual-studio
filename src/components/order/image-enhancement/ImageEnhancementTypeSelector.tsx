import { ArrowRight, Lock } from "lucide-react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import Container from "@/components/layout/Container";
import { IMAGE_ENHANCEMENT_TYPES } from "@/lib/image-enhancement";
import { getServiceOptionImagesByKeys } from "@/lib/site-media";
import SelectorMediaTile from "@/components/order/SelectorMediaTile";
import { CatalogPriceText } from "@/components/pricing/currency-client";

// ============================================================
// ImageEnhancementTypeSelector — protected type-selection view for
// /dashboard/orders/new/image-enhancement.
//
// Two professional comparison cards:
//   1. Single Exposure  → active, links to its order form
//   2. HDR / Bracketed  → Coming Soon, disabled (never creates an order)
//
// Card images are admin-managed via the existing site-media
// "service-options" section, read in ONE batched query. Missing keys
// fall back to a CSS placeholder (no broken images).
//
// Server component (async): no client interactivity beyond the active
// card's link and the disabled HDR button.
// ============================================================

export default async function ImageEnhancementTypeSelector() {
  const images = await getServiceOptionImagesByKeys(
    IMAGE_ENHANCEMENT_TYPES.map((t) => t.mediaKey)
  );

  return (
    <section className="py-10 lg:py-16 bg-surface min-h-screen">
      <Container>
        <div className="mb-8 max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
            New Order
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold text-primary mb-2">
            Image Enhancement
          </h1>
          <p className="text-muted">
            Choose how your photos were captured. Single Exposure is for
            standard listing photographs; HDR / Bracketed is for professional
            photographers supplying multiple exposures per final image.
          </p>
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          role="list"
          aria-label="Image Enhancement types"
        >
          {IMAGE_ENHANCEMENT_TYPES.map((type) => {
            const media = images.get(type.mediaKey) ?? null;
            const isActive = type.status === "active";

            const cardInner = (
              <>
                <SelectorMediaTile
                  url={media?.url ?? null}
                  alt={media?.alt ?? `${type.title} example`}
                />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2 className="text-lg font-bold text-foreground leading-tight">
                      {type.title}
                    </h2>
                    {!isActive && (
                      <span className="inline-flex items-center gap-1 flex-shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700">
                        <Lock className="w-3 h-3" aria-hidden />
                        Coming Soon
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted leading-relaxed mb-4">
                    {type.description}
                  </p>

                  <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary">
                    {type.relationship}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-border">
                    <span
                      className={`text-sm font-bold ${
                        isActive ? "text-foreground" : "text-amber-700"
                      }`}
                    >
                      {isActive ? (
                        <CatalogPriceText
                          priceKey="image-enhancement"
                          suffix=" per image"
                        />
                      ) : (
                        type.priceLabel
                      )}
                    </span>

                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors group-hover:bg-primary-light">
                        {type.ctaLabel}
                        <ArrowRight className="w-4 h-4" aria-hidden />
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-muted-light"
                      >
                        {type.ctaLabel}
                      </button>
                    )}
                  </div>
                </div>
              </>
            );

            if (isActive) {
              return (
                <ClientPortalLink
                  key={type.id}
                  href={type.route}
                  role="listitem"
                  aria-label={`${type.title}. Current fixed price per image. ${type.ctaLabel}.`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {cardInner}
                </ClientPortalLink>
              );
            }

            // Disabled HDR card — NOT a link, does not navigate or create an
            // order. Status communicated in text (not colour alone).
            return (
              <div
                key={type.id}
                role="listitem"
                aria-label={`${type.title}. ${type.priceLabel}. Coming soon — not yet available.`}
                className="flex flex-col overflow-hidden rounded-2xl border border-dashed border-border bg-white/70 shadow-sm"
              >
                {cardInner}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-[12px] text-muted-light max-w-2xl">
          HDR / Bracketed Images pricing is being finalised. Once confirmed,
          you&apos;ll be able to upload multiple exposures per final image.
        </p>
      </Container>
    </section>
  );
}
