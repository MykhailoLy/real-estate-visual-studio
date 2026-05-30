import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set new password | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

// /reset-password is reached after clicking the reset link in email.
// /auth/callback exchanges the recovery code for a session and
// redirects here, so the user is already authenticated when this
// page renders — ResetPasswordForm can call updateUser() immediately.
export default function ResetPasswordPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      {/* Back link */}
      <div className="w-full max-w-md mb-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to sign in
        </Link>
      </div>

      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-5 group"
            aria-label="PicchuSpot home"
          >
            <span className="text-xl font-bold text-primary tracking-tight group-hover:text-primary-light transition-colors">
              PicchuSpot
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-primary/8 border border-primary/15 rounded text-primary text-[9px] font-bold uppercase tracking-[0.18em]">
              Portal
            </span>
          </Link>
          <h1 className="text-2xl sm:text-[26px] font-bold text-primary leading-tight">
            Set a new password
          </h1>
          <p className="mt-1.5 text-sm text-muted max-w-xs mx-auto">
            Choose a strong password for your PicchuSpot account.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-border rounded-2xl shadow-sm p-6 sm:p-8">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
