import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_PORTAL_QA_PROFILE,
  CLIENT_PORTAL_QA_USER,
  isClientPortalQaEnvironment,
  resolveDashboardRequestProfile,
  resolveDashboardRequestUser,
} from "./client-portal-qa.ts";
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
