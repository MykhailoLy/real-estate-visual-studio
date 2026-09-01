import {
  Clock,
  CreditCard,
  RefreshCw,
  Eye,
  ShieldCheck,
  Gift,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WELCOME_OFFER_PUBLIC_COPY } from "@/lib/welcome-offer";

// ============================================================
// Compact supporting proof strip. The benefits stay visually secondary to
// the service work while remaining easy to scan at every viewport.
// ============================================================

export type BenefitCopy = {
  title: string;
  body: string;
};

export type BenefitsRowCopy = {
  ariaLabel: string;
  benefits: BenefitCopy[];
};

const BENEFITS: (BenefitCopy & { icon: LucideIcon })[] = [
  {
    icon: Clock,
    title: "Fast Turnaround",
    body: "Standard delivery in 24-48 hours from the moment we have everything we need.",
  },
  {
    icon: CreditCard,
    title: "No Subscriptions",
    body: "Pay per image or per project. No monthly fees, no minimum commitments.",
  },
  {
    icon: RefreshCw,
    title: "Revisions Included",
    body: "Unlimited revisions are included for 30 calendar days from first delivery when changes stay within the original brief and design direction.",
  },
  {
    icon: Eye,
    title: "Real Human Review",
    body: "Every order is checked by an editor for realism and listing-quality presentation.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Uploads",
    body: "Files go straight to private storage over signed URLs. Your photos stay yours.",
  },
  {
    icon: Gift,
    title: WELCOME_OFFER_PUBLIC_COPY.en.title,
    body: WELCOME_OFFER_PUBLIC_COPY.en.benefitSummary,
  },
];

const DEFAULT_COPY: BenefitsRowCopy = {
  ariaLabel: "PicchuSpot benefits",
  benefits: BENEFITS,
};

export default function BenefitsRow({
  copy = DEFAULT_COPY,
}: {
  copy?: BenefitsRowCopy;
}) {
  return (
    <section
      aria-label={copy.ariaLabel}
      className="bg-ivory border-y border-border py-5 sm:py-6 lg:py-7"
    >
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div
          data-testid="benefits-grid"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px overflow-hidden rounded-xl border border-border bg-border"
        >
          {copy.benefits.map((b, index) => {
            const Icon = BENEFITS[index]?.icon ?? Clock;
            return (
              <div
                key={b.title}
                className="min-w-0 bg-white px-4 py-4 sm:px-5 lg:px-4 lg:py-4"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon
                    className="h-5 w-5"
                    aria-hidden
                  />
                </div>
                <h3 className="mt-3 text-sm font-bold tracking-tight text-foreground lg:text-[15px]">
                  {b.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted lg:text-[13px]">
                  {b.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
