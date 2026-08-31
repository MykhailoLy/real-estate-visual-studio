import { ArrowRight } from "lucide-react";
import ClientPortalLink from "./ClientPortalLink";
import OrderServiceGrid from "./OrderServiceGrid";
import type { OrderCardImage } from "@/lib/order-card-media";
import type { OrderExamplePair } from "@/lib/order-card-examples";
import type { OrderServiceCard } from "@/lib/order-services";
import type { PortfolioServiceSlug } from "@/lib/portfolio";

interface DashboardQuickStartProps {
  services: readonly OrderServiceCard[];
  images?: ReadonlyMap<string, OrderCardImage>;
  examples?: ReadonlyMap<PortfolioServiceSlug, OrderExamplePair[]>;
}

type ActiveOrderService = OrderServiceCard & { route: string };

function isActiveOrderService(
  service: OrderServiceCard,
): service is ActiveOrderService {
  return service.availability === "active" && service.route !== null;
}

export default function DashboardQuickStart({
  services,
  images,
  examples,
}: DashboardQuickStartProps) {
  const quickStartServices = services.filter(isActiveOrderService).slice(0, 6);

  return (
    <section
      aria-labelledby="start-new-order-heading"
      className="min-w-0"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="start-new-order-heading"
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
          >
            Services
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Choose a service to upload your photos and start a new order.
          </p>
        </div>
        <ClientPortalLink
          href="/dashboard/orders/new"
          className="inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          View all services
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ClientPortalLink>
      </div>

      <OrderServiceGrid
        services={quickStartServices}
        images={images}
        examples={examples}
        layout="dashboard"
      />
    </section>
  );
}
