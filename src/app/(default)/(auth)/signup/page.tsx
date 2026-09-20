import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTurnstileSiteKeyFromEnv } from "@/components/auth/turnstile";
import WelcomeOfferCallout from "@/components/auth/WelcomeOfferCallout";
import SignupPageShell from "@/components/auth/SignupPageShell";
import { WELCOME_OFFER_PUBLIC_COPY } from "@/lib/welcome-offer";
import SignUpForm from "./SignUpForm";

export const metadata: Metadata = {
  title: "Create account | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  const turnstileSiteKey = getTurnstileSiteKeyFromEnv();

  return (
    <SignupPageShell>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold leading-tight text-primary sm:text-[26px]">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Manage your PicchuSpot orders, files, and invoices.
        </p>
      </div>

      <WelcomeOfferCallout
        copy={{
          title: WELCOME_OFFER_PUBLIC_COPY.en.title,
          prompt: WELCOME_OFFER_PUBLIC_COPY.en.signupPrompt,
          benefits: WELCOME_OFFER_PUBLIC_COPY.en.benefits,
        }}
      />

      <div className="mt-5 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        {/* useSearchParams (redirectTo) needs Suspense in the App Router */}
        <Suspense fallback={<SignUpFormSkeleton />}>
          <SignUpForm turnstileSiteKey={turnstileSiteKey} />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline transition-colors hover:text-primary">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline transition-colors hover:text-primary">
          Privacy Policy
        </Link>
        .
      </p>
    </SignupPageShell>
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
