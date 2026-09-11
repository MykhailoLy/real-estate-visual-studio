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
      className="border-y border-border bg-white py-4 sm:py-5 lg:py-6"
    >
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <div
          data-testid="benefits-grid"
          className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-2 md:grid-cols-3 lg:grid-cols-6 lg:gap-0"
        >
          {copy.benefits.map((b, index) => {
            const presentation = BENEFITS[index] ?? BENEFITS[0];
            const Icon = presentation.icon;
            return (
              <div
                key={b.title}
                className="flex min-w-0 items-start gap-3 px-1 py-2.5 sm:block sm:px-3 sm:py-3 sm:text-center lg:border-l lg:border-border lg:px-3 lg:py-2 lg:first:border-l-0 xl:px-5"
              >
                <Icon
                  className={`h-9 w-9 shrink-0 sm:mx-auto sm:h-12 sm:w-12 lg:h-14 lg:w-14 ${presentation.iconClassName}`}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div className="min-w-0 sm:mt-3 lg:mt-3.5">
                  <h3
                    className={`text-[15px] font-bold leading-5 tracking-tight sm:text-base lg:flex lg:min-h-10 lg:items-center lg:justify-center lg:text-base xl:text-lg ${presentation.titleClassName}`}
                  >
                    {b.title}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-muted sm:text-center lg:text-public-copy-sm lg:leading-5 xl:text-base">
                    {b.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
