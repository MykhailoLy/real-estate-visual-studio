import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PicchuSpotLogo, BrandWordmark } from "@/components/brand";
import { getTurnstileSiteKeyFromEnv } from "@/components/auth/turnstile";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset password | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  const turnstileSiteKey = getTurnstileSiteKeyFromEnv();

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
            <PicchuSpotLogo
              variant="mark"
              className="h-7 w-auto"
              width={56}
              height={28}
              alt=""
            />
            <BrandWordmark theme="light" className="text-xl group-hover:opacity-80 transition-opacity" />
            <span className="inline-flex items-center px-1.5 py-0.5 bg-primary/8 border border-primary/15 rounded text-primary text-[9px] font-bold uppercase tracking-[0.18em]">
              Portal
            </span>
          </Link>
          <h1 className="text-2xl sm:text-[26px] font-bold text-primary leading-tight">
            Forgot your password?
          </h1>
          <p className="mt-1.5 text-sm text-muted max-w-xs mx-auto">
            Enter your email and we&rsquo;ll send you a link to reset your
            password.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-border rounded-2xl shadow-sm p-6 sm:p-8">
          <ForgotPasswordForm turnstileSiteKey={turnstileSiteKey} />
        </div>
      </div>
    </div>
  );
}
