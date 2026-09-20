import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/components/brand";
import InviteAcceptance from "./InviteAcceptance";

export const metadata: Metadata = {
  title: "Accept invitation | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InvitePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" aria-label="PicchuSpot home"><BrandWordmark theme="light" className="text-xl" /></Link>
          <h1 className="mt-5 text-2xl font-bold text-primary">Accept your invitation</h1>
          <p className="mt-2 text-sm text-muted">Set your password, then complete your PicchuSpot profile.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <InviteAcceptance />
        </div>
      </div>
    </main>
  );
}
