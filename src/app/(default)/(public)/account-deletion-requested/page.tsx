import Link from "next/link";

export const metadata = { title: "Account deletion requested | PicchuSpot", robots: { index: false, follow: false } };

export default function AccountDeletionRequestedPage() {
  return <main className="mx-auto max-w-2xl px-5 py-20">
    <h1 className="text-3xl font-bold text-primary">Account deletion requested</h1>
    <p className="mt-5 leading-relaxed text-muted">Your account access is blocked. Final cleanup runs after outstanding upload links expire, which takes at least two hours. Submitted orders, payments and commercial records are retained.</p>
    <Link href="/" className="mt-8 inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2">Back to PicchuSpot</Link>
  </main>;
}
