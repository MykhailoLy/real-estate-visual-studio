import { defineConfig, devices } from "@playwright/test";

// Separate from public smoke: only a synthetic loopback component fixture can
// accept these order/upload requests. No application auth bypass or credentials.
export default defineConfig({
  testDir: "./order-submission-recovery",
  workers: 1,
  timeout: 30000,
  expect: { timeout: 8000 },
  outputDir: "../test-results/order-submission-recovery",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3210",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: {
    command: "node --experimental-strip-types e2e/support/order-submission-browser-fixture.ts",
    cwd: "..",
    url: "http://127.0.0.1:3210/__fixture/health",
    timeout: 90000,
    reuseExistingServer: false,
  },
});
