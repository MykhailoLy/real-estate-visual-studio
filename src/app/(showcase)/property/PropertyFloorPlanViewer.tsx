"use client";

import Image from "next/image";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  LocalizedText,
  PropertyFloorPlan,
  PropertyLanguageCode,
} from "@/features/property-showcase/types";

interface PropertyFloorPlanViewerProps {
  plans: PropertyFloorPlan[];
  propertyTitle: string;
  locale: PropertyLanguageCode;
}

function text(value: LocalizedText | undefined, locale: PropertyLanguageCode): string {
  if (!value) return "";
  return value[locale] ?? value.en;
}

export default function PropertyFloorPlanViewer({
  plans,
  propertyTitle,
  locale,
}: PropertyFloorPlanViewerProps) {
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.sortOrder - b.sortOrder),
    [plans],
  );
  const [selectedId, setSelectedId] = useState(sortedPlans[0]?.id ?? "");
  const selectedPlan =
    sortedPlans.find((plan) => plan.id === selectedId) ?? sortedPlans[0];

  if (!selectedPlan) return null;

  const selectedTitle = text(selectedPlan.title, locale);
  const hasMultiplePlans = sortedPlans.length > 1;

  return (
    <div className="min-w-0">
      {hasMultiplePlans ? (
        <div className="mb-5">
          <div className="hidden gap-2 overflow-x-auto pb-1 md:flex">
            {sortedPlans.map((plan) => {
              const active = plan.id === selectedPlan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedId(plan.id)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                    active
                      ? "bg-[#0f2440] text-white"
                      : "border border-[#0f2440]/15 bg-white text-[#0f2440] hover:border-[#0f2440]"
                  }`}
                >
                  {text(plan.title, locale)}
                </button>
              );
            })}
          </div>
          <label className="block text-sm font-semibold text-[#0f2440] md:hidden">
            Floor plan
            <select
              value={selectedPlan.id}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#0f2440]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0f2440] focus:ring-2 focus:ring-[#0f2440]/15"
            >
              {sortedPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {text(plan.title, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-black/8 bg-[#f6f4ef] p-3 shadow-sm sm:p-6">
        <Image
          src={selectedPlan.imageUrl}
          alt={`${selectedTitle} for ${propertyTitle}`}
          fill
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="object-contain p-5 sm:p-8"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p
          data-testid="selected-floor-plan-title"
          className="text-sm font-semibold text-[#0f2440]"
        >
          {selectedTitle}
        </p>
        {selectedPlan.downloadUrl ? (
          <a
            href={selectedPlan.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[#0f2440]/15 px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:border-[#0f2440]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download floor plan
          </a>
        ) : null}
      </div>
    </div>
  );
}
