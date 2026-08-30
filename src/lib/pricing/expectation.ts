import { PRICING_VERSION } from "./catalog.ts";
import type { OrderQuote, PricingSnapshot } from "./types.ts";
import {
  WELCOME_OFFER_VERSION,
  type WelcomeOfferAvailability,
  type WelcomeOfferBenefitKey,
} from "../welcome-offer.ts";

export interface PricingExpectation {
  pricingVersion: string;
  welcomeOfferVersion: string;
  welcomeBenefitKey: WelcomeOfferBenefitKey | null;
  totalCents: number;
}

export type PricingExpectationComparison =
  | { ok: true }
  | { ok: false; reason: "client_upgrade_required" | "pricing_changed" };

/**
 * Records the exact fixed-price quote the customer reviewed. This is only a
 * comparison handshake; the server always recalculates pricing independently.
 */
export function createPricingExpectation(
  quote: OrderQuote,
): PricingExpectation | undefined {
  if (quote.customQuote || quote.totalCents === null) {
    return undefined;
  }
  return {
    pricingVersion: quote.pricingVersion,
    welcomeOfferVersion: quote.welcomeOffer.version,
    welcomeBenefitKey: quote.welcomeOffer.benefits[0]?.key ?? null,
    totalCents: quote.totalCents,
  };
}

export function comparePricingExpectation(
  expectation: PricingExpectation | undefined,
  authoritativeQuote: OrderQuote,
): PricingExpectationComparison {
  if (
    !expectation ||
    expectation.pricingVersion !== PRICING_VERSION ||
    expectation.welcomeOfferVersion !== WELCOME_OFFER_VERSION
  ) {
    return { ok: false, reason: "client_upgrade_required" };
  }

  const authoritativeBenefitKey =
    authoritativeQuote.welcomeOffer.benefits[0]?.key ?? null;
  if (
    expectation.welcomeBenefitKey !== authoritativeBenefitKey ||
    expectation.totalCents !== authoritativeQuote.totalCents
  ) {
    return { ok: false, reason: "pricing_changed" };
  }

  return { ok: true };
}

/** Updates only the benefit represented by the current service quote. */
export function applyAuthoritativeWelcomeOfferSnapshot(
  current: WelcomeOfferAvailability,
  benefitKey: WelcomeOfferBenefitKey,
  snapshot: PricingSnapshot | undefined,
): WelcomeOfferAvailability {
  if (!snapshot) return current;
  const isAvailable = snapshot.welcomeOffer.benefits.some(
    (benefit) => benefit.key === benefitKey,
  );
  switch (benefitKey) {
    case "image-enhancement-free":
      return { ...current, imageEnhancementAvailable: isAvailable };
    case "day-to-dusk-free":
      return { ...current, dayToDuskAvailable: isAvailable };
    case "virtual-staging-first-image-50":
      return { ...current, virtualStagingAvailable: isAvailable };
  }
}
