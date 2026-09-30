import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

test("profile completion requires only a usable name", () => {
  assert.equal(isProfileComplete(null), false);
  assert.deepEqual(getMissingProfileCompletionFields(null), ["name"]);

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
    [],
  );
  for (const phone of [undefined, null, "", "   "]) {
    for (const company_name of [undefined, null, "", "   "]) {
      assert.equal(isProfileComplete({ full_name: "Client", phone, company_name }), true);
    }
  }
  assert.equal(isProfileComplete({ first_name: " Client " }), true);
  assert.equal(isProfileComplete({ phone: "123456", company_name: "Company" }), false);
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

  assert.deepEqual(
    resolveClientIdentity("verified@example.com", profile({ phone: null })),
    { name: "Jane Smith", email: "verified@example.com", phone: "", company: "Example Realty" },
  );
  assert.deepEqual(resolveClientIdentity("verified@example.com", { full_name: "Client", company_name: "" }),
    { name: "Client", email: "verified@example.com", phone: "", company: null });
  assert.equal(resolveClientIdentity("verified@example.com", { full_name: "  ", phone: "123" }), null);
  assert.equal(resolveClientIdentity("", profile()), null);
});

test("profile completion is optional for portal browsing but remains required at the order boundary", () => {
  const layoutSource = source("app/(default)/(dashboard)/layout.tsx");
  const dashboardSource = source("app/(default)/(dashboard)/dashboard/page.tsx");
  const newOrderLayoutSource = source(
    "app/(default)/(dashboard)/dashboard/orders/new/layout.tsx",
  );
  const orderingLayoutSource = source(
    "app/(default)/(dashboard)/dashboard/orders/new/(ordering)/layout.tsx",
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
  assert.doesNotMatch(newOrderLayoutSource, /isProfileComplete|DASHBOARD_REQUEST_PATH_HEADER/);
  assert.match(newOrderLayoutSource, /<PartnerPricingProvider/);
  assert.match(newOrderLayoutSource, /<OrderSubmissionRecoveryGate>\{children\}/);
  assert.match(orderingLayoutSource, /getDashboardRequestUser\(\)/);
  assert.match(orderingLayoutSource, /getDashboardRequestProfile\(\)/);
  assert.match(orderingLayoutSource, /user\.isQaPreview \|\| isProfileComplete\(profile\)/);
  assert.doesNotMatch(orderingLayoutSource, /redirect\(/);
  assert.match(orderingLayoutSource, /Add your name to place this order/);
  assert.doesNotMatch(orderingLayoutSource, /name and phone/);
  assert.match(orderingLayoutSource, /Complete profile/);
  assert.match(orderingLayoutSource, /Back to dashboard/);
  assert.match(orderingLayoutSource, /safeDashboardRequestPath\(/);
  assert.match(orderingLayoutSource, /encodeURIComponent\(destination\)/);

  // Individual order pages only require authenticated session identity; the
  // ordering route-group layout owns the pre-form UX gate.
  assert.doesNotMatch(orderAccessSource, /isProfileComplete/);
  assert.doesNotMatch(orderAccessSource, /dashboard\/profile/);

  // The profile screen remains available, onboarding can be dismissed, and
  // authenticated callback flows may still suggest onboarding once.
  assert.match(profilePageSource, /!isProfileComplete\(profile\)/);
  assert.match(profileFormSource, /Skip for now/);
  assert.match(profileFormSource, /Save and continue to order/);
  assert.doesNotMatch(profileFormSource, /name and phone/);
  for (const label of ["Phone", "Company name", "Country", "Industry"]) {
    assert.ok(profileFormSource.includes(`${label} — Optional`));
  }
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

test("only concrete order pages enter the profile-gated route group without duplicate URLs", () => {
  const newOrderRoot = join(SOURCE_DIRECTORY, "app/(default)/(dashboard)/dashboard/orders/new");
  const concretePages = [
    "3d-floor-plans/page.tsx",
    "day-to-dusk/page.tsx",
    "image-enhancement/page.tsx",
    "image-enhancement/hdr-bracketed/page.tsx",
    "image-enhancement/single-exposure/page.tsx",
    "item-removal-virtual-cleaning/page.tsx",
    "photo-editing/page.tsx",
    "virtual-renovation/page.tsx",
    "virtual-staging/page.tsx",
  ];
  assert.ok(existsSync(join(newOrderRoot, "page.tsx")), "catalogue stays outside the gate");
  assert.ok(!existsSync(join(newOrderRoot, "(ordering)/page.tsx")));
  for (const page of concretePages) {
    assert.ok(existsSync(join(newOrderRoot, "(ordering)", page)), page);
    assert.ok(!existsSync(join(newOrderRoot, page)), `no duplicate route: ${page}`);
  }
  const actualPages = readdirSync(newOrderRoot, { recursive: true })
    .map(String)
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => path.endsWith("page.tsx"))
    .sort();
  assert.deepEqual(actualPages, ["page.tsx", ...concretePages.map((page) => `(ordering)/${page}`)].sort());
});
