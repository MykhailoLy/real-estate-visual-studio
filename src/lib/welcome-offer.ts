import type { PriceKey } from "./pricing/types.ts";

export const WELCOME_OFFER_VERSION = "2026-08-29";

export const WELCOME_OFFER_BENEFIT_KEYS = [
  "image-enhancement-free",
  "day-to-dusk-free",
  "virtual-staging-first-image-50",
] as const;

export type WelcomeOfferBenefitKey =
  (typeof WELCOME_OFFER_BENEFIT_KEYS)[number];

export interface WelcomeOfferAvailability {
  imageEnhancementAvailable: boolean;
  dayToDuskAvailable: boolean;
  virtualStagingAvailable: boolean;
}

export const NO_WELCOME_OFFER_AVAILABLE: WelcomeOfferAvailability = {
  imageEnhancementAvailable: false,
  dayToDuskAvailable: false,
  virtualStagingAvailable: false,
};

export const WELCOME_OFFER_BENEFIT_RULES: Record<
  WelcomeOfferBenefitKey,
  { priceKey: PriceKey; discountPercent: 50 | 100 }
> = {
  "image-enhancement-free": {
    priceKey: "image-enhancement",
    discountPercent: 100,
  },
  "day-to-dusk-free": {
    priceKey: "day-to-dusk",
    discountPercent: 100,
  },
  "virtual-staging-first-image-50": {
    priceKey: "virtual-staging",
    discountPercent: 50,
  },
};

export function isWelcomeOfferBenefitKey(
  value: unknown,
): value is WelcomeOfferBenefitKey {
  return (
    typeof value === "string" &&
    (WELCOME_OFFER_BENEFIT_KEYS as readonly string[]).includes(value)
  );
}

export const WELCOME_OFFER_PUBLIC_COPY = {
  en: {
    short:
      "Welcome Offer — 1 Image Enhancement free, 1 Day to Dusk free, and 50% off your first Virtual Staging image.",
    rules:
      "Each benefit can be used once per account. Welcome Offer pricing does not combine with a volume discount on the same image.",
  },
  es: {
    short:
      "Oferta de bienvenida — 1 mejora de imagen gratis, 1 conversión Day to Dusk gratis y un 50 % de descuento en tu primera imagen de Virtual Staging.",
    rules:
      "Cada ventaja puede utilizarse una sola vez por cuenta. La oferta de bienvenida no se acumula con un descuento por volumen en la misma imagen.",
  },
} as const;
