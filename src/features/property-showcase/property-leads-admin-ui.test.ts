import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminLeadsPage = readFileSync(
  new URL("../../app/(public)/admin/leads/page.tsx", import.meta.url),
  "utf8",
);
const adminShell = readFileSync(
  new URL("../../components/admin/AdminShell.tsx", import.meta.url),
  "utf8",
);

test("admin leads route uses the existing server-side admin guard", () => {
  assert.equal(adminLeadsPage.includes('export const dynamic = "force-dynamic"'), true);
  assert.equal(adminLeadsPage.includes('export const runtime = "nodejs"'), true);
  assert.equal(adminLeadsPage.includes("isAdminAuthenticated"), true);
  assert.equal(adminLeadsPage.includes('redirect("/admin/login")'), true);
  assert.equal(adminLeadsPage.includes('robots: { index: false, follow: false }'), true);
  assert.equal(adminLeadsPage.includes('"use client"'), false);
  assert.equal(adminLeadsPage.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
});

test("admin navigation exposes the responsive Leads inbox", () => {
  assert.equal(adminShell.includes('label: "Leads"'), true);
  assert.equal(adminShell.includes('href: "/admin/leads"'), true);
  assert.equal(adminShell.includes('description: "Property enquiries"'), true);
  assert.equal(adminShell.includes("adminNav.map"), true);
});
