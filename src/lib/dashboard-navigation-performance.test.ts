import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  enrichOrderSubServices,
  SUB_SERVICE_ENRICHMENT_TIMEOUT_MS,
} from "./client-order-enrichment.ts";
import {
  DASHBOARD_REQUEST_PATH_HEADER,
  safeDashboardRequestPath,
} from "./dashboard-request-path.ts";
import { getOrderServiceCatalog } from "./order-service-catalog.ts";
import { hasVerifiedAuthenticatedSubject } from "./supabase/auth-claims.ts";

const SOURCE_DIRECTORY = fileURLToPath(new URL("../", import.meta.url));

function source(path: string): string {
  return readFileSync(join(SOURCE_DIRECTORY, path), "utf8");
}

function sourceFilesUnder(path: string): string[] {
  const root = join(SOURCE_DIRECTORY, path);
  const files: string[] = [];

  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
        files.push(relative(SOURCE_DIRECTORY, fullPath).replaceAll("\\", "/"));
      }
    }
  };

  visit(root);
  return files;
}

test("authenticated claims helper remains strict for login-page convenience redirects", () => {
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
});

test("dashboard redirect recovery preserves safe exact paths and query parameters", () => {
  const draftId = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    safeDashboardRequestPath(`/dashboard/orders/new?draft=${draftId}`),
    `/dashboard/orders/new?draft=${draftId}`,
  );
  assert.equal(
    safeDashboardRequestPath(
      `/dashboard/orders/new?draft=${draftId}&_rsc=cache-buster`,
    ),
    `/dashboard/orders/new?draft=${draftId}`,
  );
  assert.equal(
    safeDashboardRequestPath("/dashboard/jobs?status=completed"),
    "/dashboard/jobs?status=completed",
  );
});

test("dashboard redirect recovery rejects external, malicious, and out-of-scope paths", () => {
  assert.equal(
    safeDashboardRequestPath("https://evil.example/dashboard"),
    "/dashboard",
  );
  assert.equal(
    safeDashboardRequestPath("//evil.example/dashboard"),
    "/dashboard",
  );
  assert.equal(safeDashboardRequestPath("/admin/orders"), "/dashboard");
  assert.equal(safeDashboardRequestPath("/dashboard\\evil"), "/dashboard");
  assert.equal(safeDashboardRequestPath(null), "/dashboard");
});

test("dashboard proxy refreshes cookies without authorizing from getSession or getClaims", () => {
  const proxySource = source("proxy.ts");
  const dashboardBranchStart = proxySource.indexOf("if (isDashboard) {");
  const authPageBranchStart = proxySource.indexOf("let authenticated = false;");
  const dashboardBranch = proxySource.slice(
    dashboardBranchStart,
    authPageBranchStart,
  );

  assert.ok(
    dashboardBranchStart >= 0 && authPageBranchStart > dashboardBranchStart,
  );
  assert.match(dashboardBranch, /await supabase\.auth\.getSession\(\);/);
  assert.doesNotMatch(
    dashboardBranch,
    /\.auth\.(?:getClaims|getUser)\(|authenticated\s*=/,
  );
  assert.match(dashboardBranch, /return getResponse\(\);/);
  assert.ok(
    proxySource.indexOf("await supabase.auth.getClaims()") >
      authPageBranchStart,
  );
  assert.doesNotMatch(
    proxySource,
    /(?:const|let)\s+\{[^}]*session[^}]*\}\s*=\s*await supabase\.auth\.getSession/,
  );
});

test("proxy overwrites browser redirect metadata and preserves refreshed cookies", () => {
  const proxySource = source("proxy.ts");
  const proxyClientSource = source("lib/supabase/proxy-client.ts");

  assert.match(
    proxySource,
    /safeDashboardRequestPath\(`\$\{pathname\}\$\{req\.nextUrl\.search\}`\)/,
  );
  assert.match(
    proxySource,
    /\[DASHBOARD_REQUEST_PATH_HEADER\]: dashboardDestination/,
  );
  assert.equal(
    DASHBOARD_REQUEST_PATH_HEADER,
    "x-picchuspot-dashboard-destination",
  );
  assert.match(proxyClientSource, /headers\.delete\(name\)/);
  assert.match(proxyClientSource, /req\.cookies\.set\(name, value\)/);
  assert.match(proxyClientSource, /response = NextResponse\.next/);
  assert.match(
    proxyClientSource,
    /response\.cookies\.set\(name, value, options\)/,
  );
});

test("dashboard layout is the fail-closed verified user gate with dub1 preference", () => {
  const layoutSource = source("app/(dashboard)/layout.tsx");

  assert.match(layoutSource, /export const preferredRegion = "dub1"/);
  assert.match(layoutSource, /getDashboardRequestUser\(\)/);
  assert.match(layoutSource, /if \(!rawUser\)/);
  assert.match(layoutSource, /safeDashboardRequestPath\(/);
  assert.match(
    layoutSource,
    /redirect\(`\/login\?redirectTo=\$\{encodeURIComponent\(destination\)\}`\)/,
  );
  assert.doesNotMatch(layoutSource, /getClaims|getSession|dashboard-client-auth/);

  const allAppSources = sourceFilesUnder("app").map(source).join("\n");
  assert.equal(
    allAppSources.match(/export const preferredRegion = "dub1"/g)?.length,
    1,
  );
});

test("layout and dashboard pages share request-scoped verified identity", () => {
  const contextSource = source("lib/dashboard-request-context.ts");
  assert.match(contextSource, /import "server-only"/);
  assert.match(contextSource, /cache\(getClientUser\)/);
  assert.match(contextSource, /cache\(getClientProfile\)/);
  assert.doesNotMatch(contextSource, /unstable_cache|use cache/);

  const verifiedPagePaths = [
    "app/(dashboard)/dashboard/page.tsx",
    "app/(dashboard)/dashboard/jobs/page.tsx",
    "app/(dashboard)/dashboard/jobs/[orderId]/page.tsx",
    "app/(dashboard)/dashboard/files/page.tsx",
    "app/(dashboard)/dashboard/invoices/page.tsx",
    "app/(dashboard)/dashboard/support/page.tsx",
    "app/(dashboard)/dashboard/profile/page.tsx",
    "lib/order-access.ts",
  ];
  for (const path of verifiedPagePaths) {
    const pageSource = source(path);
    assert.match(pageSource, /getDashboardRequestUser\(\)/, path);
    assert.doesNotMatch(pageSource, /from "@\/lib\/client-auth"/, path);
  }
});

test("getClientUser remains canonical and APIs do not use dashboard context", () => {
  const clientAuthSource = source("lib/client-auth.ts");
  assert.match(clientAuthSource, /export async function getClientUser/);
  assert.match(clientAuthSource, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(clientAuthSource, /getClaims|getSession/);

  const apiSources = sourceFilesUnder("app/api").map(source).join("\n");
  assert.doesNotMatch(
    apiSources,
    /dashboard-request-context|DASHBOARD_REQUEST_PATH_HEADER/,
  );
});

test("all dashboard navigation shells use the no-prefetch portal link", () => {
  const portalLinkSource = source("components/dashboard/ClientPortalLink.tsx");
  assert.match(
    portalLinkSource,
    /<Link \{\.\.\.props\} prefetch=\{false\} \/>/,
  );

  const scopedPaths = [
    ...sourceFilesUnder("components/dashboard"),
    ...sourceFilesUnder("app/(dashboard)"),
    "components/auth/PublicAccountMenu.tsx",
  ];
  const scopedSource = scopedPaths.map(source).join("\n");
  assert.doesNotMatch(scopedSource, /router\.prefetch|prefetch=\{true\}/);

  for (const path of sourceFilesUnder(".")) {
    const rawLinkTags = source(path).match(/<Link\b[\s\S]*?>/g) ?? [];
    for (const tag of rawLinkTags) {
      assert.doesNotMatch(tag, /\/dashboard/, `${path}: ${tag}`);
    }
  }

  for (const shellPath of [
    "components/dashboard/ClientDashboardTopNav.tsx",
    "components/dashboard/ClientDashboardSidebar.tsx",
    "components/dashboard/ClientDashboardMobileNav.tsx",
    "components/auth/PublicAccountMenu.tsx",
  ]) {
    assert.match(source(shellPath), /<ClientPortalLink/, shellPath);
  }
});

test("visible job details and service cards never auto-prefetch", () => {
  const jobsTableSource = source("components/dashboard/JobsTable.tsx");
  const serviceCardSource = source("components/dashboard/OrderServiceCard.tsx");

  assert.match(
    jobsTableSource,
    /<ClientPortalLink[\s\S]*?href=\{`\/dashboard\/jobs\/\$\{job\.id\}`\}/,
  );
  assert.doesNotMatch(jobsTableSource, /<Link/);
  assert.match(
    serviceCardSource,
    /<ClientPortalLink[\s\S]*?href=\{service\.route as string\}/,
  );
  assert.doesNotMatch(serviceCardSource, /<Link\b/);

  for (const path of [
    "components/order/Confirmation.tsx",
    "components/payments/OrderPaymentPanel.tsx",
    "components/order/image-enhancement/ImageEnhancementTypeSelector.tsx",
  ]) {
    const componentSource = source(path);
    assert.match(componentSource, /<ClientPortalLink/, path);
    assert.doesNotMatch(componentSource, /from "next\/link"/, path);
  }
});

test("opening account menus cannot initiate dashboard route requests", () => {
  for (const path of [
    "components/auth/PublicAccountMenu.tsx",
    "components/dashboard/ClientDashboardTopNav.tsx",
  ]) {
    const menuSource = source(path);
    assert.match(menuSource, /accountMenuItems\.map\(\(item\) =>/);
    assert.match(
      menuSource,
      /<ClientPortalLink[\s\S]*?href=\{item\.href\}/,
    );
    assert.doesNotMatch(menuSource, /router\.prefetch|useRouter/);
  }
});

test("New Order streaming improvements remain intact", () => {
  const pageSource = source("app/(dashboard)/dashboard/orders/new/page.tsx");
  const gridSource = source("components/dashboard/OrderServiceGrid.tsx");
  const loadingSource = source(
    "app/(dashboard)/dashboard/orders/new/loading.tsx",
  );

  assert.match(pageSource, /export const dynamic = "force-dynamic"/);
  assert.match(
    pageSource,
    /<Suspense fallback=\{<OrderServiceGrid services=\{services\} \/>\}>/,
  );
  assert.match(pageSource, /async function EnrichedOrderServiceGrid/);
  assert.match(gridSource, /<OrderServiceCard/);
  assert.match(pageSource, /<SavedDraftsSection \/>/);
  assert.match(loadingSource, /Loading New Order catalog/);
});

test("sub_service enrichment applies labels when the bounded lookup succeeds", async () => {
  const orders = [{ id: "order-1", sub_service: null }];
  await enrichOrderSubServices(orders, async (_orderIds, signal) => {
    assert.equal(signal.aborted, false);
    return {
      rows: [
        {
          order_id: "order-1",
          details: { sub_service: "image-enhancement" },
        },
      ],
      errorMessage: null,
    };
  });

  assert.equal(orders[0].sub_service, "image-enhancement");
  assert.equal(SUB_SERVICE_ENRICHMENT_TIMEOUT_MS, 1_250);
});

test("sub_service timeout degrades to safe summaries without rejecting", async () => {
  const orders = [{ id: "order-1", sub_service: null }];
  const warnings: string[] = [];

  await enrichOrderSubServices(
    orders,
    async (_orderIds, signal) =>
      await new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
    { timeoutMs: 5, warn: (message) => warnings.push(message) },
  );

  assert.equal(orders[0].sub_service, null);
  assert.deepEqual(warnings, [
    "[client-orders] sub_service lookup skipped: timed out",
  ]);
});

test("only cosmetic order_items enrichment receives an abort signal", () => {
  const ordersSource = source("lib/client-orders.ts");
  const ownedOrdersStart = ordersSource.indexOf('.from("orders")');
  const enrichmentStart = ordersSource.indexOf("await enrichOrderSubServices");
  const returnStart = ordersSource.indexOf("return orders;", enrichmentStart);

  assert.ok(ownedOrdersStart >= 0 && enrichmentStart > ownedOrdersStart);
  assert.doesNotMatch(
    ordersSource.slice(ownedOrdersStart, enrichmentStart),
    /abortSignal/,
  );
  assert.match(
    ordersSource.slice(enrichmentStart, returnStart),
    /\.from\("order_items"\)[\s\S]*?\.abortSignal\(signal\)/,
  );
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
