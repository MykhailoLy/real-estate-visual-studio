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
import {
  filterDashboardJobs,
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
  const jobsSource = source("components/dashboard/ClientJobsShell.tsx");

  assert.doesNotMatch(layoutSource, /ClientDashboardSidebar/);
  assert.doesNotMatch(layoutSource, /ClientDashboardMobileBottomBar/);
  assert.doesNotMatch(layoutSource, /pb-\[calc\(3\.5rem/);
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

test("dashboard composes a bounded activity rail and stacked mobile workspace", () => {
  const pageSource = source("app/(dashboard)/dashboard/page.tsx");
  const railSource = source("components/dashboard/DashboardActivityRail.tsx");

  assert.match(pageSource, /data-dashboard-workspace/);
  assert.match(pageSource, /grid grid-cols-1 gap-6/);
  assert.match(pageSource, /lg:grid-cols-\[320px_minmax\(0,1fr\)\]/);
  assert.match(pageSource, /xl:grid-cols-\[340px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(pageSource, /grid-cols-\[33%/);
  assert.match(pageSource, /<DashboardActivityRail jobs=\{jobs\} \/>/);
  assert.match(pageSource, /<DashboardQuickStart/);
  assert.match(railSource, /<SavedDraftsSection variant="rail" \/>/);
  assert.match(railSource, /Continue working/);
  assert.match(railSource, /Next actions/);
  assert.match(railSource, /Recently completed/);
  assert.match(railSource, /href=\{`\/dashboard\/jobs\/\$\{job\.id\}`\}/);
  assert.match(railSource, /href="\/dashboard\/jobs"/);
});

test("dashboard quick start is registry-driven and media-free", () => {
  const pageSource = source("app/(dashboard)/dashboard/page.tsx");
  const quickStartSource = source("components/dashboard/DashboardQuickStart.tsx");
  const activeServices = getOrderServiceCatalog().filter(
    (service) => service.availability === "active" && service.route !== null,
  );

  assert.ok(activeServices.length >= 6);
  assert.ok(activeServices.slice(0, 6).every((service) => service.route));
  assert.match(pageSource, /getOrderServiceCards\(\)/);
  assert.match(quickStartSource, /services\.filter\(isActiveOrderService\)\.slice\(0, 6\)/);
  assert.match(quickStartSource, /href=\{service\.route\}/);
  assert.match(quickStartSource, /href="\/dashboard\/orders\/new"/);
  assert.doesNotMatch(
    `${pageSource}\n${quickStartSource}`,
    /OrderServiceGrid|<OrderServiceCard|from "next\/image"|getOrderCardImages|getOrderServiceExamples/,
  );
  assert.doesNotMatch(quickStartSource, /price|turnaround/i);
});

test("compact Saved Drafts reuses the existing list and Resume or Finish flow", () => {
  const savedDraftsSource = source("components/dashboard/SavedDraftsSection.tsx");
  const listCalls = savedDraftsSource.match(/listOrderDrafts\(3, controller\.signal\)/g);

  assert.equal(listCalls?.length, 1);
  assert.match(savedDraftsSource, /variant\?: SavedDraftsVariant/);
  assert.match(savedDraftsSource, /buildSavedDraftResumeUrl/);
  assert.match(savedDraftsSource, /getSavedDraftActionLabel/);
  assert.match(savedDraftsSource, /resume: copy\.resume/);
  assert.match(savedDraftsSource, /finish: copy\.finish/);
  assert.match(savedDraftsSource, /href=\{resumeUrl\}/);
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
  assert.match(shellSource, /lg:grid-cols-\[320px_minmax\(0,1fr\)\]/);
  assert.match(shellSource, /xl:grid-cols-\[340px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(shellSource, /grid-cols-\[33%|grid-cols-4|col-span-1/);
  assert.ok(railIndex >= 0 && allJobsIndex > railIndex);
  assert.match(
    shellSource,
    /<JobsWorkspaceRail jobs=\{jobs\} \/>[\s\S]*?\{hasJobs \? \(/,
  );
  assert.match(railSource, /<SavedDraftsSection variant="rail" \/>/);
  assert.doesNotMatch(railSource, /listOrderDrafts|\/api\/order-drafts|fetch\(/);
  assert.equal(
    savedDraftsSource.match(/listOrderDrafts\(3, controller\.signal\)/g)
      ?.length,
    1,
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
  assert.match(tableSource, /md:hidden/);
  assert.match(tableSource, /data-desktop-jobs-table/);
  assert.match(tableSource, /hidden[\s\S]*?md:block/);
  assert.match(tableSource, /<table className="w-full table-fixed text-sm">/);
  assert.doesNotMatch(tableSource, /minWidth:[\s\S]*?720px/);
  assert.match(tableSource, /min-h-11 w-full/);
  assert.match(tableSource, /href=\{`\/dashboard\/jobs\/\$\{job\.id\}`\}/);
  assert.match(statusSource, /"awaiting-submission": "Awaiting Confirmation"/);
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
  assert.match(layoutSource, /max-w-6xl mx-auto px-4 sm:px-6 lg:px-8/);
  assert.match(layoutSource, /className="min-h-0 w-full flex-1/);
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
