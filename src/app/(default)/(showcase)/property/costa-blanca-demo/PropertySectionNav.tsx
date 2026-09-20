"use client";

import {
  BookOpenText,
  Clapperboard,
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
import { useEffect, useRef, useState } from "react";
import { PROPERTY_LANGUAGE_LABELS } from "@/features/property-showcase/localization";
import type { PropertyLanguageCode } from "@/features/property-showcase/types";

interface PropertySectionNavProps {
  showVirtualTour: boolean;
  showVideo: boolean;
  showFloorPlans: boolean;
  showInteractivePlan: boolean;
  showContact: boolean;
  showLocation: boolean;
  languages: PropertyLanguageCode[];
  language: PropertyLanguageCode;
  languageLabel: string;
  onLanguageChange: (language: PropertyLanguageCode) => void;
}

interface PropertySection {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
}

type PropertySectionNavCopy = {
  home: string;
  overview: string;
  gallery: string;
  video: string;
  virtualTour: string;
  floorPlans: string;
  interactivePlan: string;
  contact: string;
  location: string;
  more: string;
  moreSections: string;
  navigation: string;
};

const EN_SECTION_NAV_COPY: PropertySectionNavCopy = {
  home: "Home",
  overview: "Overview",
  gallery: "Gallery",
  video: "Video",
  virtualTour: "360 tour",
  floorPlans: "Floor plans",
  interactivePlan: "Interactive plan",
  contact: "Contact",
  location: "Location",
  more: "More",
  moreSections: "More property sections",
  navigation: "Property page sections",
};

const PROPERTY_SECTION_NAV_COPY: Record<
  PropertyLanguageCode,
  PropertySectionNavCopy
> = {
  en: EN_SECTION_NAV_COPY,
  es: {
    home: "Inicio",
    overview: "Resumen",
    gallery: "Galer\u00eda",
    video: "Video",
    virtualTour: "Tour 360",
    floorPlans: "Planos",
    interactivePlan: "Plano interactivo",
    contact: "Contacto",
    location: "Ubicaci\u00f3n",
    more: "M\u00e1s",
    moreSections: "M\u00e1s secciones de la propiedad",
    navigation: "Secciones de la p\u00e1gina de la propiedad",
  },
  de: {
    home: "Startseite",
    overview: "\u00dcbersicht",
    gallery: "Galerie",
    video: "Video",
    virtualTour: "360\u00b0-Tour",
    floorPlans: "Grundrisse",
    interactivePlan: "Interaktiver Plan",
    contact: "Kontakt",
    location: "Lage",
    more: "Mehr",
    moreSections: "Weitere Immobilienabschnitte",
    navigation: "Abschnitte der Immobilienseite",
  },
  fr: EN_SECTION_NAV_COPY,
  nl: EN_SECTION_NAV_COPY,
  pl: EN_SECTION_NAV_COPY,
  uk: EN_SECTION_NAV_COPY,
  ru: EN_SECTION_NAV_COPY,
};

function SectionLink({
  section,
  mobile = false,
  onNavigate,
}: {
  section: PropertySection;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = section.icon;
  return (
    <a
      href={section.href}
      onClick={onNavigate}
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

function MobileSectionNav({
  sections,
  languages,
  language,
  languageLabel,
  copy,
  onLanguageChange,
}: {
  sections: PropertySection[];
  languages: PropertyLanguageCode[];
  language: PropertyLanguageCode;
  languageLabel: string;
  copy: PropertySectionNavCopy;
  onLanguageChange: (language: PropertyLanguageCode) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const directFourth =
    sections.find((section) => section.href === "#video") ??
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
  const showMore = moreSections.length > 0 || languages.length > 1;
  const mobileColumnCount = directSections.length + (showMore ? 1 : 0);

  useEffect(() => {
    if (!moreOpen) return;
    morePanelRef.current
      ?.querySelector<HTMLElement>("a, select")
      ?.focus();
  }, [moreOpen]);

  function closeMoreMenu(restoreFocus = false) {
    setMoreOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => moreButtonRef.current?.focus(), 0);
    }
  }

  return (
    <div
      data-testid="property-mobile-section-nav"
      className="relative min-[600px]:hidden"
      onKeyDown={(event) => {
        if (event.key === "Escape" && moreOpen) {
          event.preventDefault();
          closeMoreMenu(true);
        }
      }}
    >
      <div
        data-testid="property-mobile-section-nav-row"
        className={`grid w-full ${
          mobileColumnCount === 5
            ? "grid-cols-5"
            : mobileColumnCount === 4
              ? "grid-cols-4"
              : "grid-cols-3"
        }`}
      >
        {directSections.map((section) => (
          <SectionLink key={section.href} section={section} mobile />
        ))}
        {showMore ? (
          <button
            ref={moreButtonRef}
            type="button"
            aria-label={copy.moreSections}
            aria-controls="property-section-nav-more"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[9px] font-semibold leading-3 text-slate-600 transition hover:bg-[#f7f4ec] hover:text-[#0f2440] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0f2440]"
          >
            <Ellipsis className="h-5 w-5 text-[#1a365d]" aria-hidden />
            <span>{copy.more}</span>
          </button>
        ) : null}
      </div>

      {moreOpen ? (
        <div
          ref={morePanelRef}
          id="property-section-nav-more"
          role="group"
          aria-label={copy.moreSections}
          data-testid="property-mobile-more-panel"
          className="absolute inset-x-2 top-full z-50 mt-1 grid grid-cols-2 overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_14px_35px_rgba(15,36,64,0.18)]"
        >
          {moreSections.map((section) => (
            <SectionLink
              key={section.href}
              section={section}
              mobile
              onNavigate={() => closeMoreMenu()}
            />
          ))}
          {languages.length > 1 ? (
            <label className="col-span-2 border-t border-black/8 px-3 py-3 text-xs font-bold text-[#0f2440]">
              {languageLabel}
              <select
                value={language}
                onChange={(event) => {
                  onLanguageChange(event.target.value as PropertyLanguageCode);
                  closeMoreMenu();
                }}
                className="mt-1.5 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm"
              >
                {languages.map((item) => (
                  <option key={item} value={item}>
                    {PROPERTY_LANGUAGE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function PropertySectionNav({
  showVideo,
  showVirtualTour,
  showFloorPlans,
  showInteractivePlan,
  showContact,
  showLocation,
  languages,
  language,
  languageLabel,
  onLanguageChange,
}: PropertySectionNavProps) {
  const copy = PROPERTY_SECTION_NAV_COPY[language] ?? EN_SECTION_NAV_COPY;
  const sections: PropertySection[] = [
    { href: "#home", label: copy.home, icon: House, visible: true },
    { href: "#overview", label: copy.overview, icon: BookOpenText, visible: true },
    { href: "#gallery", label: copy.gallery, icon: Images, visible: true },
    {
      href: "#video",
      label: copy.video,
      icon: Clapperboard,
      visible: showVideo,
    },
    {
      href: "#virtual-tour",
      label: copy.virtualTour,
      icon: ScanLine,
      visible: showVirtualTour,
    },
    {
      href: "#floor-plan",
      label: copy.floorPlans,
      icon: PanelsTopLeft,
      visible: showFloorPlans,
    },
    {
      href: "#interactive-floor-plan",
      label: copy.interactivePlan,
      icon: MousePointer2,
      visible: showInteractivePlan,
    },
    { href: "#contact", label: copy.contact, icon: Mail, visible: showContact },
    {
      href: "#location",
      label: copy.location,
      icon: MapPinned,
      visible: showLocation,
    },
  ].filter((section) => section.visible);

  return (
    <nav
      aria-label={copy.navigation}
      className="sticky top-0 z-40 border-b border-black/8 bg-white/94 shadow-[0_10px_35px_rgba(15,36,64,0.06)] backdrop-blur"
    >
      <MobileSectionNav
        sections={sections}
        languages={languages}
        language={language}
        languageLabel={languageLabel}
        copy={copy}
        onLanguageChange={onLanguageChange}
      />
      <div className="mx-auto hidden max-w-[1480px] min-[600px]:flex min-[600px]:items-stretch sm:px-6 lg:px-10">
        <div
          data-testid="property-desktop-section-nav"
          className="grid min-w-0 flex-1 items-stretch"
          style={{
            gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`,
          }}
        >
          {sections.map((section) => (
            <SectionLink key={section.href} section={section} />
          ))}
        </div>
        {languages.length > 1 ? (
          <label className="flex shrink-0 items-center gap-2 border-l border-black/8 pl-3 text-xs font-bold text-[#0f2440]">
            <span className="sr-only">{languageLabel}</span>
            <select
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value as PropertyLanguageCode)
              }
              aria-label={languageLabel}
              className="rounded-md border border-black/15 bg-white px-2 py-2 text-xs"
            >
              {languages.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </nav>
  );
}
