import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Render the actual components with local fixtures and production CSS. No real
// account, order, payment, upload or database mutation is used by these checks.
function pricingMarkup(partnerClient: boolean, count: number, welcome = true) {
  // Playwright transforms JSX into component-test descriptors. A separate Node
  // renderer keeps React's real JSX runtime without changing application files.
  return execFileSync(process.execPath, ["--input-type=module", "-e", `
  import { registerHooks } from "node:module";
  import { readFileSync, existsSync } from "node:fs";
  import { pathToFileURL } from "node:url";
  import ts from "typescript";
  import { createElement } from "react";
  import { renderToStaticMarkup } from "react-dom/server";
  const root = pathToFileURL(process.cwd() + "/");
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const base = specifier.startsWith("@/")
          ? new URL("src/" + specifier.slice(2), root) : new URL(specifier, context.parentURL);
        for (const extension of ["", ".ts", ".tsx"]) {
          const url = new URL(base.href + extension);
          if (/\\.tsx?$/.test(url.pathname) && existsSync(url)) return { url: url.href, shortCircuit: true };
        }
      }
      return nextResolve(specifier === "next/link" ? "next/link.js" : specifier, context);
    },
    load(url, context, nextLoad) {
      if (/\\.tsx?$/.test(url)) return { format: "module", shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: {
          module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
        } }).outputText,
      };
      return nextLoad(url, context);
    },
  });
  const { default: OrderReviewHeader } = await import("./src/components/order/OrderReviewHeader.tsx");
  const { default: OrderSummary } = await import("./src/components/order/OrderSummary.tsx");
  const { PartnerPricingProvider } = await import("./src/components/order/PartnerPricingContext.tsx");
  const { default: AdminPartnerPricingControl } = await import("./src/components/admin/AdminPartnerPricingControl.tsx");
  const { calculateOrderQuote } = await import("./src/lib/pricing/calculate.ts");
  const { partnerClient, count, welcome } = JSON.parse(process.argv[1]);
  const welcomeOfferAvailability = {
    virtualStagingAvailable: true, imageEnhancementAvailable: true, dayToDuskAvailable: true,
  };
  const input = { serviceType: "virtual-staging", currency: "USD",
    items: Array.from({ length: count }, () => ({ selectedAddons: [] })),
  };
  const availability = welcome ? welcomeOfferAvailability : undefined;
  const quote = calculateOrderQuote(input, { partnerClient, welcomeOfferAvailability: availability });
  process.stdout.write(renderToStaticMarkup(createElement("main", { className: "mx-auto max-w-5xl space-y-6 p-4" },
    createElement(PartnerPricingProvider, { partnerClient }, createElement(OrderSummary, {
      serviceName: "Virtual Staging", items: input.items.map((_, index) => ({ label: "Image " + (index + 1) })),
      pricingInput: input, welcomeOfferAvailability: availability, onSubmit: () => {},
      isSubmitting: false, canSubmit: true,
    })),
    createElement(OrderReviewHeader, { jobTitle: "Partner pricing review", serviceName: "Virtual Staging", photoCount: count, quote }),
    createElement(AdminPartnerPricingControl, { orderId: "11111111-1111-4111-8111-111111111111", partnerClient }),
  )));
  `, JSON.stringify({ partnerClient, count, welcome })], { encoding: "utf8", timeout: 15000 });
}

test("Partner summary and review agree without overflow at supported widths", async ({ page, request, baseURL }) => {
  const response = await request.get("/login");
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  const styles = [...html.matchAll(/href="([^"]+\.css(?:\?[^"]*)?)"/g)]
    .map((match) => `<link rel="stylesheet" href="${new URL(match[1].replaceAll("&amp;", "&"), baseURL).href}">`).join("");
  expect(styles).not.toBe("");
  const markup = pricingMarkup(true, 10);
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(`<html><head>${styles}</head><body>${markup}</body></html>`);
    await expect(page.getByText("Partner pricing · 10%", { exact: true })).toHaveCount(2);
    await expect(page.getByText("−$12.15", { exact: true })).toHaveCount(2);
    await expect(page.getByText("$116.85", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("switch", { name: "Partner client" })).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("ordinary, fully Welcome-excluded and Custom Quote orders omit the Partner line", async ({ page }) => {
  for (const [partner, count] of [[false, 10], [true, 1], [true, 50]] as const) {
    await page.setContent(pricingMarkup(partner, count));
    await expect(page.getByText("Partner pricing · 10%", { exact: true })).toHaveCount(0);
    await expect(page.getByText("−$0.00", { exact: true })).toHaveCount(0);
  }
});

test("local admin endpoint rejects anonymous and forged authentication before mutation", async ({ request }) => {
  for (const cookie of ["", "picchu_admin_session=forged"]) {
    const response = await request.post("/api/admin/orders/11111111-1111-4111-8111-111111111111/partner-pricing", {
      headers: { Cookie: cookie }, data: { partnerClient: true },
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized." });
  }
});
