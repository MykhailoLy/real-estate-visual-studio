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
//
// Six cards laid out in a 1 / 2 / 3 column grid that feels
// substantial rather than dense. Larger icon tiles, bigger
// titles, more padding. Original PicchuSpot copy only — exact
// strings supplied by the spec.
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
    <section className="py-16 lg:py-24 bg-surface border-y border-border">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="max-w-3xl mb-12 lg:mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            Why work with PicchuSpot
          </p>
          <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05]">
            Built for listings — not generic photo work.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="group relative bg-white border border-stone-200 rounded-2xl p-7 lg:p-8 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                {/* Top accent stripe — appears on hover */}
                <span
                  aria-hidden
                  className="absolute top-0 left-7 right-7 h-0.5 rounded-b-full bg-secondary scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-300"
                />
                <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 lg:mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                  <Icon
                    className="w-7 h-7 lg:w-8 lg:h-8 text-primary group-hover:text-white transition-colors"
                    aria-hidden
                  />
                </div>
                <h3 className="font-bold text-foreground text-lg lg:text-xl tracking-tight">
                  {b.title}
                </h3>
                <p className="mt-2.5 text-sm lg:text-base text-muted leading-relaxed">
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
