"use client";

import {
  BookOpenText,
  Ellipsis,
  House,
  Images,
  Mail,
  MapPinned,
  MousePointer2,
  PanelsTopLeft,
  ScanLine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

interface PropertySectionNavProps {
  showVirtualTour: boolean;
  showFloorPlans: boolean;
  showInteractivePlan: boolean;
  showContact: boolean;
  showLocation: boolean;
}

interface PropertySection {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
}

function SectionLink({
  section,
  mobile = false,
  menuItem = false,
  onNavigate,
}: {
  section: PropertySection;
  mobile?: boolean;
  menuItem?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = section.icon;
  return (
    <a
      href={section.href}
      onClick={onNavigate}
      role={menuItem ? "menuitem" : undefined}
      className={
        mobile
          ? "flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[9px] font-semibold leading-3 text-slate-600 transition hover:bg-[#f7f4ec] hover:text-[#0f2440] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0f2440]"
          : "group flex min-w-0 flex-col items-center justify-center gap-1.5 border-b-2 border-transparent px-2 py-3 text-[10px] font-semibold text-slate-500 transition hover:border-[#c7a94e] hover:bg-[#f7f4ec] hover:text-[#0f2440] min-[1024px]:flex-row min-[1024px]:gap-2 min-[1024px]:px-3 min-[1024px]:text-xs"
      }
    >
      <Icon
        className={
          mobile
            ? "h-5 w-5 text-[#1a365d]"
            : "h-5 w-5 shrink-0 text-[#1a365d] transition group-hover:text-[#a88b3a]"
        }
        aria-hidden
      />
      <span className={mobile ? "max-w-full text-center" : "max-w-full truncate"}>
        {section.label}
      </span>
    </a>
  );
}

function MobileSectionNav({ sections }: { sections: PropertySection[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const directFourth =
    sections.find((section) => section.href === "#virtual-tour") ??
    sections.find((section) => section.href === "#floor-plan") ??
    sections.find((section) => section.href === "#contact") ??
    sections.find((section) => section.href === "#interactive-floor-plan");
  const directSections = [
    sections.find((section) => section.href === "#home"),
    sections.find((section) => section.href === "#overview"),
    sections.find((section) => section.href === "#gallery"),
    directFourth,
  ].filter((section): section is PropertySection => Boolean(section));
  const directHrefs = new Set(directSections.map((section) => section.href));
  const moreSections = sections.filter(
    (section) => !directHrefs.has(section.href),
  );

  return (
    <div
      data-testid="property-mobile-section-nav"
      className="relative min-[600px]:hidden"
      onKeyDown={(event) => {
        if (event.key === "Escape") setMoreOpen(false);
      }}
    >
      <div
        data-testid="property-mobile-section-nav-row"
        className={`grid w-full ${
          moreSections.length > 0 ? "grid-cols-5" : "grid-cols-4"
        }`}
      >
        {directSections.map((section) => (
          <SectionLink key={section.href} section={section} mobile />
        ))}
        {moreSections.length > 0 ? (
          <button
            type="button"
            aria-label="More sections"
            aria-haspopup="menu"
            aria-controls="property-section-nav-more"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[9px] font-semibold leading-3 text-slate-600 transition hover:bg-[#f7f4ec] hover:text-[#0f2440] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0f2440]"
          >
            <Ellipsis className="h-5 w-5 text-[#1a365d]" aria-hidden />
            <span>More</span>
          </button>
        ) : null}
      </div>

      {moreOpen ? (
        <div
          id="property-section-nav-more"
          role="menu"
          aria-label="More property sections"
          className="absolute inset-x-2 top-full z-50 mt-1 grid grid-cols-2 overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_14px_35px_rgba(15,36,64,0.18)]"
        >
          {moreSections.map((section) => (
            <SectionLink
              key={section.href}
              section={section}
              mobile
              menuItem
              onNavigate={() => setMoreOpen(false)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PropertySectionNav({
  showVirtualTour,
  showFloorPlans,
  showInteractivePlan,
  showContact,
  showLocation,
}: PropertySectionNavProps) {
  const sections: PropertySection[] = [
    { href: "#home", label: "Home", icon: House, visible: true },
    { href: "#overview", label: "Overview", icon: BookOpenText, visible: true },
    { href: "#gallery", label: "Gallery", icon: Images, visible: true },
    {
      href: "#virtual-tour",
      label: "360 tour",
      icon: ScanLine,
      visible: showVirtualTour,
    },
    {
      href: "#floor-plan",
      label: "Floor plans",
      icon: PanelsTopLeft,
      visible: showFloorPlans,
    },
    {
      href: "#interactive-floor-plan",
      label: "Interactive plan",
      icon: MousePointer2,
      visible: showInteractivePlan,
    },
    { href: "#contact", label: "Contact", icon: Mail, visible: showContact },
    {
      href: "#location",
      label: "Location",
      icon: MapPinned,
      visible: showLocation,
    },
  ].filter((section) => section.visible);

  return (
    <nav
      aria-label="Property page sections"
      className="sticky top-16 z-30 border-b border-black/8 bg-white/94 shadow-[0_10px_35px_rgba(15,36,64,0.06)] backdrop-blur"
    >
      <MobileSectionNav sections={sections} />
      <div className="mx-auto hidden max-w-[1480px] min-[600px]:block sm:px-6 lg:px-10">
        <div
          data-testid="property-desktop-section-nav"
          className="grid items-stretch"
          style={{
            gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`,
          }}
        >
          {sections.map((section) => (
            <SectionLink key={section.href} section={section} />
          ))}
        </div>
      </div>
    </nav>
  );
}
