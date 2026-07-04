import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PicchuSpotLogo, BrandWordmark } from "@/components/brand";
import { getTurnstileSiteKeyFromEnv } from "@/components/auth/turnstile";
import SignUpForm from "./SignUpForm";

export const metadata: Metadata = {
  title: "Create account | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  const turnstileSiteKey = getTurnstileSiteKeyFromEnv();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      {/* Back to website */}
      <div className="w-full max-w-md mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to website
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
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Manage your PicchuSpot orders, files, and invoices.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-border rounded-2xl shadow-sm p-6 sm:p-8">
          {/* useSearchParams (redirectTo) needs Suspense in the App Router */}
          <Suspense fallback={<SignUpFormSkeleton />}>
            <SignUpForm turnstileSiteKey={turnstileSiteKey} />
          </Suspense>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-[11px] text-muted leading-relaxed">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline hover:text-primary transition-colors">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function SignUpFormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-11 bg-primary/20 rounded-xl" />
    </div>
  );
}
