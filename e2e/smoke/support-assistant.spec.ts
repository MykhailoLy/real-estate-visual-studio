import { expect, test } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

test("PicchuSpot assistant opens and closes without external handoff", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  const response = await page.goto("/");
  expectNavigationResponseOk(response, "/");

  await page.getByRole("button", { name: "Open PicchuSpot AI assistant" }).click();
  const assistant = page.getByRole("dialog", {
    name: "PicchuSpot Assistant",
  });
  await expect(assistant).toBeVisible();

  await page.getByRole("button", { name: "Close PicchuSpot assistant" }).click();
  await expect(assistant).toBeHidden();
  await guard.expectNoCrispRequests();
  await guard.expectClean();
});

test("guided service chooser recommends a local order route without mutations", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  const response = await page.goto("/");
  expectNavigationResponseOk(response, "/");

  await page.getByRole("button", { name: "Open PicchuSpot AI assistant" }).click();
  await expect(
    page.getByRole("dialog", { name: "PicchuSpot Assistant" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Help me choose a service" }).click();
  await page.getByRole("button", { name: "Add furniture to empty rooms" }).click();

  await expect(page.getByText("Recommended service")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start this order" })).toBeVisible();

  await page.getByRole("button", { name: "Start this order" }).click();
  await expect(page).toHaveURL(
    /\/login\?redirectTo=%2Fdashboard%2Forders%2Fnew%2Fvirtual-staging$/,
  );
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await guard.expectNoCrispRequests();
  await guard.expectNoForbiddenApiCalls();
});
