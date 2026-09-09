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

test("onboarding, profile saves, and order entry share the profile-completeness contract", () => {
  const layoutSource = source("app/(dashboard)/layout.tsx");
  const dashboardSource = source("app/(dashboard)/dashboard/page.tsx");
  const profilePageSource = source("app/(dashboard)/dashboard/profile/page.tsx");
  const callbackSource = source("app/auth/callback/route.ts");
  const profileApiSource = source("app/api/profile/upsert/route.ts");
  const orderApiSource = source("app/(public)/api/order/route.ts");

  assert.match(layoutSource, /!isProfileComplete\(profile\)/);
  assert.match(layoutSource, /destinationPathname !== "\/dashboard\/profile"/);
  assert.match(layoutSource, /params\.set\("next", destination\)/);

  assert.match(dashboardSource, /!isProfileComplete\(profile\)/);
  assert.doesNotMatch(dashboardSource, /profile === null/);

  assert.match(profilePageSource, /!isProfileComplete\(profile\)/);

  assert.match(
    callbackSource,
    /\.select\("first_name, last_name, full_name, phone"\)/,
  );
  assert.match(callbackSource, /!isProfileComplete\(profile\)/);

  assert.match(profileApiSource, /getMissingProfileCompletionFields\(candidate\)/);
  assert.match(profileApiSource, /code: "profile-incomplete"/);
  assert.match(profileApiSource, /status: 422/);

  assert.match(orderApiSource, /resolveClientIdentity\(sessionUser\.email, profile\)/);
  assert.match(orderApiSource, /code: "profile-incomplete"/);
});
