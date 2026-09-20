import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import LoginForm from "./LoginForm";

// ============================================================
// /admin/login
//
// Server component. If the visitor already has a valid admin
// session cookie, redirect straight to the admin workspace.
// Otherwise render the password form (client component).
//
// `force-dynamic` so the cookie check actually runs per request
// and we never accidentally serve a cached "logged-out" version
// of this page to a logged-in user.
// ============================================================

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Admin Login",
  // Search engines have no business indexing the admin pages —
  // they're functional, not marketing surface.
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  const configured = isAdminConfigured();

  return (
    <section className="bg-surface min-h-[calc(100vh-4rem)] flex items-center justify-center py-16 lg:py-24 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
            PicchuSpot Admin
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight">
            Sign in
          </h1>
          <p className="mt-2 text-sm lg:text-base text-muted">
            Enter the admin password to manage portfolio media.
          </p>
        </div>

        <div className="bg-white border border-border rounded-2xl shadow-sm p-6 lg:p-8">
          {configured ? (
            <LoginForm />
          ) : (
            <div className="text-sm text-foreground space-y-3">
              <p className="font-semibold text-primary">
                Admin login is not configured.
              </p>
              <p className="text-muted leading-relaxed">
                Set the{" "}
                <code className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-[12px] text-foreground">
                  ADMIN_PASSWORD
                </code>{" "}
                environment variable on the deployment, then redeploy
                and reload this page.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
