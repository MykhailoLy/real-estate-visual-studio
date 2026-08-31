import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_PORTAL_QA_PROFILE,
  CLIENT_PORTAL_QA_USER,
  CLIENT_PORTAL_QA_WELCOME_OFFER_AVAILABILITY,
  isClientPortalQaEnvironment,
  resolveDashboardRequestProfile,
  resolveDashboardRequestUser,
} from "./client-portal-qa.ts";
import {
  CLIENT_PORTAL_QA_COMPLETED_JOBS,
  CLIENT_PORTAL_QA_DRAFTS,
  CLIENT_PORTAL_QA_JOBS,
  CLIENT_PORTAL_QA_OPEN_JOBS,
} from "./client-portal-qa-fixtures.ts";
import { isProfileComplete } from "./profile-completion.ts";

const REAL_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "client@example.com",
  displayName: "Real Client",
  firstName: "Real",
  avatarUrl: null,
};

test("client portal QA mode is disabled for every production deployment", () => {
  assert.equal(
    isClientPortalQaEnvironment({
      VERCEL_ENV: "production",
      NODE_ENV: "development",
    }),
    false,
  );
  assert.equal(
    resolveDashboardRequestUser(null, { VERCEL_ENV: "production" }),
    null,
  );
});

test("client portal QA mode is available only in preview or local development", () => {
  assert.equal(
    isClientPortalQaEnvironment({ VERCEL_ENV: "preview", NODE_ENV: "production" }),
    true,
  );
  assert.equal(
    isClientPortalQaEnvironment({ NODE_ENV: "development" }),
    true,
  );
  assert.equal(
    isClientPortalQaEnvironment({ VERCEL_ENV: "staging", NODE_ENV: "test" }),
    false,
  );
});

test("an unauthenticated QA render uses the fixed complete preview profile", () => {
  const user = resolveDashboardRequestUser(null, { VERCEL_ENV: "preview" });

  assert.deepEqual(user, CLIENT_PORTAL_QA_USER);
  assert.equal(user?.id, "00000000-0000-4000-8000-000000000001");
  assert.equal(user?.email, "qa-preview@picchuspot.invalid");
  assert.equal(user?.isQaPreview, true);
  assert.equal(
    resolveDashboardRequestProfile(user, null),
    CLIENT_PORTAL_QA_PROFILE,
  );
  assert.equal(isProfileComplete(CLIENT_PORTAL_QA_PROFILE), true);
});

test("QA fixtures are render-only, populated, and avoid real draft or order routes", () => {
  assert.deepEqual(CLIENT_PORTAL_QA_WELCOME_OFFER_AVAILABILITY, {
    imageEnhancementAvailable: true,
    dayToDuskAvailable: true,
    virtualStagingAvailable: true,
  });
  assert.equal(CLIENT_PORTAL_QA_DRAFTS.length, 8);
  assert.equal(CLIENT_PORTAL_QA_COMPLETED_JOBS.length, 6);
  assert.ok(CLIENT_PORTAL_QA_OPEN_JOBS.length >= 3);
  assert.equal(
    CLIENT_PORTAL_QA_JOBS.length,
    CLIENT_PORTAL_QA_OPEN_JOBS.length + CLIENT_PORTAL_QA_COMPLETED_JOBS.length,
  );
  assert.ok(CLIENT_PORTAL_QA_DRAFTS.every((draft) => draft.id.startsWith("qa-draft-")));
  assert.ok(CLIENT_PORTAL_QA_COMPLETED_JOBS.every((job) => job.id.startsWith("qa-completed-")));
  assert.ok(CLIENT_PORTAL_QA_OPEN_JOBS.every((job) => job.id.startsWith("qa-open-")));
  assert.ok(CLIENT_PORTAL_QA_OPEN_JOBS.every((job) => job.status !== "completed"));
  assert.ok(new Set(CLIENT_PORTAL_QA_OPEN_JOBS.map((job) => job.status)).size >= 3);
  assert.ok(
    CLIENT_PORTAL_QA_DRAFTS.every(
      (draft) => draft.route.startsWith("/dashboard/orders/new/"),
    ),
  );
});

test("a real authenticated user always wins over the QA fallback", () => {
  const user = resolveDashboardRequestUser(REAL_USER, {
    VERCEL_ENV: "preview",
    NODE_ENV: "development",
  });
  const realProfile = {
    ...CLIENT_PORTAL_QA_PROFILE,
    id: "22222222-2222-4222-8222-222222222222",
    user_id: REAL_USER.id,
    first_name: "Real",
    last_name: "Client",
    full_name: "Real Client",
    phone: "+1 202-555-0101",
  };

  assert.deepEqual(user, { ...REAL_USER, isQaPreview: false });
  assert.equal(resolveDashboardRequestProfile(user, realProfile), realProfile);
});
