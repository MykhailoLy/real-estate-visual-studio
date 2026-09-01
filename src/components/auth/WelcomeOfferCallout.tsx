import { Check, Gift } from "lucide-react";

export type WelcomeOfferCalloutCopy = {
  title: string;
  prompt: string;
  benefits: readonly string[];
  perAccount: string;
};

export default function WelcomeOfferCallout({
  copy,
}: {
  copy: WelcomeOfferCalloutCopy;
}) {
  return (
    <section
      aria-labelledby="signup-welcome-offer-title"
      className="rounded-xl border border-border bg-ivory p-4 text-left"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-secondary/40 bg-white text-secondary">
          <Gift className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2
            id="signup-welcome-offer-title"
            className="text-sm font-bold text-primary"
          >
            {copy.title}
          </h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
            {copy.prompt}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 text-[13px] font-medium leading-snug text-foreground">
        {copy.benefits.map((benefit) => (
          <li key={benefit} className="flex gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border pt-2.5 text-[11px] leading-relaxed text-muted">
        {copy.perAccount}
      </p>
    </section>
  );
}
