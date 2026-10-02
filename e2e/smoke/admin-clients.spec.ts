import { expect, test } from "@playwright/test";
import { renderComponentFixture } from "../support/render-component-fixture";

function clientsMarkup(error = false) {
  return renderComponentFixture(`
    const navigation = "export function usePathname(){return '/admin/clients'}; export function useRouter(){return {replace(){},refresh(){}}}; export function redirect(){throw Error('redirect')}";
    const accounts = {
      page: 1, hasNextPage: true, profilesUnavailable: false, pricingUnavailable: false,
      clients: [
        { userId: '11111111-1111-4111-8111-111111111111', name: 'New Registered Client', email: 'new.client.with.a.long.address@example.com', company: 'Independent Property Management Company', joined: '2026-09-09T10:00:00Z', partnerClient: false },
        { userId: '22222222-2222-4222-8222-222222222222', name: null, email: 'partner@example.com', company: null, joined: null, partnerClient: true },
        { userId: '33333333-3333-4333-8333-333333333333', name: 'Unavailable Account', email: 'unavailable@example.com', company: null, joined: null, partnerClient: null },
      ],
    };
    const { error } = JSON.parse(process.argv[1]);
    const accountModule = 'export class AdminClientsError extends Error {};' +
      'export function parseAdminClientsPage(){return 1}; export async function listAdminClients(){' +
      (error ? "throw new Error('internal detail must not be shown')" : 'return ' + JSON.stringify(accounts)) + '}';
    registerHooks({ resolve(specifier, context, nextResolve) {
      if (specifier === 'next/navigation') return { url: 'data:text/javascript,' + encodeURIComponent(navigation), shortCircuit: true };
      if (specifier === '@/lib/admin-clients-server') return { url: 'data:text/javascript,' + encodeURIComponent(accountModule), shortCircuit: true };
      return nextResolve(specifier, context);
    }});
    const { default: Page } = await import('./src/app/(default)/(public)/admin/clients/page.tsx');
    const { default: Shell } = await import('./src/components/admin/AdminShell.tsx');
    const page = await Page({ searchParams: Promise.resolve({}) });
    process.stdout.write(renderToStaticMarkup(createElement(Shell, null, page)));
  `, { error });
}

test("Clients page protects account data and mutations from anonymous/customer/forged sessions", async ({ request }) => {
  for (const cookie of ["", "sb-test-auth-token=ordinary-customer", "picchu_admin_session=9999999999.forged"]) {
    const response = await request.get("/admin/clients", { headers: { Cookie: cookie }, maxRedirects: 0 });
    // A streaming loading boundary can encode the redirect in an HTTP 200 body.
    const body = await response.text();
    if (response.status() === 200) expect(body).toContain("/admin/login");
    else {
      expect([303, 307]).toContain(response.status());
      expect(response.headers().location).toContain("/admin/login");
    }
    expect(body).not.toContain('aria-label="Registered clients"');
    const mutation = await request.post("/api/admin/clients/11111111-1111-4111-8111-111111111111/partner-pricing", {
      headers: { Cookie: cookie }, data: { partnerClient: true },
    });
    expect(mutation.status()).toBe(401);
    expect(mutation.headers()["cache-control"]).toBe("no-store");
  }
});

test("Clients layout is compact, accessible and readable at all requested widths", async ({ page, request, baseURL }, testInfo) => {
  const response = await request.get("/admin/login");
  expect(response.ok()).toBeTruthy();
  const styles = [...(await response.text()).matchAll(/href="([^"]+\.css(?:\?[^"]*)?)"/g)]
    .map((match) => `<link rel="stylesheet" href="${new URL(match[1].replaceAll("&amp;", "&"), baseURL).href}">`).join("");
  expect(styles).not.toBe("");
  const markup = clientsMarkup();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(`<html><head><base href="${baseURL}">${styles}</head><body>${markup}</body></html>`);
    const list = page.getByRole("list", { name: "Registered clients" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("New Registered Client", { exact: true })).toBeVisible();
    await expect(page.getByText("Name not provided", { exact: true })).toBeVisible();
    await expect(list.getByText("Independent Property Management Company")).toBeVisible();
    const switches = list.getByRole("switch", { name: "Partner client", exact: true });
    await expect(switches).toHaveCount(2);
    await expect(switches.first()).not.toBeChecked();
    await expect(switches.nth(1)).toBeChecked();
    await expect(list.getByRole("listitem").nth(2).getByRole("switch")).toHaveCount(0);
    await expect(list.getByRole("status").filter({ hasText: "Partner status unavailable" })).toBeVisible();
    await switches.first().focus();
    await page.keyboard.press("Tab");
    const deleteFirst = list.getByRole("listitem").first().getByRole("button", { name: "Delete account", exact: true });
    await expect(deleteFirst).toBeFocused();
    expect(await deleteFirst.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Tab");
    await expect(switches.nth(1)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(deleteFirst).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(switches.first()).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(switches.nth(1)).toBeFocused();
    expect(await switches.nth(1).evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const columns = await list.getByRole("listitem").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(width < 1024 ? 1 : 4);
    await page.screenshot({ path: testInfo.outputPath(`clients-${width}.png`), fullPage: true });
  }
  await page.setContent(clientsMarkup(true));
  await expect(page.getByRole("alert")).toContainText("Registered clients could not be loaded");
  await expect(page.getByRole("link", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByText("internal detail must not be shown")).toHaveCount(0);
});
