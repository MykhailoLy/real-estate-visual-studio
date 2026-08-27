import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { mapDashboardClientUserFromClaims } from "./dashboard-client-auth-utils.ts";
import { getOrderServiceCatalog } from "./order-service-catalog.ts";
import { hasVerifiedAuthenticatedSubject } from "./supabase/auth-claims.ts";

const SOURCE_DIRECTORY = fileURLToPath(new URL("../", import.meta.url));

function source(path: string): string {
  return readFileSync(join(SOURCE_DIRECTORY, path), "utf8");
}

test("verified auth claims require an authenticated role and non-empty subject", () => {
  assert.equal(hasVerifiedAuthenticatedSubject(null), false);
  assert.equal(hasVerifiedAuthenticatedSubject({}), false);
  assert.equal(
    hasVerifiedAuthenticatedSubject({
      sub: "11111111-1111-4111-8111-111111111111",
      role: "authenticated",
    }),
    true,
  );
  assert.equal(
    hasVerifiedAuthenticatedSubject({
      sub: "11111111-1111-4111-8111-111111111111",
    }),
    false,
  );
  assert.equal(
    hasVerifiedAuthenticatedSubject({
      sub: "11111111-1111-4111-8111-111111111111",
      role: "anon",
    }),
    false,
  );
  assert.equal(
    hasVerifiedAuthenticatedSubject({
      sub: "11111111-1111-4111-8111-111111111111",
      role: "service_role",
    }),
    false,
  );
  assert.equal(
    hasVerifiedAuthenticatedSubject({ sub: "", role: "authenticated" }),
    false,
  );
  assert.equal(
    hasVerifiedAuthenticatedSubject({ sub: "   ", role: "authenticated" }),
    false,
  );
});

test("dashboard claims identity maps safe presentation fields", () => {
  assert.deepEqual(
    mapDashboardClientUserFromClaims({
      sub: "11111111-1111-4111-8111-111111111111",
      role: "authenticated",
      email: "alex@example.com",
      user_metadata: {
        full_name: "  Alex Rivera  ",
        avatar_url: "https://images.example.com/avatar.jpg",
      },
    }),
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "alex@example.com",
      displayName: "Alex Rivera",
      firstName: "Alex",
      avatarUrl: "https://images.example.com/avatar.jpg",
    },
  );

  assert.equal(
    mapDashboardClientUserFromClaims({
      sub: "22222222-2222-4222-8222-222222222222",
      role: "authenticated",
      user_metadata: { picture: "javascript:alert(1)" },
    })?.avatarUrl,
    null,
  );

  assert.deepEqual(
    mapDashboardClientUserFromClaims({
      sub: "33333333-3333-4333-8333-333333333333",
      role: "authenticated",
      email: "fallback@example.com",
    }),
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "fallback@example.com",
      displayName: "fallback",
      firstName: "fallback",
      avatarUrl: null,
    },
  );

  assert.equal(
    mapDashboardClientUserFromClaims({
      role: "authenticated",
      email: "no-sub@example.com",
    }),
    null,
  );
  assert.equal(
    mapDashboardClientUserFromClaims({
      sub: "44444444-4444-4444-8444-444444444444",
      role: "authenticated",
    })?.displayName,
    "Client",
  );
});

test("proxy authorizes only verified claims and keeps fail-closed redirects", () => {
  const proxySource = source("proxy.ts");

  assert.match(proxySource, /await supabase\.auth\.getClaims\(\)/);
  assert.match(
    proxySource,
    /!error && hasVerifiedAuthenticatedSubject\(data\?\.claims\)/,
  );
  assert.doesNotMatch(proxySource, /supabase\.auth\.getSession\(/);
  assert.doesNotMatch(proxySource, /supabase\.auth\.getUser\(/);
  assert.match(proxySource, /loginUrl\.pathname = "\/login"/);
  assert.match(proxySource, /loginUrl\.searchParams\.set\("redirectTo", pathname\)/);
  assert.match(proxySource, /pathname === "\/login" \|\| pathname === "\/signup"/);
  assert.match(proxySource, /dashboardUrl\.pathname = "\/dashboard"/);
});

test("proxy cookie propagation and order-security user verification stay intact", () => {
  const proxyClientSource = source("lib/supabase/proxy-client.ts");
  const clientAuthSource = source("lib/client-auth.ts");
  const orderAccessSource = source("lib/order-access.ts");

  assert.match(proxyClientSource, /req\.cookies\.set\(name, value\)/);
  assert.match(proxyClientSource, /res\.cookies\.set\(name, value, options\)/);
  assert.match(clientAuthSource, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(clientAuthSource, /supabase\.auth\.getClaims\(\)/);
  assert.match(orderAccessSource, /const user = await getClientUser\(\)/);
});

test("public account menu disables automatic dashboard prefetch fan-out", () => {
  const menuSource = source("components/auth/PublicAccountMenu.tsx");

  assert.match(menuSource, /accountMenuItems\.map\(\(item\) =>/);
  assert.match(menuSource, /href=\{item\.href\}[\s\S]*?prefetch=\{false\}/);
  assert.doesNotMatch(menuSource, /router\.prefetch|useRouter/);
});

test("New Order catalog is usable before media enrichment resolves", () => {
  const pageSource = source("app/(dashboard)/dashboard/orders/new/page.tsx");
  const gridSource = source("components/dashboard/OrderServiceGrid.tsx");
  const loadingSource = source("app/(dashboard)/dashboard/orders/new/loading.tsx");

  assert.match(
    pageSource,
    /<Suspense fallback=\{<OrderServiceGrid services=\{services\} \/>\}>/,
  );
  assert.match(pageSource, /async function EnrichedOrderServiceGrid/);
  assert.match(
    pageSource,
    /Promise\.all\(\[\s*getOrderCardImages\(\),\s*getOrderServiceExamples\(\),\s*\]\)/,
  );
  assert.match(gridSource, /examples\?\.get\(service\.portfolioServiceSlug\) \?\? \[\]/);
  assert.match(gridSource, /images\?\.get\(service\.mediaServiceSlug\) \?\? null/);
  assert.match(gridSource, /<OrderServiceCard/);
  assert.match(pageSource, /<SavedDraftsSection \/>/);
  assert.match(loadingSource, /Loading New Order catalog/);
});

test("service Start Order destinations remain unchanged", () => {
  assert.deepEqual(
    getOrderServiceCatalog().map(({ slug, route }) => [slug, route]),
    [
      ["image-enhancement", "/dashboard/orders/new/image-enhancement"],
      ["day-to-dusk", "/dashboard/orders/new/day-to-dusk"],
      ["virtual-staging", "/dashboard/orders/new/virtual-staging"],
      [
        "item-removal-virtual-cleaning",
        "/dashboard/orders/new/item-removal-virtual-cleaning",
      ],
      ["floor-plans", "/dashboard/orders/new/3d-floor-plans"],
      ["virtual-renovation", "/dashboard/orders/new/virtual-renovation"],
      ["360-image-enhancement", null],
      ["360-virtual-staging", null],
      ["aerial-editing", "/dashboard/orders/new/photo-editing"],
      ["development-site-plans", null],
    ],
  );
});
