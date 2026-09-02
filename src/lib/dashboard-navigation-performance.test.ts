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
import { cn } from "./utils.ts";
import {
  filterDashboardJobs,
  getDistinctJobSecondaryLabel,
  getOpenDashboardJobs,
} from "../components/dashboard/job-workspace.ts";
import type {
  DashboardJob,
  DashboardJobStatus,
} from "./client-dashboard/mock-data.ts";

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

function makeDashboardJob(
  id: string,
  status: DashboardJobStatus,
  overrides: Partial<DashboardJob> = {},
): DashboardJob {
  return {
    id,
    title: `Job ${id}`,
    reference: `REF-${id}`,
    serviceType: "Virtual Staging",
    status,
    submittedDate: "2026-08-01",
    estimatedCompletion: "2026-08-03",
    progress: 50,
    costCents: 4900,
    currency: "EUR",
    imageCount: 1,
    ...overrides,
  };
}

test("dashboard font utilities survive cn colors and retain font-size override behavior", () => {
  for (const size of [
    "dashboard-section",
    "dashboard-body",
    "dashboard-action",
    "dashboard-metadata",
    "dashboard-kicker",
    "dashboard-mobile-control",
  ]) {
    const utility = `text-${size}`;
    assert.equal(cn("text-sm", utility, "text-muted"), `${utility} text-muted`);
    assert.equal(cn(utility, "text-muted", "md:text-sm"), `${utility} text-muted md:text-sm`);
    assert.equal(cn(utility, "text-muted", "text-base", "text-primary"), "text-base text-primary");
  }
});

test("proxy matcher and pass-through exclude public auth pages from Supabase work", () => {
  const proxySource = source("proxy.ts");
  const matcherStart = proxySource.indexOf("export const config");
  const matcherSource = proxySource.slice(matcherStart);
  const passThroughStart = proxySource.indexOf("if (!isDashboard) {");
  const clientCreationStart = proxySource.indexOf(
    "createProxySupabaseClient(req",
  );

  assert.ok(matcherStart >= 0);
  assert.match(matcherSource, /matcher: \["\/dashboard\/:path\*"\]/);
  assert.doesNotMatch(matcherSource, /\/login|\/signup/);
  assert.ok(
    passThroughStart >= 0 && clientCreationStart > passThroughStart,
  );
  assert.match(
    proxySource.slice(passThroughStart, clientCreationStart),
    /return NextResponse\.next\(\);/,
  );
  assert.doesNotMatch(
    proxySource,
    /getClaims|hasVerifiedAuthenticatedSubject|isAuthPage/,
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

test("dashboard proxy refreshes cookies without authorizing from getSession", () => {
  const proxySource = source("proxy.ts");
  const dashboardBranchStart = proxySource.indexOf(
    "// Dashboard proxy work is refresh-only.",
  );
  const dashboardBranchEnd = proxySource.indexOf(
    "export const config",
    dashboardBranchStart,
  );
  const dashboardBranch = proxySource.slice(
    dashboardBranchStart,
    dashboardBranchEnd,
  );

  assert.ok(
    dashboardBranchStart >= 0 && dashboardBranchEnd > dashboardBranchStart,
  );
  assert.match(dashboardBranch, /await supabase\.auth\.getSession\(\);/);
  assert.doesNotMatch(
    dashboardBranch,
    /\.auth\.(?:getClaims|getUser)\(|authenticated\s*=/,
  );
  assert.match(dashboardBranch, /return getResponse\(\);/);
  assert.doesNotMatch(proxySource, /\.auth\.(?:getClaims|getUser)\(/);
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
    /safeDashboardRequestPath\(\s*`\$\{pathname\}\$\{req\.nextUrl\.search\}`,?\s*\)/,
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
  assert.match(contextSource, /cache\(async \(\) =>/);
  assert.match(
    contextSource,
    /const verifiedUser = await getClientUser\(\);[\s\S]*?resolveDashboardRequestUser\(verifiedUser\)/,
  );
  assert.match(contextSource, /const verifiedProfile = user \? await getClientProfile\(\) : null/);
  assert.match(contextSource, /user\?\.isQaPreview/);
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

test("getClientUser remains canonical and APIs do not use dashboard QA context", () => {
  const clientAuthSource = source("lib/client-auth.ts");
  assert.match(clientAuthSource, /export async function getClientUser/);
  assert.match(clientAuthSource, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(clientAuthSource, /getClaims|getSession/);

  const apiSources = [
    ...sourceFilesUnder("app/api"),
    ...sourceFilesUnder("app/(public)/api"),
  ].map(source).join("\n");
  assert.doesNotMatch(
    apiSources,
    /dashboard-request-context|client-portal-qa|DASHBOARD_REQUEST_PATH_HEADER/,
  );
});

test("synthetic dashboard renders use fixed safe fixtures and bypass ownership reads", () => {
  for (const path of [
    "app/(dashboard)/dashboard/page.tsx",
    "app/(dashboard)/dashboard/jobs/page.tsx",
    "app/(dashboard)/dashboard/files/page.tsx",
    "app/(dashboard)/dashboard/invoices/page.tsx",
  ]) {
    const pageSource = source(path);
    assert.match(pageSource, /!user\.isQaPreview/, path);
  }

  const jobsPageSource = source("app/(dashboard)/dashboard/jobs/page.tsx");
  assert.match(jobsPageSource, /CLIENT_PORTAL_QA_JOBS/);
  assert.match(
    jobsPageSource,
    /user\?\.isQaPreview[\s\S]*?\? \[\.\.\.CLIENT_PORTAL_QA_JOBS\]/,
  );

  const detailSource = source("app/(dashboard)/dashboard/jobs/[orderId]/page.tsx");
  assert.match(detailSource, /if \(!user \|\| user\.isQaPreview\) notFound\(\);/);

  const dashboardSource = source("app/(dashboard)/dashboard/page.tsx");
  assert.match(
    dashboardSource,
    /user\?\.isQaPreview[\s\S]*?Promise\.resolve\(CLIENT_PORTAL_QA_WELCOME_OFFER_AVAILABILITY\)/,
  );
  assert.match(
    dashboardSource,
    /user\?\.email && !user\.isQaPreview[\s\S]*?getOrdersForClient/,
  );
  assert.match(
    dashboardSource,
    /getWelcomeOfferAvailability\(user\.id\)\.catch\(\(\) => null\)/,
  );
  assert.match(dashboardSource, /CLIENT_PORTAL_QA_COMPLETED_JOBS/);

  for (const path of [
    "app/(dashboard)/dashboard/orders/new/day-to-dusk/page.tsx",
    "app/(dashboard)/dashboard/orders/new/virtual-staging/page.tsx",
    "app/(dashboard)/dashboard/orders/new/image-enhancement/single-exposure/page.tsx",
  ]) {
    const pageSource = source(path);
    assert.match(pageSource, /isQaPreview[\s\S]*?NO_WELCOME_OFFER_AVAILABLE/, path);
  }

  const orderAccessSource = source("lib/order-access.ts");
  assert.doesNotMatch(orderAccessSource, /isQaPreview|client-portal-qa/);
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
    "components/dashboard/ClientDashboardMobileNav.tsx",
    "components/auth/PublicAccountMenu.tsx",
  ]) {
    assert.match(source(shellPath), /<ClientPortalLink/, shellPath);
  }
});

test("dashboard shell uses one desktop nav and one accessible mobile drawer", () => {
  const layoutSource = source("components/dashboard/ClientDashboardLayout.tsx");
  const topNavSource = source("components/dashboard/ClientDashboardTopNav.tsx");
  const mobileNavSource = source("components/dashboard/ClientDashboardMobileNav.tsx");
  const utilityBarSource = source(
    "components/dashboard/ClientDashboardMobileUtilityBar.tsx",
  );
  const jobsSource = source("components/dashboard/ClientJobsShell.tsx");

  assert.doesNotMatch(layoutSource, /ClientDashboardSidebar/);
  assert.doesNotMatch(layoutSource, /ClientDashboardMobileBottomBar/);
  assert.match(layoutSource, /<ClientDashboardMobileUtilityBar \/>/);
  assert.match(
    layoutSource,
    /pb-\[calc\(2\.875rem\+env\(safe-area-inset-bottom\)\)\] lg:pb-0/,
  );
  assert.match(layoutSource, /bg-dashboard-canvas/);
  assert.match(utilityBarSource, /useSupportChat\(\)/);
  assert.match(utilityBarSource, /openSupportChat\(chatTriggerRef\.current\)/);
  assert.match(utilityBarSource, /Open account menu/);
  assert.match(utilityBarSource, /client-dashboard-mobile-account-menu/);
  assert.match(utilityBarSource, /role="menu"/);
  assert.match(utilityBarSource, /My Account/);
  assert.match(utilityBarSource, /Edit account/);
  assert.match(utilityBarSource, /<SignOutButton/);
  assert.match(utilityBarSource, /event\.key === "Escape"/);
  assert.match(utilityBarSource, /Open PicchuSpot support chat/);
  assert.match(utilityBarSource, /bg-surface[\s\S]*?text-primary/);
  assert.match(utilityBarSource, /<MessageCircle className="h-4 w-4 flex-shrink-0 text-primary"/);
  assert.match(utilityBarSource, /env\(safe-area-inset-bottom\)/);
  assert.match(utilityBarSource, /h-\[calc\(2\.875rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(utilityBarSource, /lg:hidden/);
  assert.doesNotMatch(utilityBarSource, /fetch\(|\/api\//);
  assert.match(topNavSource, /hidden border-t border-border bg-primary lg:block/);
  assert.match(topNavSource, /aria-controls="client-dashboard-mobile-menu"/);
  assert.match(topNavSource, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(mobileNavSource, /id="client-dashboard-mobile-menu"/);
  assert.match(mobileNavSource, /event\.key === "Escape"/);
  assert.match(mobileNavSource, /document\.body\.style\.overflow = "hidden"/);
  assert.match(mobileNavSource, /trigger\?\.focus\(\)/);
  assert.match(topNavSource, /aria-controls="client-dashboard-mobile-menu"[\s\S]*?h-11 w-11/);
  assert.match(mobileNavSource, /inline-flex h-11 w-11 items-center justify-center/);
  assert.match(jobsSource, /<ClientJobsStatusFilters/);
  assert.match(jobsSource, /activeStatusFilter=\{statusFilter\}/);
  assert.match(jobsSource, /onStatusFilter=\{setStatusFilter\}/);
  assert.match(jobsSource, /showStatusControl=\{false\}/);
  assert.match(
    source("components/dashboard/ClientJobsStatusFilters.tsx"),
    /JOB_STATUS_FILTERS\.map/,
  );
});

test("Drafts stays available outside the primary desktop and mobile navigation", () => {
  const navItemsSource = source("components/dashboard/dashboard-nav-items.ts");
  const topNavSource = source("components/dashboard/ClientDashboardTopNav.tsx");
  const mobileNavSource = source("components/dashboard/ClientDashboardMobileNav.tsx");
  const draftsRouteSource = source("app/(dashboard)/dashboard/drafts/page.tsx");
  const savedDraftsSource = source("components/dashboard/SavedDraftsSection.tsx");
  const primaryLabels = Array.from(
    navItemsSource.matchAll(/label: "([^"]+)"/g),
    (match) => match[1],
  );

  assert.deepEqual(primaryLabels, [
    "Dashboard",
    "Jobs",
    "New Order",
    "Files",
    "Invoices",
    "Support",
  ]);
  assert.doesNotMatch(navItemsSource, /\/dashboard\/drafts/);
  assert.match(topNavSource, /DASHBOARD_NAV_ITEMS\.map/);
  assert.match(mobileNavSource, /DASHBOARD_NAV_ITEMS\.map/);
  assert.match(draftsRouteSource, /<ClientDraftsPage \/>/);
  assert.match(savedDraftsSource, /href="\/dashboard\/drafts"/);
  assert.match(savedDraftsSource, /\{copy\.viewAll\}/);
});

test("dashboard composes a proportional activity rail and stacked mobile workspace", () => {
  const pageSource = source("app/(dashboard)/dashboard/page.tsx");
  const railSource = source("components/dashboard/DashboardActivityRail.tsx");
  const responsiveServicesSource = source(
    "components/dashboard/DashboardResponsiveServices.tsx",
  );
  const mobileSelectorSource = source(
    "components/dashboard/MobileDashboardServiceSelector.tsx",
  );
  const savedDraftsSource = source("components/dashboard/SavedDraftsSection.tsx");
  const welcomeOfferSource = source(
    "components/dashboard/DashboardWelcomeOffer.tsx",
  );

  assert.match(railSource, /data-dashboard-workspace/);
  assert.match(railSource, /grid grid-cols-1 gap-6/);
  assert.match(
    railSource,
    /lg:grid-cols-\[clamp\(20rem,33vw,36rem\)_minmax\(0,1fr\)\]/,
  );
  assert.match(railSource, /lg:gap-x-6/);
  assert.match(railSource, /xl:gap-x-8/);
  assert.match(railSource, /lg:border-l lg:border-border/);
  assert.doesNotMatch(railSource, /lg:pr-6|xl:pr-8/);
  assert.doesNotMatch(railSource, /grid-cols-\[(?:280|300|320)px/);
  assert.doesNotMatch(railSource, /row-span|row-start|col-start/);
  assert.match(railSource, /contents lg:order-1 lg:block lg:self-start lg:space-y-6/);
  assert.match(pageSource, /<DashboardActivityRail/);
  assert.match(pageSource, /jobs=\{jobs\}/);
  assert.match(pageSource, /welcomeOfferAvailability=\{resolvedWelcomeOfferAvailability\}/);
  assert.match(pageSource, /isQaPreview=\{user\?\.isQaPreview === true\}/);
  assert.match(pageSource, /services=\{/);
  assert.match(pageSource, /<DashboardResponsiveServices/);
  assert.doesNotMatch(pageSource, /<DashboardQuickStart/);
  assert.match(railSource, /<DashboardWelcomeOffer/);
  assert.match(railSource, /variant="rail"/);
  assert.match(railSource, /heading="Awaiting submission"/);
  assert.match(railSource, /panel/);
  assert.match(railSource, /deletable/);
  assert.match(railSource, /listLimit=\{8\}/);
  assert.match(railSource, /Recently completed/);
  assert.match(railSource, /slice\(0, 6\)/);
  assert.match(railSource, /cursor-pointer/);
  assert.match(railSource, /hover:bg-ivory/);
  assert.match(railSource, /group-focus-visible:text-primary/);
  assert.match(railSource, />\s*Open\s*</);
  assert.match(railSource, /How to get started/);
  assert.match(railSource, /Add your property photos or source files\./);
  assert.match(railSource, /Choose the service options and add any references or instructions\./);
  assert.match(railSource, /Check the order details before submitting\./);
  assert.match(railSource, /Track the job in your dashboard and download completed files when ready\./);
  assert.match(railSource, /job\.status === "completed"/);
  assert.match(railSource, /\{job\.title\}/);
  assert.match(railSource, /Submitted\{" "\}/);
  assert.match(
    railSource,
    /href=\{isQaPreview \? "\/dashboard\/jobs" : `\/dashboard\/jobs\/\$\{job\.id\}`\}/,
  );
  assert.match(railSource, /href="\/dashboard\/jobs"/);
  assert.match(railSource, /View all jobs/);
  assert.doesNotMatch(railSource, /jobs\?status=completed/);

  assert.match(railSource, /className="order-2 lg:order-none"/);
  assert.match(railSource, /className="order-3 [^"]*lg:order-none"/);
  assert.match(railSource, /order-4 min-w-0 lg:order-2 lg:border-l/);
  assert.match(railSource, /className="order-5 [^"]*lg:order-none"/);
  assert.ok(
    railSource.indexOf('data-dashboard-section="getting-started"') <
      railSource.indexOf("data-dashboard-services"),
  );
  assert.match(responsiveServicesSource, /<MobileDashboardServiceSelector \/>/);
  assert.doesNotMatch(responsiveServicesSource, /Browse services/);
  assert.match(mobileSelectorSource, /lg:hidden/);
  assert.match(mobileSelectorSource, /data-dashboard-mobile-service-selector/);
  assert.match(mobileSelectorSource, /getOrderServiceCards\(\)\.filter\(isActiveOrderService\)/);
  assert.match(mobileSelectorSource, /href=\{service\.route\}/);
  assert.doesNotMatch(
    mobileSelectorSource,
    /next\/image|<Image|getOrderCardImages|getOrderServiceExamples/,
  );
  assert.match(welcomeOfferSource, /if \(!availability\) return null;/);
  assert.match(
    welcomeOfferSource,
    /if \(visibleBenefits\.length === 0\) return null;/,
  );
  assert.match(welcomeOfferSource, /Gift/);
  assert.match(welcomeOfferSource, /bg-primary/);
  assert.match(welcomeOfferSource, /Your available welcome benefits\./);
  assert.match(welcomeOfferSource, /Use offer/);
  assert.match(
    savedDraftsSource,
    /text-dashboard-section font-bold text-primary lg:text-lg/,
  );
  assert.match(
    railSource,
    /id="recently-completed-heading"\s*className="text-dashboard-section font-bold text-primary lg:text-lg"/,
  );

  assert.match(savedDraftsSource, /data-dashboard-section=\{panel/);
  assert.match(
    savedDraftsSource,
    /panel &&[\s\S]*?"overflow-hidden rounded-xl border border-border bg-white shadow-sm"/,
  );
  assert.equal(
    railSource.match(/rounded-xl border border-border bg-white shadow-sm/g)
      ?.length,
    2,
  );
});

test("dashboard services are registry-driven and portfolio-enriched", () => {
  const pageSource = source("app/(dashboard)/dashboard/page.tsx");
  const responsiveServicesSource = source(
    "components/dashboard/DashboardResponsiveServices.tsx",
  );
  const desktopServicesSource = source(
    "components/dashboard/DashboardDesktopServices.tsx",
  );
  const quickStartSource = source("components/dashboard/DashboardQuickStart.tsx");
  const serviceGridSource = source("components/dashboard/OrderServiceGrid.tsx");
  const serviceCardSource = source("components/dashboard/OrderServiceCard.tsx");
  const globalsSource = source("app/globals.css");
  const mobileSelectorSource = source(
    "components/dashboard/MobileDashboardServiceSelector.tsx",
  );
  const priceLabelSource = source("lib/order-service-price-label.ts");
  const activeServices = getOrderServiceCatalog().filter(
    (service) => service.availability === "active" && service.route !== null,
  );

  assert.ok(activeServices.length >= 6);
  assert.ok(activeServices.slice(0, 6).every((service) => service.route));
  assert.match(pageSource, /getOrderCardImages\(\)/);
  assert.match(pageSource, /getOrderServiceExamples\(\)/);
  assert.match(
    pageSource,
    /<Suspense fallback=\{<DashboardResponsiveServices \/>\}>/,
  );
  assert.match(desktopServicesSource, /getOrderServiceCards\(\)/);
  assert.match(desktopServicesSource, /<DashboardQuickStart/);
  assert.match(quickStartSource, /services\.filter\(isActiveOrderService\)\.slice\(0, 6\)/);
  assert.match(quickStartSource, /<OrderServiceGrid/);
  assert.match(quickStartSource, /images=\{images\}/);
  assert.match(quickStartSource, /examples=\{examples\}/);
  assert.match(quickStartSource, /layout="dashboard"/);
  assert.match(
    quickStartSource,
    /text-dashboard-section font-bold text-primary lg:text-lg/,
  );
  assert.match(quickStartSource, /href="\/dashboard\/orders\/new"/);
  assert.match(
    serviceGridSource,
    /3xl:grid-cols-3 5xl:grid-cols-4/,
  );
  assert.match(
    serviceGridSource,
    /: "xl:grid-cols-3 2xl:grid-cols-4 5xl:grid-cols-5 6xl:grid-cols-6"/,
  );
  assert.match(globalsSource, /--breakpoint-3xl: 85rem/);
  assert.match(globalsSource, /--breakpoint-4xl: 120rem/);
  assert.match(globalsSource, /--breakpoint-5xl: 150rem/);
  assert.match(globalsSource, /--breakpoint-6xl: 200rem/);
  assert.match(serviceCardSource, /getOrderServicePriceLabel\(service, currency\)/);
  assert.match(serviceCardSource, /isDashboard \? "text-secondary-dark" : "text-primary"/);
  assert.match(priceLabelSource, /getCatalogPrice\(service\.priceKey, currency\)/);
  assert.match(serviceCardSource, /const isDashboard = layout === "dashboard"/);
  assert.match(serviceCardSource, /isDashboard && isActive/);
  assert.match(serviceCardSource, /aria-label=\{`Start a \$\{service\.title\} order`\}/);
  assert.match(serviceCardSource, /z-20 inline-flex/);
  assert.match(serviceCardSource, /isActive && !isDashboard/);
  assert.match(serviceCardSource, /loading="lazy"/);
  assert.match(serviceCardSource, /DASHBOARD_COVER_SIZES/);
  assert.match(serviceCardSource, /min-width: 1920px/);
  assert.match(serviceCardSource, /min-width: 3200px/);
  assert.doesNotMatch(
    quickStartSource,
    /from "next\/image"/,
  );
  assert.match(responsiveServicesSource, /window\.matchMedia\(/);
  assert.match(responsiveServicesSource, /\{isDesktop && \(/);
  assert.match(responsiveServicesSource, /import\("\.\/DashboardDesktopServices"\)/);
  assert.match(responsiveServicesSource, /ssr: false/);
  assert.doesNotMatch(responsiveServicesSource, /<DashboardQuickStart/);
  assert.match(mobileSelectorSource, /getOrderServicePriceLabel\(service, currency\)/);
  assert.match(
    mobileSelectorSource,
    /text-dashboard-section font-bold text-primary/,
  );
  assert.match(mobileSelectorSource, /services\.map/);
  assert.match(mobileSelectorSource, /href=\{service\.route\}/);
});

test("compact Saved Drafts reuses the existing list and Resume or Finish flow", () => {
  const savedDraftsSource = source("components/dashboard/SavedDraftsSection.tsx");
  const dashboardRailSource = source("components/dashboard/DashboardActivityRail.tsx");
  const draftsPageSource = source("components/dashboard/ClientDraftsPage.tsx");
  const railBranchStart = savedDraftsSource.indexOf(
    'if (variant === "rail")',
    5_000,
  );
  const railBranch = savedDraftsSource.slice(
    railBranchStart,
    savedDraftsSource.indexOf("\n  return (", railBranchStart),
  );

  assert.match(savedDraftsSource, /variant\?: SavedDraftsVariant/);
  assert.match(savedDraftsSource, /listLimit\?: number/);
  assert.match(savedDraftsSource, /listOrderDrafts\(listLimit, controller\.signal\)/);
  assert.match(savedDraftsSource, /const isQaPreview = user\?\.isQaPreview === true/);
  assert.match(savedDraftsSource, /if \(isQaPreview\) return;/);
  assert.match(savedDraftsSource, /const visibleLoadState: LoadState = isQaPreview \? "success" : loadState/);
  assert.match(savedDraftsSource, /CLIENT_PORTAL_QA_DRAFTS\.slice\(0, listLimit\)/);
  assert.match(savedDraftsSource, /drafts: isQaPreview \? \[\] : drafts/);
  assert.match(savedDraftsSource, /result\.data\.slice\(0, listLimit\)/);
  assert.match(savedDraftsSource, /listLimit,/);
  assert.match(dashboardRailSource, /listLimit=\{8\}/);
  assert.match(savedDraftsSource, /buildSavedDraftResumeUrl/);
  assert.match(savedDraftsSource, /getSavedDraftActionLabel/);
  assert.match(savedDraftsSource, /const resumeUrl = isQaPreview[\s\S]*?\? draft\.route/);
  assert.match(savedDraftsSource, /resume: copy\.resume/);
  assert.match(savedDraftsSource, /finish: copy\.finish/);
  assert.match(savedDraftsSource, /href=\{resumeUrl\}/);
  assert.match(savedDraftsSource, /aria-label=\{`\$\{actionLabel\}: \$\{title\}`\}/);
  assert.match(savedDraftsSource, /useOrderDraftDeletion\(/);
  assert.match(savedDraftsSource, /OrderDraftDeletionDialog/);
  assert.match(savedDraftsSource, /deletable && !isFinishing && !isQaPreview && \(/);
  assert.match(savedDraftsSource, /h-11 w-11/);
  assert.match(savedDraftsSource, /deletion\.beginDelete\(draft, trigger\)/);
  assert.doesNotMatch(railBranch, /DraftThumbnail|FileText|Clock3/);
  assert.match(railBranch, />\s*\{actionLabel\}\s*</);
  assert.match(railBranch, /dashboard-pointer-hover/);
  assert.match(railBranch, /active:bg-ivory/);
  assert.match(railBranch, /cursor-pointer/);
  assert.match(draftsPageSource, /export function useOrderDraftDeletion/);
  assert.match(draftsPageSource, /await deleteOrderDraft\(/);
  assert.match(draftsPageSource, /draft\.version/);
  assert.match(draftsPageSource, /shouldRefreshDraftListAfterDeleteError/);
  assert.match(draftsPageSource, /result\.code === "unauthenticated"/);
  assert.match(draftsPageSource, /isFinishingOrderDraft\(draft\)/);
  assert.match(draftsPageSource, /role="dialog"/);
  assert.match(draftsPageSource, /aria-modal="true"/);
});

test("Jobs workspace keeps a bounded rail before the flexible jobs area", () => {
  const shellSource = source("components/dashboard/ClientJobsShell.tsx");
  const railSource = source("components/dashboard/JobsWorkspaceRail.tsx");
  const savedDraftsSource = source("components/dashboard/SavedDraftsSection.tsx");
  const draftsRouteSource = source("app/(dashboard)/dashboard/drafts/page.tsx");
  const railIndex = shellSource.indexOf("<JobsWorkspaceRail jobs={jobs} />");
  const allJobsIndex = shellSource.indexOf("data-all-jobs-workspace");

  assert.match(shellSource, /data-jobs-workspace/);
  assert.match(shellSource, /grid grid-cols-1 gap-6/);
  assert.match(shellSource, /xl:grid-cols-\[320px_minmax\(0,1fr\)\]/);
  assert.match(shellSource, /2xl:grid-cols-\[340px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(shellSource, /grid-cols-\[33%|grid-cols-4|col-span-1/);
  assert.ok(railIndex >= 0 && allJobsIndex > railIndex);
  assert.match(
    shellSource,
    /<JobsWorkspaceRail jobs=\{jobs\} \/>[\s\S]*?\{hasJobs \? \(/,
  );
  assert.match(
    railSource,
    /<SavedDraftsSection[\s\S]*?variant="rail"[\s\S]*?workspace[\s\S]*?panel[\s\S]*?deletable[\s\S]*?listLimit=\{8\}/,
  );
  assert.doesNotMatch(railSource, /listOrderDrafts|\/api\/order-drafts|fetch\(/);
  assert.match(savedDraftsSource, /listLimit = 3/);
  assert.match(
    savedDraftsSource,
    /workspaceHelper: "Continue a saved order when you are ready\."/,
  );
  assert.match(draftsRouteSource, /<ClientDraftsPage \/>/);
});

test("Jobs rail derives only open orders and reuses detail links and StatusBadge", () => {
  const railSource = source("components/dashboard/JobsWorkspaceRail.tsx");
  const jobs = [
    makeDashboardJob("pending", "awaiting-submission"),
    makeDashboardJob("active", "in-progress"),
    makeDashboardJob("done", "completed"),
    makeDashboardJob("cancelled", "cancelled"),
    makeDashboardJob("revision", "pending-rework"),
    makeDashboardJob("fourth-open", "new-version-ready"),
  ];

  assert.deepEqual(
    getOpenDashboardJobs(jobs).map((job) => job.id),
    ["pending", "active", "revision"],
  );
  assert.match(railSource, /getOpenDashboardJobs\(jobs\)/);
  assert.match(railSource, /<StatusBadge status=\{job\.status\} compact \/>/);
  assert.match(
    railSource,
    /href=\{`\/dashboard\/jobs\/\$\{job\.id\}`\}/,
  );
  assert.match(railSource, /Open jobs/);
  assert.match(railSource, /dashboard-pointer-hover/);
  assert.match(railSource, /active:bg-ivory/);
  assert.match(railSource, /focus:bg-ivory/);
  assert.match(railSource, /cursor-pointer/);
  assert.doesNotMatch(railSource, /Needs attention|pending orders/i);
});

test("Jobs filtering still matches title, reference, and service", () => {
  const jobs = [
    makeDashboardJob("title", "in-progress", {
      title: "Marbella penthouse",
      reference: "VS-1001",
      serviceType: "Virtual Staging",
    }),
    makeDashboardJob("reference", "completed", {
      title: "Seaside apartment",
      reference: "FP-2042",
      serviceType: "Floor Plans",
    }),
    makeDashboardJob("service", "in-progress", {
      title: "Garden villa",
      reference: "PE-3003",
      serviceType: "Image Enhancement",
    }),
  ];

  assert.deepEqual(
    filterDashboardJobs(jobs, "marbella", "all").map((job) => job.id),
    ["title"],
  );
  assert.deepEqual(
    filterDashboardJobs(jobs, "fp-2042", "all").map((job) => job.id),
    ["reference"],
  );
  assert.deepEqual(
    filterDashboardJobs(jobs, "image enhancement", "all").map(
      (job) => job.id,
    ),
    ["service"],
  );
  assert.deepEqual(
    filterDashboardJobs(jobs, "", "completed").map((job) => job.id),
    ["reference"],
  );
});

test("Jobs hides duplicate secondary labels but preserves distinct fallback text", () => {
  const mappedJob = makeDashboardJob("mapped", "in-progress", {
    reference: "VS-0019",
    serviceType: "Virtual Staging",
    secondaryLabel: "Virtual Staging · VS-0019",
  });
  const historicalJob = makeDashboardJob("historical", "completed", {
    reference: "LEGACY-7",
    serviceType: "Photo Editing",
    secondaryLabel: "Imported legacy order",
  });

  assert.equal(getDistinctJobSecondaryLabel(mappedJob), null);
  assert.equal(
    getDistinctJobSecondaryLabel({
      ...mappedJob,
      secondaryLabel: "  virtual staging  ·  vs-0019  ",
    }),
    null,
  );
  assert.equal(
    getDistinctJobSecondaryLabel(historicalJob),
    "Imported legacy order",
  );
  assert.deepEqual(
    filterDashboardJobs([mappedJob, historicalJob], "legacy order", "all").map(
      (job) => job.id,
    ),
    ["historical"],
  );
});

test("Jobs uses one status controller and distinct mobile and desktop results", () => {
  const shellSource = source("components/dashboard/ClientJobsShell.tsx");
  const filtersSource = source(
    "components/dashboard/ClientJobsStatusFilters.tsx",
  );
  const tableSource = source("components/dashboard/JobsTable.tsx");
  const statusSource = source("lib/client-dashboard/mock-data.ts");

  assert.match(shellSource, /<ClientJobsStatusFilters/);
  assert.match(shellSource, /showStatusControl=\{false\}/);
  assert.equal(shellSource.match(/activeStatusFilter=\{statusFilter\}/g)?.length, 1);
  assert.match(filtersSource, /aria-pressed=\{active\}/);
  assert.match(filtersSource, /min-h-11/);
  assert.match(tableSource, /data-mobile-jobs-list/);
  assert.match(tableSource, /lg:hidden/);
  assert.match(tableSource, /data-desktop-jobs-table/);
  assert.equal(tableSource.match(/<JobSecondaryLabel/g)?.length, 1);
  assert.doesNotMatch(tableSource, /\{job\.secondaryLabel && \(/);
  assert.match(tableSource, /hidden[\s\S]*?lg:block/);
  assert.match(
    tableSource,
    /min-w-\[1200px\] w-full table-fixed text-dashboard-action/,
  );
  assert.match(tableSource, /<col className="w-\[18%\]" \/>/);
  assert.match(tableSource, /<col className="w-\[11%\]" \/>/);
  assert.match(tableSource, />\s*Job title\s*</);
  assert.match(tableSource, />\s*Job reference\s*</);
  assert.match(tableSource, />\s*Job submitted\s*</);
  assert.match(tableSource, />\s*Job complete\s*</);
  assert.match(tableSource, />\s*Job type\s*</);
  assert.match(tableSource, /const JOB_COMPLETE_VALUE = "—"/);
  assert.equal(tableSource.match(/\{JOB_COMPLETE_VALUE\}/g)?.length, 2);
  assert.doesNotMatch(tableSource, /job\.estimatedCompletion/);
  assert.match(filtersSource, /text-secondary/);
  assert.doesNotMatch(tableSource, /minWidth:[\s\S]*?720px/);
  assert.match(tableSource, /min-h-11 w-full/);
  assert.match(tableSource, /const jobHref = `\/dashboard\/jobs\/\$\{job\.id\}`/);
  assert.match(tableSource, /href=\{jobHref\}/);
  assert.match(statusSource, /"awaiting-submission": "Awaiting Confirmation"/);
});

test("Jobs interactions support hybrid pointers, row navigation, and vertical alignment", () => {
  const globalStyles = source("app/globals.css");
  const savedDraftsSource = source("components/dashboard/SavedDraftsSection.tsx");
  const railSource = source("components/dashboard/JobsWorkspaceRail.tsx");
  const tableSource = source("components/dashboard/JobsTable.tsx");

  assert.match(
    globalStyles,
    /@media \(any-hover: hover\)[\s\S]*?\.dashboard-pointer-hover:hover/,
  );
  assert.match(globalStyles, /\.dashboard-pointer-hover-title/);
  assert.match(globalStyles, /\.dashboard-pointer-hover-arrow/);

  for (const interactionSource of [savedDraftsSource, railSource, tableSource]) {
    assert.match(interactionSource, /dashboard-pointer-hover/);
    assert.match(interactionSource, /cursor-pointer/);
    assert.match(interactionSource, /active:bg-ivory/);
  }

  assert.match(tableSource, /import \{ useRouter \} from "next\/navigation"/);
  assert.match(tableSource, /onClick=\{handleRowClick\}/);
  assert.match(tableSource, /router\.push\(jobHref\)/);
  assert.match(tableSource, /isInteractiveTarget\(event\.target\)/);
  assert.match(
    tableSource,
    /target\.closest\("a, button, input, select, textarea, \[role='button'\]"\)/,
  );
  assert.match(tableSource, /<ClientPortalLink[\s\S]*?href=\{jobHref\}/);
  assert.ok((tableSource.match(/align-middle/g) ?? []).length >= 17);
  assert.match(
    tableSource,
    /align-middle whitespace-nowrap px-4 py-3\.5 text-right/,
  );
  assert.doesNotMatch(tableSource, /job\.estimatedCompletion/);
});

test("Jobs presentation components add no order queries or media", () => {
  const pageSource = source("app/(dashboard)/dashboard/jobs/page.tsx");
  const clientSources = [
    source("components/dashboard/ClientJobsShell.tsx"),
    source("components/dashboard/JobsWorkspaceRail.tsx"),
    source("components/dashboard/JobsTable.tsx"),
  ].join("\n");

  assert.match(pageSource, /getOrdersForClient\(toOrderOwnership\(user\)\)/);
  assert.match(pageSource, /getReviewsForClient\(toOrderOwnership\(user\)\)/);
  assert.match(pageSource, /return <ClientJobsShell jobs=\{jobs\} \/>/);
  assert.doesNotMatch(
    clientSources,
    /createClient|getOrdersForClient|getReviewsForClient|from\("orders"\)|fetch\(/,
  );
  assert.doesNotMatch(
    clientSources,
    /next\/image|<Image|portfolio|service image|preload/i,
  );
});

test("every primary client portal route keeps the shared width-aware shell", () => {
  for (const path of [
    "app/(dashboard)/dashboard/page.tsx",
    "app/(dashboard)/dashboard/orders/new/page.tsx",
    "app/(dashboard)/dashboard/drafts/page.tsx",
    "app/(dashboard)/dashboard/files/page.tsx",
    "app/(dashboard)/dashboard/invoices/page.tsx",
    "app/(dashboard)/dashboard/support/page.tsx",
  ]) {
    const pageSource = source(path);
    assert.match(pageSource, /ClientDashboardLayout/, path);
  }
  assert.match(
    source("app/(dashboard)/dashboard/jobs/page.tsx"),
    /ClientJobsShell/,
  );
  assert.match(
    source("components/dashboard/ClientJobsShell.tsx"),
    /ClientDashboardLayout/,
  );

  const layoutSource = source("components/dashboard/ClientDashboardLayout.tsx");
  const workspaceSource = source("components/dashboard/client-portal-workspace.ts");
  const topNavSource = source("components/dashboard/ClientDashboardTopNav.tsx");
  const publicContainerSource = source("components/layout/Container.tsx");
  assert.match(workspaceSource, /max-w-\[1800px\]/);
  assert.match(workspaceSource, /5xl:max-w-none/);
  assert.match(workspaceSource, /px-4 sm:px-5 lg:px-6 2xl:px-8 4xl:px-10/);
  assert.doesNotMatch(layoutSource, /max-w-6xl/);
  assert.match(layoutSource, /CLIENT_PORTAL_WORKSPACE_HORIZONTAL_CLASSNAME/);
  assert.match(layoutSource, /CLIENT_PORTAL_WORKSPACE_WIDTH_CLASSNAME/);
  assert.match(
    layoutSource,
    /flush\s*\?\s*CLIENT_PORTAL_WORKSPACE_WIDTH_CLASSNAME\s*:\s*CLIENT_PORTAL_WORKSPACE_HORIZONTAL_CLASSNAME/,
  );
  assert.match(topNavSource, /CLIENT_PORTAL_WORKSPACE_HORIZONTAL_CLASSNAME/);
  assert.match(topNavSource, /user\?\.isQaPreview/);
  assert.match(topNavSource, />\s*QA Preview\s*</);
  assert.match(publicContainerSource, /max-w-\[1500px\]/);
  assert.match(layoutSource, /className="min-h-0 w-full flex-1/);
});

test("visible job details and service cards never auto-prefetch", () => {
  const jobsTableSource = source("components/dashboard/JobsTable.tsx");
  const serviceCardSource = source("components/dashboard/OrderServiceCard.tsx");

  assert.match(
    jobsTableSource,
    /const jobHref = `\/dashboard\/jobs\/\$\{job\.id\}`[\s\S]*?<ClientPortalLink[\s\S]*?href=\{jobHref\}/,
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
  assert.doesNotMatch(pageSource, /SavedDraftsSection/);
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
