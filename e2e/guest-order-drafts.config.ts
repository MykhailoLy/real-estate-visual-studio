import { defineConfig } from "@playwright/test";
import authFixture from "./partner-invites.config";

const [authServer, appServer] = Array.isArray(authFixture.webServer) ? authFixture.webServer : [];
if (!authServer || !appServer) throw new Error("Loopback auth fixture is required");

export default defineConfig({
  ...authFixture,
  testDir: "./guest-order-drafts",
  outputDir: "../test-results/guest-order-drafts",
  webServer: [
    authServer,
    { ...appServer, env: { ...appServer.env, GUEST_ORDER_DRAFTS_ENABLED: "true" } },
  ],
});
