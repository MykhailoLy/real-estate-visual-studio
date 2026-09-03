"use client";

import { ArrowRight } from "lucide-react";
import ClientPortalLink from "./ClientPortalLink";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import { getOrderServiceCards, type OrderServiceCard } from "@/lib/order-services";
import { getOrderServicePriceLabel } from "@/lib/order-service-price-label";

type ActiveOrderService = OrderServiceCard & { route: string };

function isActiveOrderService(
  service: OrderServiceCard,
): service is ActiveOrderService {
  return service.availability === "active" && service.route !== null;
}

/**
 * Lightweight below-lg service chooser. It intentionally uses the registry
 * only: no card media, examples, portfolio lookups, or image components.
 */
export default function MobileDashboardServiceSelector() {
  const currency = useDisplayCurrency();
  const services = getOrderServiceCards().filter(isActiveOrderService);

  return (
    <section
      aria-labelledby="mobile-dashboard-services-heading"
      data-dashboard-mobile-service-selector
      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:hidden"
    >
      <div className="border-b border-border px-4 py-4">
        <h2
          id="mobile-dashboard-services-heading"
          className="text-dashboard-section font-bold text-primary"
        >
          Services
        </h2>
        <p className="mt-1 text-dashboard-body text-muted">
          Choose a service to start a new order.
        </p>
      </div>

      <ul className="divide-y divide-border">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <li key={service.slug}>
              <ClientPortalLink
                href={service.route}
                className="group flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/5 text-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    data-dashboard-critical-title
                    className="block line-clamp-2 break-words text-dashboard-action font-bold text-foreground transition-colors group-hover:text-primary"
                  >
                    {service.title}
                  </span>
                  <span
                    data-dashboard-metadata
                    className="mt-0.5 block break-words text-dashboard-body font-semibold text-secondary-dark"
                  >
                    {getOrderServicePriceLabel(service, currency)}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 flex-shrink-0 text-muted-light transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </ClientPortalLink>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border px-3 py-2">
        <ClientPortalLink
          href="/dashboard/orders/new"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-dashboard-action font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          View all services
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </ClientPortalLink>
      </div>
    </section>
  );
}
