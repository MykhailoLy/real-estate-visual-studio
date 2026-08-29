import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import type { ServiceVariant } from "@/components/home/ServicePlaceholder";
import PricingHubServiceTile, {
  type PricingHubImage,
} from "@/components/pricing/PricingHubServiceTile";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import CtaSection from "@/components/sections/CtaSection";
import { localServices } from "@/data/services";
import { getOrderCardImages } from "@/lib/order-card-media";
import { getOrderServiceExamples } from "@/lib/order-card-examples";
import type { PortfolioServiceSlug } from "@/lib/portfolio";
import { PUBLIC_TAX_NOTICE } from "@/lib/pricing/public";
import { getLocalPricingPresentation } from "@/lib/pricing/local-catalog";
import type { PriceKey } from "@/lib/pricing/types";
import { publicPageMetadata } from "@/lib/seo";
import type { LocalServiceType } from "@/types";

export const metadata: Metadata = publicPageMetadata({
  title: "Pricing",
  description:
    "Explore starting prices for PicchuSpot virtual staging, photo editing, floor plans, 360 services, and local real estate media.",
  canonicalPath: "/pricing",
  spanishPath: "/es/pricing",
});

type HubPrice =
  | {
      kind: "catalog";
      priceKey: PriceKey;
      unit: string;
    }
  | {
      kind: "label";
      label: string;
    };

interface RemoteHubService {
  name: string;
  href: string;
  price: HubPrice;
  mediaSlug: PortfolioServiceSlug;
  fallbackVariant: ServiceVariant;
}

interface RemoteServiceGroup {
  title: string;
  services: readonly RemoteHubService[];
}

interface LocalHubService {
  serviceId: LocalServiceType;
  href: string;
  mediaSlug: PortfolioServiceSlug;
  fallbackVariant: ServiceVariant;
}

const REMOTE_SERVICE_GROUPS: readonly RemoteServiceGroup[] = [
  {
    title: "Photo Editing",
    services: [
      {
        name: "Image Enhancement",
        href: "/pricing/image-enhancement",
        price: {
          kind: "catalog",
          priceKey: "image-enhancement",
          unit: "image",
        },
        mediaSlug: "image-enhancement",
        fallbackVariant: "image-enhancement",
      },
      {
        name: "Day to Dusk",
        href: "/pricing/day-to-dusk",
        price: {
          kind: "catalog",
          priceKey: "day-to-dusk",
          unit: "image",
        },
        mediaSlug: "day-to-dusk",
        fallbackVariant: "day-to-dusk",
      },
      {
        name: "Item Removal & Virtual Cleaning",
        href: "/pricing/photo-editing",
        price: {
          kind: "catalog",
          priceKey: "item-removal-virtual-cleaning",
          unit: "image",
        },
        mediaSlug: "item-removal-virtual-cleaning",
        fallbackVariant: "item-removal",
      },
      {
        name: "Aerial Editing",
        href: "/pricing/aerial-editing",
        price: {
          kind: "catalog",
          priceKey: "aerial-colour-fade",
          unit: "image",
        },
        mediaSlug: "aerial-editing",
        fallbackVariant: "aerial-editing",
      },
    ],
  },
  {
    title: "Staging & Renovation",
    services: [
      {
        name: "Virtual Staging",
        href: "/pricing/virtual-staging",
        price: {
          kind: "catalog",
          priceKey: "virtual-staging",
          unit: "image",
        },
        mediaSlug: "virtual-staging",
        fallbackVariant: "virtual-staging",
      },
      {
        name: "Virtual Renovation",
        href: "/pricing/virtual-renovation",
        price: { kind: "label", label: "Option-based pricing" },
        mediaSlug: "virtual-renovation",
        fallbackVariant: "virtual-renovation",
      },
      {
        name: "360° Virtual Staging",
        href: "/pricing/360-virtual-staging",
        price: {
          kind: "catalog",
          priceKey: "360-virtual-staging",
          unit: "panorama",
        },
        mediaSlug: "360-virtual-staging",
        fallbackVariant: "panorama-staging",
      },
      {
        name: "360° Image Enhancement",
        href: "/pricing/360-image-enhancement",
        price: {
          kind: "catalog",
          priceKey: "360-image-enhancement",
          unit: "panorama",
        },
        mediaSlug: "360-image-enhancement",
        fallbackVariant: "panorama-enhancement",
      },
    ],
  },
  {
    title: "Plans & Property Visuals",
    services: [
      {
        name: "2D / 3D Floor Plans",
        href: "/pricing/floor-plans",
        price: {
          kind: "catalog",
          priceKey: "floor-plan-2d-bw",
          unit: "floor",
        },
        mediaSlug: "floor-plans",
        fallbackVariant: "floor-plans",
      },
      {
        name: "Development Site Plans",
        href: "/pricing/development-site-plans",
        price: { kind: "label", label: "Quote on request" },
        mediaSlug: "development-site-plans",
        fallbackVariant: "site-plans",
      },
    ],
  },
] as const;

const LOCAL_HUB_SERVICES: readonly LocalHubService[] = [
  {
    serviceId: "photography",
    href: "/local#real-estate-photography",
    mediaSlug: "image-enhancement",
    fallbackVariant: "local-photography",
  },
  {
    serviceId: "360-tours",
    href: "/local#360-virtual-tours",
    mediaSlug: "360-image-enhancement",
    fallbackVariant: "local-360-tour",
  },
  {
    serviceId: "video-tours",
    href: "/local#property-video-tours",
    mediaSlug: "virtual-staging",
    fallbackVariant: "local-video",
  },
  {
    serviceId: "drone-photography",
    href: "/local#drone-aerial-media",
    mediaSlug: "aerial-editing",
    fallbackVariant: "local-drone",
  },
] as const;

const PRICING_NOTES = [
  {
    title: "Pay per service",
    description:
      "Choose only the services and images you need. There is no subscription.",
  },
  {
    title: "Tax-inclusive Checkout",
    description: PUBLIC_TAX_NOTICE,
  },
  {
    title: "Volume pricing available",
    description:
      "Eligible bulk orders can receive volume pricing. Ask us about larger projects.",
  },
] as const;

function renderPriceLabel(price: HubPrice) {
  if (price.kind === "label") return price.label;

  return (
    <CatalogPriceText
      priceKey={price.priceKey}
      prefix="From "
      suffix={` / ${price.unit}`}
    />
  );
}

function getLocalService(serviceId: LocalServiceType) {
  const service = localServices.find((item) => item.id === serviceId);
  if (!service) {
    throw new Error(`Missing local service configuration: ${serviceId}`);
  }
  return service;
}

function getLocalPriceLabel(serviceId: LocalServiceType): string {
  return getLocalPricingPresentation(serviceId).overviewPriceLabel;
}

export default async function PricingPage() {
  const [cardImages, examples] = await Promise.all([
    getOrderCardImages(),
    getOrderServiceExamples(),
  ]);

  function resolveImage(mediaSlug: PortfolioServiceSlug): PricingHubImage | null {
    const example = examples.get(mediaSlug)?.[0];
    if (example) {
      return { url: example.afterUrl, alt: example.afterAlt };
    }

    const cardImage = cardImages.get(mediaSlug);
    if (cardImage) {
      return {
        url: cardImage.url,
        alt: cardImage.alt ?? `${mediaSlug.replaceAll("-", " ")} example`,
      };
    }

    return null;
  }

  return (
    <>
      <section className="bg-primary py-10 sm:py-12 lg:py-14">
        <Container>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Pricing
            </h1>
            <p className="mt-3 text-xl font-semibold text-white sm:text-2xl">
              Clear starting prices.
            </p>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/75 lg:text-lg">
              Choose a service to see examples, options and full pricing.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-white py-14 sm:py-16 lg:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary-dark">
              Worldwide
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl">
              Remote Digital Services
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted lg:text-lg">
              Professional property visuals delivered online. Select a service
              for examples, available options and complete pricing.
            </p>
          </div>

          <div className="mt-12 space-y-14 lg:mt-16 lg:space-y-18">
            {REMOTE_SERVICE_GROUPS.map((group) => {
              const headingId = `pricing-${group.title
                .toLowerCase()
                .replaceAll("&", "and")
                .replaceAll(" ", "-")}`;

              return (
                <div key={group.title} aria-labelledby={headingId}>
                  <div className="mb-6 flex items-center gap-4 lg:mb-8">
                    <h3
                      id={headingId}
                      className="shrink-0 text-lg font-bold tracking-tight text-primary sm:text-xl"
                    >
                      {group.title}
                    </h3>
                    <span className="h-px flex-1 bg-stone-200" aria-hidden />
                  </div>

                  <div className="grid grid-cols-1 gap-x-7 gap-y-10 md:grid-cols-2 xl:grid-cols-3 xl:gap-x-8 xl:gap-y-12">
                    {group.services.map((service) => (
                      <PricingHubServiceTile
                        key={service.href}
                        href={service.href}
                        name={service.name}
                        priceLabel={renderPriceLabel(service.price)}
                        image={resolveImage(service.mediaSlug)}
                        fallbackVariant={service.fallbackVariant}
                        headingLevel={4}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="border-y border-stone-200 bg-stone-50 py-14 sm:py-16 lg:py-20">
        <Container>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary-dark">
                Alicante &amp; Costa Blanca
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl">
                Local Real Estate Media
              </h2>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-muted lg:text-right lg:text-lg">
              On-location photography, tours, video and aerial media for
              properties across the region.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:mt-12 lg:gap-y-12">
            {LOCAL_HUB_SERVICES.map((item) => {
              const service = getLocalService(item.serviceId);
              return (
                <PricingHubServiceTile
                  key={item.serviceId}
                  href={item.href}
                  name={service.name}
                  priceLabel={getLocalPriceLabel(item.serviceId)}
                  image={resolveImage(item.mediaSlug)}
                  fallbackVariant={item.fallbackVariant}
                />
              );
            })}
          </div>
        </Container>
      </section>

      <section className="bg-white py-12 sm:py-14 lg:py-16">
        <Container>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
            {PRICING_NOTES.map((note) => (
              <div key={note.title} className="border-t-2 border-secondary pt-4">
                <h2 className="text-base font-bold text-primary">
                  {note.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {note.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaSection
        title="Ready to get started?"
        subtitle="Choose a service and start your order, or send us a question about the right option for your property."
        primaryLabel="Start an Order"
        primaryHref="/order"
        primaryAnalyticsEvent="pricing_cta"
        secondaryLabel="Ask a Question"
        secondaryHref="/contact"
        secondaryAnalyticsEvent="contact_intent"
      />
    </>
  );
}
