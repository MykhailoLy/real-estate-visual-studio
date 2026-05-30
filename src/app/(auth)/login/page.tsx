import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
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
            <span className="text-xl font-bold text-primary tracking-tight group-hover:text-primary-light transition-colors">
              PicchuSpot
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-primary/8 border border-primary/15 rounded text-primary text-[9px] font-bold uppercase tracking-[0.18em]">
              Portal
            </span>
          </Link>
          <h1 className="text-2xl sm:text-[26px] font-bold text-primary leading-tight">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Sign in to manage your orders and files.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-border rounded-2xl shadow-sm p-6 sm:p-8">
          {/* useSearchParams needs Suspense in Next.js App Router */}
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-[11px] text-muted leading-relaxed">
          This portal is for PicchuSpot clients only.{" "}
          <Link href="/contact" className="underline hover:text-primary transition-colors">
            Contact us
          </Link>{" "}
          if you need help accessing your account.
        </p>
      </div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-11 bg-primary/20 rounded-xl" />
    </div>
  );
}
