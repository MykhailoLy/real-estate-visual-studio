import { expect, test } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

test("home page loads without client or server smoke failures", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  const response = await page.goto("/");

  expectNavigationResponseOk(response, "/");
  await expect(
    page.getByRole("heading", {
      name: "Help Your Listings Stand Out and Sell Faster",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Order Online" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View Services" }).first()).toBeVisible();
  await guard.expectClean();
});

const publicRoutes = [
  {
    route: "/pricing",
    heading: "Pricing",
  },
  {
    route: "/pricing/virtual-staging",
    heading: "Virtual Staging Pricing",
  },
  {
    route: "/pricing/image-enhancement",
    heading: "Image Enhancement Pricing",
  },
  {
    route: "/services",
    heading: "Real Estate Visual Marketing Services",
  },
  {
    route: "/es/pricing",
    heading: "Precios claros, sin suscripciones",
  },
] as const;

for (const { route, heading } of publicRoutes) {
  test(`public route ${route} renders expected content`, async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto(route);

    expectNavigationResponseOk(response, route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await guard.expectNoPageErrorsOrServerErrors();
  });
}
