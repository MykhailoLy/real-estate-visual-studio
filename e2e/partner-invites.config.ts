import { defineConfig, devices } from "@playwright/test";

// Dedicated local Auth fixture so these tests exercise the actual SDK and app
// without requiring production/staging credentials or sending invitations.
export default defineConfig({
  testDir: "./partner-invites",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  outputDir: "../test-results/partner-invites",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3200", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: [
    { command: "node --experimental-strip-types e2e/support/partner-invite-auth-fixture.ts", cwd: "..", url: "http://127.0.0.1:3200/__fixture/health" },
    {
      command: "npm run build && node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3202",
      cwd: "..", url: "http://127.0.0.1:3202/admin/login", timeout: 240000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3200/__supabase",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "isolated-fixture-anon",
        SUPABASE_SERVICE_ROLE_KEY: "isolated-fixture-service-role",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3200",
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-INVITEFIXTURE",
        CRON_SECRET: "isolated-deletion-worker-secret",
        ADMIN_PASSWORD: "isolated-partner-invite-test-password",
      },
    },
  ],
});
