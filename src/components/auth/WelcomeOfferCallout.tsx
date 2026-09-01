import { Check, Gift } from "lucide-react";

export type WelcomeOfferCalloutCopy = {
  title: string;
  prompt: string;
  benefits: readonly string[];
};

export default function WelcomeOfferCallout({
  copy,
}: {
  copy: WelcomeOfferCalloutCopy;
}) {
  return (
    <section
      aria-labelledby="signup-welcome-offer-title"
      data-testid="signup-welcome-offer"
      className="overflow-hidden rounded-xl border border-primary bg-primary text-left shadow-lg shadow-primary/15"
    >
      <div className="border-b border-white/15 bg-gradient-to-br from-primary-light to-primary px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-secondary/35 bg-secondary/15 text-secondary">
            <Gift className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="signup-welcome-offer-title"
              className="text-[11px] font-bold uppercase tracking-[0.18em] text-white"
            >
              {copy.title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-white/75">
              {copy.prompt}
            </p>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-white/15">
        {copy.benefits.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2 px-4 py-2.5">
            <Check className="h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden />
            <span className="text-[13px] font-medium leading-snug text-white">
              {benefit}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
