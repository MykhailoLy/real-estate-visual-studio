import { ArrowRight, Check } from "lucide-react";
import ClientPortalLink from "./ClientPortalLink";
import type { WelcomeOfferAvailability } from "@/lib/welcome-offer";
import { getVisibleDashboardWelcomeOfferBenefits } from "@/lib/dashboard-welcome-offer";

interface DashboardWelcomeOfferProps {
  availability: WelcomeOfferAvailability | null;
  className?: string;
}

/** Display-only view of the authoritative per-client availability read. */
export default function DashboardWelcomeOffer({
  availability,
  className,
}: DashboardWelcomeOfferProps) {
  if (!availability) return null;

  const visibleBenefits = getVisibleDashboardWelcomeOfferBenefits(availability);
  if (visibleBenefits.length === 0) return null;

  return (
    <section
      data-dashboard-section="welcome-offer"
      aria-labelledby="dashboard-welcome-offer-heading"
      className={`overflow-hidden rounded-xl border border-secondary/35 bg-secondary/5 shadow-sm ${className ?? ""}`}
    >
      <div className="border-b border-secondary/25 px-4 py-4">
        <h2
          id="dashboard-welcome-offer-heading"
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
        >
          Welcome Offer
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Available benefits for your first order.
        </p>
      </div>
      <ul className="divide-y divide-secondary/20">
        {visibleBenefits.map((benefit) => (
          <li key={benefit.href}>
            <ClientPortalLink
              href={benefit.href}
              className="group flex min-h-11 items-center gap-2 px-4 py-2.5 transition-colors hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <Check
                className="h-4 w-4 flex-shrink-0 text-secondary-dark"
                aria-hidden
              />
              <span className="min-w-0 flex-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                {benefit.label}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                Start
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </ClientPortalLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
