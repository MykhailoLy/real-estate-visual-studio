import { defineConfig, devices } from "@playwright/test";

const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = configuredBaseURL || DEFAULT_BASE_URL;
const baseHostname = new URL(baseURL).hostname.toLowerCase();

if (baseHostname === "picchuspot.com" || baseHostname === "www.picchuspot.com") {
  throw new Error("Playwright smoke tests must not run against production.");
}

export default defineConfig({
  testDir: "./e2e/smoke",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30000,
  expect: {
    timeout: 7000,
  },
  outputDir: "test-results",
  reporter: process.env.CI
    ? [["dot"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
      },
    },
  ],
  webServer: configuredBaseURL
    ? undefined
    : {
        command:
          "npm run build && node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3100",
        url: DEFAULT_BASE_URL,
        timeout: 180000,
        env: {
          PLAYWRIGHT_PROPERTY_GALLERY_FIXTURES: "1",
          PLAYWRIGHT_STATIC_IMAGE_VIEWER_FIXTURES: "1",
        },
        reuseExistingServer: false,
        stdout: "pipe",
        stderr: "pipe",
      },
});
