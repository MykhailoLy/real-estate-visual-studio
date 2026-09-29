import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  getMissingProfileCompletionFields,
  isProfileComplete,
  resolveClientIdentity,
  resolveProfileName,
  type ProfileCompletionFields,
} from "./profile-completion.ts";

const SOURCE_DIRECTORY = fileURLToPath(new URL("../", import.meta.url));

function source(path: string): string {
  return readFileSync(join(SOURCE_DIRECTORY, path), "utf8");
}

function profile(
  overrides: Partial<ProfileCompletionFields> = {},
): ProfileCompletionFields {
  return {
    first_name: "Jane",
    last_name: "Smith",
    full_name: "Jane Smith",
    phone: "+34 600 000 000",
    company_name: "Example Realty",
    ...overrides,
  };
}

test("profile completion requires a usable name and phone", () => {
  assert.equal(isProfileComplete(null), false);
  assert.deepEqual(getMissingProfileCompletionFields(null), ["name", "phone"]);

  assert.equal(isProfileComplete(profile()), true);
  assert.deepEqual(getMissingProfileCompletionFields(profile()), []);

  assert.equal(
    isProfileComplete(
      profile({ full_name: null, first_name: " Jane ", last_name: " Smith " }),
    ),
    true,
  );
  assert.equal(
    resolveProfileName(
      profile({ full_name: null, first_name: " Jane ", last_name: " Smith " }),
    ),
    "Jane Smith",
  );

  assert.deepEqual(
    getMissingProfileCompletionFields(
      profile({ full_name: "   ", first_name: " ", last_name: " " }),
    ),
    ["name"],
  );
  assert.deepEqual(
    getMissingProfileCompletionFields(profile({ phone: "   " })),
    ["phone"],
  );
});

test("resolved order identity uses the verified email and normalized profile fields", () => {
  assert.deepEqual(
    resolveClientIdentity(
      "verified@example.com",
      profile({
        full_name: "  Jane Smith  ",
        phone: "  +34 600 000 000  ",
        company_name: "  Example Realty  ",
      }),
    ),
    {
      name: "Jane Smith",
      email: "verified@example.com",
      phone: "+34 600 000 000",
      company: "Example Realty",
    },
  );

  assert.equal(
    resolveClientIdentity("verified@example.com", profile({ phone: null })),
    null,
  );
  assert.equal(resolveClientIdentity("", profile()), null);
});

test("profile completion is optional for portal browsing but remains required at the order boundary", () => {
  const layoutSource = source("app/(default)/(dashboard)/layout.tsx");
  const dashboardSource = source("app/(default)/(dashboard)/dashboard/page.tsx");
  const newOrderLayoutSource = source(
    "app/(default)/(dashboard)/dashboard/orders/new/layout.tsx",
  );
  const orderAccessSource = source("lib/order-access.ts");
  const profilePageSource = source("app/(default)/(dashboard)/dashboard/profile/page.tsx");
  const profileFormSource = source("components/dashboard/ClientProfileForm.tsx");
  const callbackSource = source("app/auth/callback/route.ts");
  const profileApiSource = source("app/api/profile/upsert/route.ts");
  const orderApiSource = source("app/(public)/api/order/route.ts");

  // Incomplete profiles must not trap clients at the portal boundary or the
  // dashboard home.
  assert.doesNotMatch(layoutSource, /isProfileComplete/);
  assert.doesNotMatch(dashboardSource, /isProfileComplete/);

  // Concrete order routes render a stable contact-details gate instead of
  // throwing a redirect during client navigation. The service hub remains
  // browseable without profile completion.
  assert.match(newOrderLayoutSource, /!isProfileComplete\(profile\)/);
  assert.match(
    newOrderLayoutSource,
    /destinationPathname !== "\/dashboard\/orders\/new"/,
  );
  assert.match(newOrderLayoutSource, /Add contact details to place this order/);
  assert.match(newOrderLayoutSource, /Complete profile/);
  assert.match(newOrderLayoutSource, /Back to dashboard/);

  // Individual order pages only require authenticated session identity; the
  // shared layout owns the pre-form UX gate.
  assert.doesNotMatch(orderAccessSource, /isProfileComplete/);
  assert.doesNotMatch(orderAccessSource, /dashboard\/profile/);

  // The profile screen remains available, onboarding can be dismissed, and
  // authenticated callback flows may still suggest onboarding once.
  assert.match(profilePageSource, /!isProfileComplete\(profile\)/);
  assert.match(profileFormSource, /Skip for now/);
  assert.match(profileFormSource, /Save and continue to order/);
  assert.match(
    callbackSource,
    /\.select\("first_name, last_name, full_name, phone"\)/,
  );
  assert.match(callbackSource, /!isProfileComplete\(profile\)/);

  // Saving an order-capable profile and creating an order remain fail-closed.
  assert.match(profileApiSource, /getMissingProfileCompletionFields\(candidate\)/);
  assert.match(profileApiSource, /code: "profile-incomplete"/);
  assert.match(profileApiSource, /status: 422/);

  assert.match(orderApiSource, /resolveClientIdentity\(sessionUser\.email, profile\)/);
  assert.match(orderApiSource, /code: "profile-incomplete"/);
});
