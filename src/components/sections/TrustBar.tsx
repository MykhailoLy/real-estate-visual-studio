import { Clock, Globe, ImageIcon, DollarSign } from "lucide-react";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice } from "@/lib/currency";

const stats = [
  { icon: ImageIcon, label: "Properties Marketed", value: "200+" },
  { icon: Clock, label: "Delivery", value: "24-48h" },
  { icon: Globe, label: "Clients", value: "Worldwide" },
  {
    icon: DollarSign,
    label: "Starting From",
    value: <RegionalPriceText price={regionalPrice("$1.00", "€1.00")} />,
  },
];

export default function TrustBar() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-tight">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
