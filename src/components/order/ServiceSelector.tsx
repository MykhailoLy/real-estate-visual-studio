"use client";

import { cn } from "@/lib/utils";
import { ImagePlus, Paintbrush, LayoutGrid, SlidersHorizontal } from "lucide-react";
import type { RemoteServiceType } from "@/types";

interface ServiceSelectorProps {
  selected: RemoteServiceType | null;
  onSelect: (service: RemoteServiceType) => void;
}

const services: {
  id: RemoteServiceType;
  name: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "virtual-staging",
    name: "Virtual Staging",
    icon: <ImagePlus className="w-6 h-6" />,
    description: "Furnish empty rooms with realistic furniture & decor",
  },
  {
    id: "virtual-renovation",
    name: "Virtual Renovation",
    icon: <Paintbrush className="w-6 h-6" />,
    description: "Digitally renovate outdated kitchens, bathrooms & more",
  },
  {
    id: "floor-plans",
    name: "3D Floor Plans",
    icon: <LayoutGrid className="w-6 h-6" />,
    description: "Professional 2D or 3D floor plans from your sketches",
  },
  {
    id: "photo-editing",
    name: "Photo Editing",
    icon: <SlidersHorizontal className="w-6 h-6" />,
    description: "HDR, sky replacement, color correction & more",
  },
];

export default function ServiceSelector({ selected, onSelect }: ServiceSelectorProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Step 1: Select Service
      </h2>
      <p className="text-sm text-muted mb-4">
        Choose the type of service you need.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {services.map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => onSelect(service.id)}
            className={cn(
              "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200",
              "hover:border-primary/50 hover:shadow-sm",
              selected === service.id
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-white"
            )}
          >
            <div
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                selected === service.id
                  ? "bg-primary text-white"
                  : "bg-surface text-muted"
              )}
            >
              {service.icon}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground text-sm">
                {service.name}
              </p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                {service.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
