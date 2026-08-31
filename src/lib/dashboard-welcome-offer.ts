import type {
  WelcomeOfferAvailability,
  WelcomeOfferBenefitKey,
} from "./welcome-offer.ts";

export interface DashboardWelcomeOfferBenefit {
  key: WelcomeOfferBenefitKey;
  label: string;
  href: string;
}

const DASHBOARD_WELCOME_OFFER_BENEFITS: readonly DashboardWelcomeOfferBenefit[] = [
  {
    key: "image-enhancement-free",
    label: "1 Image Enhancement free",
    href: "/dashboard/orders/new/image-enhancement/single-exposure",
  },
  {
    key: "day-to-dusk-free",
    label: "1 Day to Dusk free",
    href: "/dashboard/orders/new/day-to-dusk",
  },
  {
    key: "virtual-staging-first-image-50",
    label: "50% off first Virtual Staging image",
    href: "/dashboard/orders/new/virtual-staging",
  },
];

const availabilityByBenefitKey: Record<
  WelcomeOfferBenefitKey,
  keyof WelcomeOfferAvailability
> = {
  "image-enhancement-free": "imageEnhancementAvailable",
  "day-to-dusk-free": "dayToDuskAvailable",
  "virtual-staging-first-image-50": "virtualStagingAvailable",
};

/** Null intentionally means the authoritative eligibility read failed. */
export function getVisibleDashboardWelcomeOfferBenefits(
  availability: WelcomeOfferAvailability | null,
): readonly DashboardWelcomeOfferBenefit[] {
  if (!availability) return [];

  return DASHBOARD_WELCOME_OFFER_BENEFITS.filter(
    (benefit) => availability[availabilityByBenefitKey[benefit.key]],
  );
}
