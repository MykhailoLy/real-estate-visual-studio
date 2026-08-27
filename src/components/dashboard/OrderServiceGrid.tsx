import OrderServiceCard from "@/components/dashboard/OrderServiceCard";
import type { OrderCardImage } from "@/lib/order-card-media";
import type { OrderExamplePair } from "@/lib/order-card-examples";
import type { OrderServiceCard as OrderServiceCardData } from "@/lib/order-services";
import type { PortfolioServiceSlug } from "@/lib/portfolio";

interface OrderServiceGridProps {
  services: readonly OrderServiceCardData[];
  images?: ReadonlyMap<string, OrderCardImage>;
  examples?: ReadonlyMap<PortfolioServiceSlug, OrderExamplePair[]>;
}

/**
 * Shared catalog grid. Without enrichment maps it renders the same usable
 * cards with their branded CSS media fallbacks.
 */
export default function OrderServiceGrid({
  services,
  images,
  examples,
}: OrderServiceGridProps) {
  return (
    <ul
      role="list"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    >
      {services.map((service) => (
        <li key={service.slug} className="flex">
          <OrderServiceCard
            slug={service.slug}
            examples={
              service.portfolioServiceSlug
                ? examples?.get(service.portfolioServiceSlug) ?? []
                : []
            }
            cardImage={
              service.mediaServiceSlug
                ? images?.get(service.mediaServiceSlug) ?? null
                : null
            }
          />
        </li>
      ))}
    </ul>
  );
}
