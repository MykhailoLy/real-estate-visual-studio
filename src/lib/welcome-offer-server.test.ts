import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export default undefined;", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const {
  getWelcomeOfferAvailability,
  WelcomeOfferEligibilityError,
} = await import("./welcome-offer-server.ts");

function fakeSupabase(
  rowsByUser: Record<string, string[]>,
  error = false,
) {
  let userId = "";
  const query = {
    select() {
      return this;
    },
    eq(_column: string, value: string) {
      userId = value;
      return Promise.resolve({
        data: error
          ? null
          : (rowsByUser[userId] ?? []).map((benefit_key) => ({ benefit_key })),
        error: error ? { message: "unavailable" } : null,
      });
    },
  };
  return {
    from(table: string) {
      assert.equal(table, "welcome_offer_redemptions");
      return query;
    },
  };
}

test("redemptions remain independent per benefit and authenticated user", async () => {
  const supabase = fakeSupabase({
    "user-a": ["image-enhancement-free", "day-to-dusk-free"],
    "user-b": ["virtual-staging-first-image-50"],
  });
  assert.deepEqual(
    await getWelcomeOfferAvailability("user-a", supabase as never),
    {
      imageEnhancementAvailable: false,
      dayToDuskAvailable: false,
      virtualStagingAvailable: true,
    },
  );
  assert.deepEqual(
    await getWelcomeOfferAvailability("user-b", supabase as never),
    {
      imageEnhancementAvailable: true,
      dayToDuskAvailable: true,
      virtualStagingAvailable: false,
    },
  );
});

test("eligibility fails closed when authoritative redemption state is unavailable", async () => {
  await assert.rejects(
    getWelcomeOfferAvailability("user-a", fakeSupabase({}, true) as never),
    WelcomeOfferEligibilityError,
  );
});
