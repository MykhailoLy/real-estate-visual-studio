import {
  Clock,
  CreditCard,
  RefreshCw,
  Eye,
  ShieldCheck,
  Globe,
} from "lucide-react";

// ============================================================
// BENEFITS ROW
// Six concise benefit cards. Original PicchuSpot copy only.
// ============================================================

const BENEFITS = [
  {
    icon: Clock,
    title: "Fast Turnaround",
    body: "Standard delivery in 24-48 hours from the moment we have everything we need.",
  },
  {
    icon: CreditCard,
    title: "No Subscriptions",
    body: "Pay per image or per project. No monthly fees, no minimum commitments.",
  },
  {
    icon: RefreshCw,
    title: "Revisions Included",
    body: "One revision is included on every item so the final result matches your brief.",
  },
  {
    icon: Eye,
    title: "Real Human Review",
    body: "Every order is checked by an editor for realism and listing-quality presentation.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Uploads",
    body: "Files go straight to private storage over signed URLs. Your photos stay yours.",
  },
  {
    icon: Globe,
    title: "Remote + Local",
    body: "Worldwide remote editing plus on-location photography in Alicante and Costa Blanca.",
  },
];

export default function BenefitsRow() {
  return (
    <section className="py-14 lg:py-20 bg-surface border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-8">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary" aria-hidden />
                </div>
                <p className="font-semibold text-foreground text-sm">
                  {b.title}
                </p>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  {b.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
