import { ArrowRight, Gift } from "lucide-react";
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
      className={`overflow-hidden rounded-xl border border-primary bg-primary shadow-lg shadow-primary/15 ${className ?? ""}`}
    >
      <div className="border-b border-white/15 bg-gradient-to-br from-primary-light to-primary px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-secondary/35 bg-secondary/15 text-secondary">
            <Gift className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2
              id="dashboard-welcome-offer-heading"
              className="text-[11px] font-bold uppercase tracking-[0.18em] text-white"
            >
              Welcome Offer
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-white/75">
              Available benefits for your first order.
            </p>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-white/12">
        {visibleBenefits.map((benefit) => (
          <li key={benefit.href}>
            <ClientPortalLink
              href={benefit.href}
              className="group flex min-h-11 items-center gap-2 px-4 py-3 transition-colors hover:bg-white/10 focus:outline-none focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
            >
              <Gift
                className="h-4 w-4 flex-shrink-0 text-secondary"
                aria-hidden
              />
              <span className="min-w-0 flex-1 text-sm font-semibold text-white transition-colors group-hover:text-secondary group-focus-visible:text-secondary">
                {benefit.label}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary">
                Use offer
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5"
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
