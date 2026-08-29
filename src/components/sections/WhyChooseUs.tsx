import Container from "@/components/layout/Container";
import SectionHeader from "./SectionHeader";
import {
  Zap,
  Eye,
  DollarSign,
  MousePointerClick,
  RefreshCw,
  Globe,
} from "lucide-react";

const benefits = [
  {
    icon: Zap,
    title: "Fast Turnaround",
    description: "Most orders delivered within 24-48 hours. Rush delivery available.",
  },
  {
    icon: Eye,
    title: "Photorealistic Quality",
    description: "Results so realistic, buyers can't tell it's virtual.",
  },
  {
    icon: DollarSign,
    title: "Transparent Pricing",
    description: "Per-image pricing with no hidden fees. See exactly what you pay.",
  },
  {
    icon: MousePointerClick,
    title: "Easy Online Ordering",
    description: "Upload photos, choose options, submit. It's that simple.",
  },
  {
    icon: RefreshCw,
    title: "Unlimited Revisions",
    description: "Unlimited revisions for 30 calendar days from first delivery, within the original brief and design direction.",
  },
  {
    icon: Globe,
    title: "Global + Local",
    description: "Remote services worldwide. On-site shoots in Alicante & Costa Blanca.",
  },
];

export default function WhyChooseUs() {
  return (
    <section className="py-16 lg:py-24 bg-surface">
      <Container>
        <SectionHeader
          title="Why Real Estate Professionals Choose Us"
          subtitle="We combine speed, quality, and affordability to help you sell faster."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="bg-white border border-border rounded-xl p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5">
                  {benefit.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
