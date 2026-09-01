import {
  CalendarX2,
  Clock3,
  RefreshCcw,
  ShieldCheck,
  Gift,
  UserCheck,
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

const BENEFITS: (BenefitCopy & {
  icon: LucideIcon;
  iconClassName: string;
  titleClassName: string;
})[] = [
  {
    icon: Clock3,
    iconClassName: "text-primary",
    titleClassName: "text-foreground",
    title: "Fast Turnaround",
    body: "Standard delivery in 24-48 hours from the moment we have everything we need.",
  },
  {
    icon: CalendarX2,
    iconClassName: "text-primary",
    titleClassName: "text-foreground",
    title: "No Subscriptions",
    body: "Pay per image or per project. No monthly fees, no minimum commitments.",
  },
  {
    icon: RefreshCcw,
    iconClassName: "text-primary",
    titleClassName: "text-foreground",
    title: "Revisions Included",
    body: "Unlimited revisions are included for 30 calendar days from first delivery when changes stay within the original brief and design direction.",
  },
  {
    icon: UserCheck,
    iconClassName: "text-primary",
    titleClassName: "text-foreground",
    title: "Real Human Review",
    body: "Every order is checked by an editor for realism and listing-quality presentation.",
  },
  {
    icon: ShieldCheck,
    iconClassName: "text-primary",
    titleClassName: "text-foreground",
    title: "Secure Uploads",
    body: "Files go straight to private storage over signed URLs. Your photos stay yours.",
  },
  {
    icon: Gift,
    iconClassName: "text-secondary",
    titleClassName: "text-secondary-dark",
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
            const presentation = BENEFITS[index] ?? BENEFITS[0];
            const Icon = presentation.icon;
            return (
              <div
                key={b.title}
                className="min-w-0 bg-white px-4 py-4 sm:px-5 lg:px-4 lg:py-4 lg:text-center"
              >
                <Icon
                  className={`h-8 w-8 sm:h-9 sm:w-9 lg:mx-auto lg:h-10 lg:w-10 ${presentation.iconClassName}`}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <h3 className={`mt-3 text-sm font-bold tracking-tight lg:text-[15px] ${presentation.titleClassName}`}>
                  {b.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted lg:text-[13px] lg:text-center">
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
