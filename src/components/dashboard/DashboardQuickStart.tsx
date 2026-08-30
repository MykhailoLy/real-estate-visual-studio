import { ArrowRight, PlusCircle } from "lucide-react";
import ClientPortalLink from "./ClientPortalLink";
import type { OrderServiceCard } from "@/lib/order-services";

interface DashboardQuickStartProps {
  services: readonly OrderServiceCard[];
  isFirstOrder: boolean;
}

type ActiveOrderService = OrderServiceCard & { route: string };

function isActiveOrderService(
  service: OrderServiceCard,
): service is ActiveOrderService {
  return service.availability === "active" && service.route !== null;
}

export default function DashboardQuickStart({
  services,
  isFirstOrder,
}: DashboardQuickStartProps) {
  const quickStartServices = services.filter(isActiveOrderService).slice(0, 6);

  return (
    <section
      aria-labelledby="start-new-order-heading"
      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary-dark">
          Service launcher
        </p>
        <h2
          id="start-new-order-heading"
          className="mt-1 text-lg font-bold text-primary"
        >
          Start a new order
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Choose an available service to open its existing order form.
        </p>
      </div>

      {isFirstOrder && (
        <div className="border-b border-border bg-surface/60 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-secondary-dark">
              <PlusCircle className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Ready for your first order?
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Start with the service you need. Your new job will appear in
                this workspace after it is submitted.
              </p>
            </div>
          </div>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
        {quickStartServices.map((service) => {
          const Icon = service.icon;
          return (
            <li key={service.slug} className="min-w-0 bg-white">
              <ClientPortalLink
                href={service.route}
                className="group flex min-h-24 items-start gap-3 p-4 transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5"
              >
                <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold leading-snug text-foreground group-hover:text-primary">
                      {service.title}
                    </span>
                    <ArrowRight
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-light transition-colors group-hover:text-primary"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {service.description}
                  </span>
                </span>
              </ClientPortalLink>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border px-4 py-3 sm:px-5">
        <ClientPortalLink
          href="/dashboard/orders/new"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          View all services
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ClientPortalLink>
      </div>
    </section>
  );
}
