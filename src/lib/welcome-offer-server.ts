import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase-admin.ts";
import {
  WELCOME_OFFER_BENEFIT_KEYS,
  type WelcomeOfferAvailability,
  type WelcomeOfferBenefitKey,
} from "./welcome-offer.ts";

export class WelcomeOfferEligibilityError extends Error {
  constructor() {
    super("Welcome Offer eligibility could not be verified.");
    this.name = "WelcomeOfferEligibilityError";
  }
}

export async function getWelcomeOfferAvailability(
  authenticatedUserId: string,
  supabase: SupabaseClient = getSupabaseAdminClient(),
): Promise<WelcomeOfferAvailability> {
  const { data, error } = await supabase
    .from("welcome_offer_redemptions")
    .select("benefit_key")
    .eq("user_id", authenticatedUserId);

  if (error || !Array.isArray(data)) {
    throw new WelcomeOfferEligibilityError();
  }

  const redeemed = new Set<WelcomeOfferBenefitKey>();
  for (const row of data) {
    const key = row?.benefit_key;
    if (
      typeof key === "string" &&
      (WELCOME_OFFER_BENEFIT_KEYS as readonly string[]).includes(key)
    ) {
      redeemed.add(key as WelcomeOfferBenefitKey);
    }
  }

  return {
    imageEnhancementAvailable: !redeemed.has("image-enhancement-free"),
    dayToDuskAvailable: !redeemed.has("day-to-dusk-free"),
    virtualStagingAvailable: !redeemed.has(
      "virtual-staging-first-image-50",
    ),
  };
}
