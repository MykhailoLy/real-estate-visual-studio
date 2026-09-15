"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ChevronDown,
  FileText,
  Globe2,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Mail,
  Menu,
  Newspaper,
  ShieldCheck,
  Tags,
  X,
} from "lucide-react";
import { usePublicAuth } from "@/components/auth/PublicAuthContext";
import PublicAccountMenu from "@/components/auth/PublicAccountMenu";
import { PicchuSpotLogo, BrandWordmark } from "@/components/brand";
import {
  RegionFlag,
  useDisplayRegion,
} from "@/components/pricing/currency-client";
import { REGION_OPTIONS, currencyForRegion } from "@/lib/currency";
import { getEnglishPath, getSpanishPath } from "@/lib/localized-routes";
import {
  trackContactIntentClick,
  trackLanguageSwitch,
  trackLoginClick,
  trackRegionCurrencySwitch,
  trackSignUpClick,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  getTopLevelForPath,
  topLevels,
  type SubNavLink,
  type TopLevelEntry,
} from "@/lib/nav";

// ============================================================
// HEADER — TWO-LEVEL NAVIGATION
//
// Row 1: brand wordmark + top-level category links + CTAs
// Row 2: service sub-links for the active top-level, with a
//         measurement-based "More" overflow dropdown
//
// Key fixes in this revision:
//
//   1. More dropdown — fixed-position overlay
//      The sub-nav row is inside a sticky header that has
//      overflow-x-hidden applied globally. `absolute top-full`
//      on the dropdown was being clipped by that or any ancestor
//      overflow context. Solution: measure the trigger button's
//      screen rect with getBoundingClientRect() and render the
//      dropdown with `position: fixed` at those coordinates.
//      This escapes every overflow context.
//
//   2. Mobile drawer — accordion sections
//      Each top-level category becomes an expandable accordion
//      section with a chevron arrow on the right. Tapping the
//      row header (or its arrow) toggles the sub-links. Clicking
//      any sub-link closes the entire mobile menu.
// ============================================================

const NAV_X_PADDING = "px-4 sm:px-6 lg:px-8 xl:px-5 2xl:px-10";

export type SiteLanguage = "en" | "es";

export const LANGUAGE_CHANGE_EVENT = "picchuspot:language-change";
const LANGUAGE_STORAGE_KEY = "picchuspot-language";
const LANGUAGE_COOKIE_NAME = "picchuspot_language";

export type ResourceMenuItem = {
  label: string;
  esLabel: string;
  description: string;
  esDescription: string;
  href?: string;
  localizedHref?: string;
  icon: typeof Info;
  status?: "coming-soon";
  availableLanguages?: SiteLanguage[];
};

export const resourceMenuItems: ResourceMenuItem[] = [
  {
    label: "About",
    esLabel: "Sobre nosotros",
    description: "Who PicchuSpot is and how we work.",
    esDescription: "Quién es PicchuSpot y cómo trabajamos.",
    href: "/about",
    icon: Info,
  },
  {
    label: "Contact Us",
    esLabel: "Contacto",
    description: "Quotes, local work, and order support.",
    esDescription: "Presupuestos, trabajos locales y soporte de pedidos.",
    href: "/contact",
    localizedHref: "/es/contact",
    icon: Mail,
  },
  {
    label: "Pricing",
    esLabel: "Precios",
    description: "Transparent rates for core visual services.",
    esDescription: "Tarifas claras para los servicios visuales principales.",
    href: "/pricing",
    localizedHref: "/es/pricing",
    icon: Tags,
  },
  {
    label: "Gallery",
    esLabel: "Galería",
    description: "Before-and-after examples and selected work.",
    esDescription: "Ejemplos antes/después y trabajos seleccionados.",
    href: "/gallery",
    localizedHref: "/es/gallery",
    icon: ImageIcon,
  },
  {
    label: "Resources",
    esLabel: "Recursos",
    description: "Guides and practical property marketing notes.",
    esDescription: "Guías y notas prácticas de marketing inmobiliario.",
    icon: BookOpen,
    status: "coming-soon",
  },
  {
    label: "Blog",
    esLabel: "Blog",
    description: "Practical guides on virtual staging, pricing, and real estate visuals.",
    esDescription: "Artículos y notas de mercado.",
    href: "/blog",
    icon: Newspaper,
    availableLanguages: ["en"],
  },
  {
    label: "FAQ",
    esLabel: "Preguntas frecuentes",
    description: "Common questions about services and delivery.",
    esDescription: "Dudas habituales sobre servicios y entregas.",
    href: "/faq",
    icon: HelpCircle,
  },
  {
    label: "Press Kit",
    esLabel: "Kit de prensa",
    description: "Brand assets and media information.",
    esDescription: "Materiales de marca e información para medios.",
    icon: FileText,
    status: "coming-soon",
  },
  {
    label: "Terms & Conditions",
    esLabel: "Términos y condiciones",
    description: "Service terms, revisions, delivery, and client responsibilities.",
    esDescription:
      "Condiciones del servicio, revisiones, entregas y responsabilidades del cliente.",
    href: "/terms",
    icon: FileText,
  },
  {
    label: "Privacy Policy",
    esLabel: "Política de privacidad",
    description: "How PicchuSpot handles account, order, and uploaded file data.",
    esDescription:
      "Cómo PicchuSpot gestiona datos de cuenta, pedidos y archivos subidos.",
    href: "/privacy",
    icon: ShieldCheck,
  },
];

const topLevelLabelsEs: Record<string, string> = {
  "Remote Digital Services": "Servicios digitales remotos",
  "Local Real Estate Media": "Media inmobiliaria local",
  Renders: "Renders",
  "Online Retail": "Retail online",
};

const subNavLabelsEs: Record<string, string> = {
  "Image Enhancement": "Mejora de imagen",
  "Day to Dusk": "Day to Dusk",
  "Virtual Staging": "Virtual Staging",
  "Real Estate Photo Editing": "Edición de fotos inmobiliarias",
  "Item Removal & Virtual Cleaning": "Eliminación de objetos y limpieza virtual",
  "Floor Plans": "Planos",
  "Virtual Renovation": "Renovación virtual",
  "360° Image Enhancement": "Mejora de imagen 360°",
  "360° Virtual Staging": "Virtual Staging 360°",
  "Aerial Editing": "Edición aérea",
  "Development Site Plans": "Planos de desarrollo",
  "Real Estate Photography": "Fotografía inmobiliaria",
  "360 Virtual Tours": "Tours virtuales 360",
  "Property Video Tours": "Vídeos inmobiliarios",
  "Drone / Aerial Media": "Media con dron / aérea",
  "Full Listing Media Packages": "Paquetes completos para anuncios",
  "Exterior Renders": "Renders exteriores",
  "Interior Renders": "Renders interiores",
  "360° Renders": "Renders 360°",
  "360° Virtual Tours": "Tours virtuales 360°",
  "Development Marketing": "Marketing de promociones",
  "Product Photo Editing": "Edición de fotos de producto",
  "Background Removal": "Eliminación de fondo",
  "Lifestyle Compositing": "Composiciones lifestyle",
  "Color Variations": "Variaciones de color",
  "Marketplace Images": "Imágenes para marketplaces",
};

function getHeaderLabel(label: string, language: SiteLanguage): string {
  return language === "es" ? (topLevelLabelsEs[label] ?? label) : label;
}

function getSubNavLabel(label: string, language: SiteLanguage): string {
  return language === "es" ? (subNavLabelsEs[label] ?? label) : label;
}

function getDrawerCopy(language: SiteLanguage) {
  return language === "es"
    ? {
        menu: "Menú",
        siteMenu: "Menú del sitio",
        closeMenu: "Cerrar menú",
        preferences: "Preferencias",
        language: "Idioma",
        region: "Región",
        servicesEyebrow: "Servicios",
        servicesTitle: "Servicios digitales remotos",
        servicesDescription:
          "Accede a los servicios y páginas de precios aunque la navegación superior esté oculta.",
        futureEyebrow: "Próximamente",
        futureTitle: "Más secciones",
        futureDescription:
          "Estas áreas están en preparación y se mantienen sin página traducida en esta PR.",
        explore: "Explorar",
        account: "Cuenta",
        accountDescription:
          "Accede al portal de cliente o crea una cuenta para gestionar pedidos.",
        login: "Iniciar sesión",
        signUp: "Crear cuenta",
        comingSoon: "Próximamente",
      }
    : {
        menu: "Menu",
        siteMenu: "Site menu",
        closeMenu: "Close menu",
        preferences: "Preferences",
        language: "Language",
        region: "Region",
        servicesEyebrow: "Services",
        servicesTitle: "Remote Digital Services",
        servicesDescription:
          "Access the service and pricing pages when the top navigation is hidden.",
        futureEyebrow: "Coming soon",
        futureTitle: "More sections",
        futureDescription:
          "These areas are still being prepared and remain disabled in this drawer.",
        explore: "Explore",
        account: "Account",
        accountDescription:
          "Access the client portal or create an account to manage orders.",
        login: "Login",
        signUp: "Sign Up",
        comingSoon: "Coming soon",
      };
}

function normalizeLanguagePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function isSiteLanguage(value: unknown): value is SiteLanguage {
  return value === "en" || value === "es";
}

function getPathLanguage(pathname: string): SiteLanguage | null {
  const normalized = normalizeLanguagePath(pathname);
  return normalized === "/es" || normalized.startsWith("/es/") ? "es" : null;
}

function readCookieLanguage(): SiteLanguage | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LANGUAGE_COOKIE_NAME}=`));
  if (!cookie) return null;
  const value = decodeURIComponent(cookie.split("=").slice(1).join("="));
  return isSiteLanguage(value) ? value : null;
}

export function readStoredLanguage(): SiteLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSiteLanguage(stored)) return stored;
  } catch {
    // Ignore unavailable storage.
  }
  return readCookieLanguage();
}

export function writeLanguagePreference(language: SiteLanguage) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore unavailable storage.
  }
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { language } }),
  );
}

export function getCurrentLanguage(
  pathname: string,
  savedLanguage: SiteLanguage | null
): SiteLanguage {
  return getPathLanguage(pathname) ?? savedLanguage ?? "en";
}

function getLanguageHref(pathname: string, language: SiteLanguage): string {
  const normalized = normalizeLanguagePath(pathname);
  if (language === "es") {
    return getSpanishPath(normalized) ?? "/es";
  }
  return getEnglishPath(normalized) ?? "/";
}

export function getLocaleAwareHref(href: string, language: SiteLanguage): string {
  if (language === "es") {
    return getSpanishPath(href) ?? href;
  }
  return getEnglishPath(href) ?? href;
}

export default function Header() {
  const pathname = usePathname() ?? "/";
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const currentLanguage = getCurrentLanguage(pathname, savedLanguage);
  const active = getTopLevelForPath(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    window.queueMicrotask(() => setSavedLanguage(readStoredLanguage()));
  }, []);

  const setLanguagePreference = (language: SiteLanguage) => {
    writeLanguagePreference(language);
    setSavedLanguage(language);
    trackLanguageSwitch(language, "header");
  };

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const insidePanel = menuPanelRef.current?.contains(target) ?? false;
      const insideButton = menuButtonRef.current?.contains(target) ?? false;
      if (!insidePanel && !insideButton) {
        closeMenu();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full overflow-x-hidden">
      {/* ── Row 1: brand + top-level + CTAs ── */}
      <div
        data-testid="public-header-primary-row"
        className={cn("bg-primary", NAV_X_PADDING)}
      >
        <div className="flex items-center h-14">
          {/* Brand */}
          <Link
            href={getLocaleAwareHref("/", currentLanguage)}
            aria-label="PicchuSpot — Real Estate Visuals home"
            className="flex items-center gap-2 flex-shrink-0"
          >
            <PicchuSpotLogo
              variant="mark-light"
              className="h-7 w-auto sm:h-8"
              width={64}
              height={32}
              alt=""
            />
            <BrandWordmark
              theme="dark"
              className="text-xl sm:text-[21px] xl:text-[22px]"
            />
          </Link>

          {/* Top-level categories (desktop) */}
          <nav
            aria-label="Service categories"
            className="hidden 3xl:ml-4 3xl:flex 3xl:min-w-0 3xl:items-center 3xl:gap-0.5 2xl:ml-10 2xl:gap-1"
          >
            {topLevels.map((entry) => {
              const isActive = entry.key === active.key;
              return (
                <Link
                  key={entry.key}
                  href={getLocaleAwareHref(entry.href, currentLanguage)}
                  className={cn(
                    "group relative inline-flex h-full items-center whitespace-nowrap px-1.5 text-[13px] font-bold uppercase tracking-[0.04em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white 2xl:px-2.5 2xl:text-sm 2xl:tracking-[0.06em]",
                    isActive
                      ? "text-white"
                      : "text-white/65 hover:text-white"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {getHeaderLabel(entry.label, currentLanguage)}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-0 left-1.5 right-1.5 h-[2px] origin-left bg-secondary transition-transform duration-200 2xl:left-2.5 2xl:right-2.5",
                      isActive
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100"
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Menu, account actions, and preferences */}
          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <button
              ref={menuButtonRef}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:h-10 sm:w-10"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <MobileHeaderAuthControl language={currentLanguage} />
            <HeaderAccountControls
              pathname={pathname}
              language={currentLanguage}
              className="hidden sm:flex"
              onLanguageChange={setLanguagePreference}
            />
          </div>
        </div>
      </div>

      {/* ── Row 2: desktop sub-nav ── */}
      {active.subLinks.length > 0 && (
        <DesktopSubNav
          key={active.key}
          active={active}
          pathname={pathname}
          language={currentLanguage}
        />
      )}

      {/* ── Mobile drawer ── */}
      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <BurgerMenuPanel
            panelRef={menuPanelRef}
            activeEntry={active}
            language={currentLanguage}
            pathname={pathname}
            onLanguageChange={setLanguagePreference}
            onClose={closeMenu}
          />,
          document.body
        )}
    </header>
  );
}

function HeaderAccountControls({
  pathname,
  language,
  className,
  onLanguageChange,
}: {
  pathname: string;
  language: SiteLanguage;
  className?: string;
  onLanguageChange: (language: SiteLanguage) => void;
}) {
  const { status } = usePublicAuth();

  return (
    <div className={cn("min-w-0 items-center gap-1.5 md:gap-2", className)}>
      {status === "authenticated" ? (
        <PublicAccountMenu theme="dark" className="hidden lg:block" />
      ) : (
        <GuestDesktopAuthActions
          language={language}
          loading={status === "loading"}
        />
      )}
      <MarketLanguageSelector
        pathname={pathname}
        currentLanguage={language}
        compact
        theme="dark"
        onLanguageChange={onLanguageChange}
        analyticsLocation="header"
      />
    </div>
  );
}

function GuestDesktopAuthActions({
  language,
  loading,
}: {
  language: SiteLanguage;
  loading: boolean;
}) {
  return (
    <div
      aria-hidden={loading}
      className={cn("contents", loading && "invisible")}
    >
      <Link
        href={getLocaleAwareHref("/login", language)}
        onClick={() => trackLoginClick("header")}
        tabIndex={loading ? -1 : undefined}
        className="inline-flex h-9 min-w-0 items-center justify-center whitespace-nowrap px-2 text-[13px] font-bold uppercase tracking-[0.04em] text-white/80 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white md:px-3 2xl:text-sm 2xl:tracking-[0.06em]"
        aria-label={language === "es" ? "Iniciar sesión" : "Login"}
      >
        {language === "es" ? "Iniciar sesión" : "Login"}
      </Link>
      <Link
        href={getLocaleAwareHref("/signup", language)}
        onClick={() => trackSignUpClick("header")}
        tabIndex={loading ? -1 : undefined}
        className="inline-flex h-9 min-w-0 items-center justify-center whitespace-nowrap rounded-md bg-secondary px-2.5 text-[13px] font-bold uppercase tracking-[0.04em] text-primary transition-colors hover:bg-secondary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-white md:px-3 2xl:px-4 2xl:text-sm 2xl:tracking-[0.06em]"
        aria-label={language === "es" ? "Crear cuenta" : "Sign Up"}
      >
        {language === "es" ? "Crear cuenta" : "Sign Up"}
      </Link>
    </div>
  );
}

function MobileHeaderAuthControl({ language }: { language: SiteLanguage }) {
  const { status } = usePublicAuth();

  if (status === "authenticated") {
    return null;
  }

  return (
    <Link
      href={getLocaleAwareHref("/login", language)}
      onClick={() => trackLoginClick("header")}
      aria-hidden={status === "loading"}
      tabIndex={status === "loading" ? -1 : undefined}
      className={cn(
        "inline-flex h-9 flex-shrink-0 items-center justify-center px-3 text-xs font-bold uppercase tracking-[0.10em] text-white/80 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:hidden",
        status === "loading" && "invisible"
      )}
      aria-label={language === "es" ? "Iniciar sesión" : "Login"}
    >
      {language === "es" ? "Iniciar sesión" : "Login"}
    </Link>
  );
}

// ============================================================
// HELPERS
// ============================================================

function resolveSubLinkHref(
  link: SubNavLink,
  base: string,
  language: SiteLanguage
): string {
  if (link.href.startsWith("#")) {
    const localizedBase = getLocaleAwareHref(base, language);
    return `${localizedBase === "/" ? "" : localizedBase}${link.href}`;
  }
  return getLocaleAwareHref(link.href, language);
}

// ============================================================
// MOBILE DRAWER — accordion sections
// ============================================================

interface MobileDrawerProps {
  active: TopLevelEntry;
  pathname: string;
  language: SiteLanguage;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MobileDrawer({
  active,
  pathname,
  language,
  openKey,
  setOpenKey,
  onClose,
}: MobileDrawerProps) {
  const toggleSection = (key: string) => {
    setOpenKey(openKey === key ? null : key);
  };

  return (
    <div className="lg:hidden border-t border-border bg-white">
      <div className="px-4 py-3 max-h-[80vh] overflow-y-auto">
        {/* Accordion sections — one per top-level category */}
        <div className="space-y-1 mb-4">
          {topLevels.map((entry) => {
            const isExpanded = openKey === entry.key;
            const isActive = entry.key === active.key;

            return (
              <div key={entry.key} className="rounded-lg overflow-hidden">
                {/* Section header — tap to toggle */}
                <button
                  type="button"
                  onClick={() => toggleSection(entry.key)}
                  aria-expanded={isExpanded}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-primary/5 text-primary"
                      : "text-foreground/80 hover:bg-surface"
                  )}
                >
                  <span className="text-[13px] font-bold uppercase tracking-[0.10em]">
                    {entry.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 flex-shrink-0 text-muted transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                    aria-hidden
                  />
                </button>

                {/* Sub-links — shown when section is expanded */}
                {isExpanded && (
                  <div className="pl-3 pb-2 space-y-0.5">
                    {entry.subLinks.length > 0 ? (
                      entry.subLinks.map((link) => {
                        const href = resolveSubLinkHref(
                          link,
                          entry.href,
                          language
                        );
                        const isCurrent =
                          !href.startsWith("#") && pathname === href;
                        return (
                          <Link
                            key={link.label}
                            href={href}
                            onClick={onClose}
                            className={cn(
                              "block px-3 py-2 rounded-md text-sm font-semibold tracking-[0.04em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                              isCurrent
                                ? "text-primary bg-primary/5"
                                : "text-foreground/65 hover:text-primary hover:bg-surface"
                            )}
                            aria-current={isCurrent ? "page" : undefined}
                          >
                            {link.label}
                          </Link>
                        );
                      })
                    ) : (
                      // No sub-links yet — link to the top-level page directly
                      <Link
                        href={getLocaleAwareHref(entry.href, language)}
                        onClick={onClose}
                        className="block px-3 py-2 rounded-md text-sm font-semibold tracking-[0.04em] text-foreground/65 hover:text-primary hover:bg-surface"
                      >
                        {entry.label}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

interface BurgerMenuPanelProps {
  panelRef: React.RefObject<HTMLDivElement | null>;
  activeEntry: TopLevelEntry;
  language: SiteLanguage;
  pathname: string;
  onLanguageChange: (language: SiteLanguage) => void;
  onClose: () => void;
}

export function getResourceHref(item: ResourceMenuItem, language: SiteLanguage) {
  if (item.status === "coming-soon") return null;
  if (item.availableLanguages && !item.availableLanguages.includes(language)) return null;
  if (!item.href) return null;
  return getLocaleAwareHref(item.href, language);
}

function BurgerMenuPanel({
  panelRef,
  activeEntry,
  language,
  pathname,
  onLanguageChange,
  onClose,
}: BurgerMenuPanelProps) {
  const copy = getDrawerCopy(language);
  const activeResourceMenuItems = resourceMenuItems.filter(
    (item) => Boolean(getResourceHref(item, language))
  );

  return (
    <div
      className="fixed inset-0 z-[10000] bg-primary/10 backdrop-blur-[2px] px-3 py-4 sm:px-6"
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={language === "es" ? "Menú del sitio" : "Site menu"}
        className="ml-auto mt-14 flex max-h-[calc(100vh-5.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <p className="text-public-kicker font-bold uppercase text-secondary-dark">
              PicchuSpot
            </p>
            <h2 className="text-lg font-bold text-primary">
              {language === "es" ? "Menú" : "Menu"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-200 text-primary transition-colors hover:border-primary/30 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={language === "es" ? "Cerrar menú" : "Close menu"}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto p-5 sm:p-6">
          <section className="xl:hidden">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-public-kicker font-bold uppercase text-muted">
                  {copy.servicesEyebrow}
                </p>
                <h3 className="mt-1 text-xl font-bold text-primary">
                  {getHeaderLabel(activeEntry.label, language)}
                </h3>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-muted">
                {copy.servicesDescription}
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <Link
                href={getLocaleAwareHref(activeEntry.href, language)}
                onClick={onClose}
                className="group flex items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 transition-colors hover:bg-primary hover:text-white"
              >
                <span>
                  <span className="block text-sm font-bold text-primary group-hover:text-white">
                    {getHeaderLabel(activeEntry.label, language)}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted group-hover:text-white/75">
                    {language === "es" && activeEntry.key === "remote"
                      ? "Ediciones entregadas en todo el mundo en 24-48 horas."
                      : activeEntry.tagline}
                  </span>
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-secondary-dark group-hover:text-white">
                  {language === "es" ? "Ver" : "View"}
                </span>
              </Link>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {activeEntry.subLinks.map((link) => {
                  const href = resolveSubLinkHref(
                    link,
                    activeEntry.href,
                    language
                  );
                  const isCurrent =
                    !href.startsWith("#") &&
                    normalizeLanguagePath(pathname) ===
                      normalizeLanguagePath(href);
                  return (
                    <Link
                      key={link.label}
                      href={href}
                      onClick={onClose}
                      aria-current={isCurrent ? "page" : undefined}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-sm font-semibold leading-snug transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isCurrent
                          ? "border-primary/30 bg-primary/5 text-primary"
                          : "border-stone-200 text-foreground/75 hover:border-primary/30 hover:bg-surface hover:text-primary"
                      )}
                    >
                      {getSubNavLabel(link.label, language)}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-surface/60 p-4 sm:hidden">
            <p className="mb-3 text-public-kicker font-bold uppercase text-muted">
              {language === "es" ? "Preferencias" : "Preferences"}
            </p>
            <MarketLanguageSelector
              pathname={pathname}
              currentLanguage={language}
              className="w-full"
              placement="panel"
              onNavigate={onClose}
              onLanguageChange={onLanguageChange}
              analyticsLocation="mobile_menu"
            />
          </section>

          <section>
            <p className="mb-3 text-public-kicker font-bold uppercase text-muted">
              {language === "es" ? "Explorar" : "Explore"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeResourceMenuItems.map((item) => {
                const href = getResourceHref(item, language);
                if (!href) return null;
                return (
                  <ResourceMenuLink
                    key={item.label}
                    item={item}
                    language={language}
                    href={href}
                    onClose={onClose}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ResourceMenuLink({
  item,
  language,
  href,
  onClose,
}: {
  item: ResourceMenuItem;
  language: SiteLanguage;
  href: string;
  onClose: () => void;
}) {
  const Icon = item.icon;
  const label = language === "es" ? item.esLabel : item.label;
  const description =
    language === "es" ? item.esDescription : item.description;
  const content = (
    <>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface text-secondary-dark">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-primary">{label}</span>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">
          {description}
        </span>
      </span>
    </>
  );

  return (
    <Link
      href={href}
      onClick={() => {
        if (href === "/contact" || href === "/es/contact") {
          trackContactIntentClick("header");
        }
        onClose();
      }}
      className="flex gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 transition-colors hover:border-primary/30 hover:bg-surface"
    >
      {content}
    </Link>
  );
}

type MarketLanguageSelectorPlacement = "header" | "panel";
type MarketLanguageSelectorTheme = "light" | "dark";

export function MarketLanguageSelector({
  pathname,
  currentLanguage,
  className,
  compact = false,
  tight = false,
  placement = "header",
  theme = "light",
  onNavigate,
  onLanguageChange,
  analyticsLocation,
  getLanguageOptionHref,
}: {
  pathname: string;
  currentLanguage: SiteLanguage;
  className?: string;
  compact?: boolean;
  tight?: boolean;
  placement?: MarketLanguageSelectorPlacement;
  theme?: MarketLanguageSelectorTheme;
  onNavigate?: () => void;
  onLanguageChange: (language: SiteLanguage) => void;
  analyticsLocation: string;
  getLanguageOptionHref?: (language: SiteLanguage) => string;
}) {
  const [region, setRegion] = useDisplayRegion();
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    right: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const activeOption =
    REGION_OPTIONS.find((option) => option.code === region) ??
    REGION_OPTIONS[0];
  const usePortal = placement === "header";
  const darkHeaderTrigger = placement === "header" && theme === "dark";

  const updatePanelPosition = useCallback(() => {
    if (!buttonRef.current || !usePortal) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const panelWidth = Math.min(336, viewportWidth - 24);
    const desiredRight = viewportWidth - rect.right;
    const maxRight = viewportWidth - panelWidth - 12;
    setPanelPos({
      top: rect.bottom + 8,
      right: Math.max(12, Math.min(desiredRight, maxRight)),
      width: panelWidth,
    });
  }, [usePortal]);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const insideRoot = rootRef.current?.contains(target) ?? false;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (!insideRoot && !insidePanel) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition);
    };
  }, [open, updatePanelPosition]);

  const copy =
    currentLanguage === "es"
      ? {
          aria: "Seleccionar mercado, moneda e idioma",
          market: "Mercado",
          language: "Idioma",
          selected: "Seleccionado",
          english: "Ingl\u00e9s",
          spanish: "Espa\u00f1ol",
        }
      : {
          aria: "Select market, currency, and language",
          market: "Market",
          language: "Language",
          selected: "Selected",
          english: "English",
          spanish: "Spanish",
        };
  const languageOptions: { code: SiteLanguage; label: string }[] = [
    { code: "en", label: copy.english },
    { code: "es", label: copy.spanish },
  ];
  const marketLabelsEs: Record<string, string> = {
    US: "Estados Unidos",
    CA: "Canad\u00e1",
    EU: "Europa",
  };
  const getMarketLabel = (option: (typeof REGION_OPTIONS)[number]) =>
    currentLanguage === "es"
      ? (marketLabelsEs[option.code] ?? option.label)
      : option.label;

  const panel = (
    <div
      ref={panelRef}
      style={
        usePortal && panelPos
          ? {
              position: "fixed",
              top: panelPos.top,
              right: panelPos.right,
              width: panelPos.width,
              zIndex: 10000,
            }
          : undefined
      }
      className={cn(
        "overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl",
        usePortal ? null : "mt-2 w-full shadow-sm"
      )}
    >
      <div className="border-b border-border p-2.5">
        <p className="px-2 pb-1.5 text-public-kicker font-bold uppercase text-muted">
          {copy.market}
        </p>
        <div className="space-y-1">
          {REGION_OPTIONS.map((option) => {
            const active = option.code === region;
            return (
              <button
                key={option.code}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setRegion(option.code);
                  trackRegionCurrencySwitch({
                    selectedRegion: option.code,
                    currency: option.currency,
                    location: analyticsLocation,
                  });
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-primary/5 text-primary"
                    : "text-foreground hover:bg-surface hover:text-primary"
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <RegionFlag code={option.code} />
                  <span className="truncate">
                    {getMarketLabel(option)} {"\u2014"} {option.currency}
                  </span>
                </span>
                {active && (
                  <span className="flex-shrink-0 text-xs font-bold uppercase tracking-[0.10em]">
                    {copy.selected}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-2.5">
        <p className="px-2 pb-1.5 text-public-kicker font-bold uppercase text-muted">
          {copy.language}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {languageOptions.map((option) => {
            const active = option.code === currentLanguage;
            return (
              <Link
                key={option.code}
                href={
                  getLanguageOptionHref?.(option.code) ??
                  getLanguageHref(pathname, option.code)
                }
                onClick={() => {
                  onLanguageChange(option.code);
                  setOpen(false);
                  onNavigate?.();
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-bold transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "bg-surface text-foreground/75 hover:bg-primary/5 hover:text-primary"
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative",
        placement === "header" ? "inline-flex flex-shrink-0" : "block",
        className
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={copy.aria}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          updatePanelPosition();
          setOpen((value) => !value);
        }}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-lg border py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          darkHeaderTrigger
            ? "border-white/15 bg-white/5 hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-primary"
            : "border-stone-200 bg-white/95 shadow-sm hover:border-primary/30 focus-visible:ring-primary",
          placement === "header"
            ? compact
              ? tight
                ? "h-9 min-w-[4.75rem] gap-1 px-1.5 sm:min-w-[6.5rem] sm:px-2"
                : "h-9 min-w-[6.5rem] px-2 xl:min-w-[7rem] 2xl:min-w-[8rem] 2xl:px-3"
              : "h-9 min-w-[7rem] px-2 2xl:min-w-[8rem] 2xl:px-3"
            : "w-full px-3"
        )}
      >
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1 text-[13px] font-bold uppercase tracking-[0.04em] sm:gap-1.5 sm:text-sm sm:tracking-[0.06em]",
            darkHeaderTrigger ? "text-white" : "text-primary"
          )}
        >
          <span className={cn(tight && "hidden sm:inline-flex")}>
            <RegionFlag code={activeOption.code} />
          </span>
          <span>{currencyForRegion(region)}</span>
          <span className={darkHeaderTrigger ? "text-white/60" : "text-muted"}>
            {"\u00b7"}
          </span>
          <span>{currentLanguage.toUpperCase()}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 transition-transform",
            darkHeaderTrigger ? "text-white/70" : "text-primary",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && usePortal && panelPos && createPortal(panel, document.body)}
      {open && !usePortal && panel}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LanguageSelector({
  pathname,
  currentLanguage,
  compact = false,
  className,
  onNavigate,
  onLanguageChange,
}: {
  pathname: string;
  currentLanguage: SiteLanguage;
  compact?: boolean;
  className?: string;
  onNavigate?: () => void;
  onLanguageChange: (language: SiteLanguage) => void;
}) {
  const options: { code: SiteLanguage; label: string }[] = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  return (
    <nav
      aria-label="Select language"
      className={cn(
        "inline-flex items-center rounded-lg border border-stone-200 bg-white/95 p-0.5 shadow-sm",
        compact && "h-9 flex-shrink-0",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex items-center px-2 text-primary",
          compact && "hidden lg:inline-flex"
        )}
      >
        <Globe2 className="h-4 w-4" aria-hidden />
      </span>
      {options.map((option) => {
        const active = option.code === currentLanguage;
        return (
          <Link
            key={option.code}
            href={getLanguageHref(pathname, option.code)}
            onClick={() => {
              onLanguageChange(option.code);
              onNavigate?.();
            }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex flex-1 items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors",
              compact && "min-w-7 px-2",
              active
                ? "bg-primary text-white"
                : "text-foreground/70 hover:bg-surface hover:text-primary"
            )}
          >
            {compact
              ? option.code.toUpperCase()
              : option.code === "es"
                ? "Español"
                : option.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ============================================================
// DESKTOP SUB-NAV WITH MEASUREMENT-BASED "MORE" OVERFLOW
//
// The More dropdown is rendered with position:fixed at the
// screen coordinates of the trigger button so it escapes every
// overflow context (including the sticky header's
// overflow-x-hidden and any parent clipping).
// ============================================================

interface DesktopSubNavProps {
  active: TopLevelEntry;
  pathname: string;
  language: SiteLanguage;
}

function DesktopSubNav({ active, pathname, language }: DesktopSubNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureLayerRef = useRef<HTMLDivElement | null>(null);
  const measureMoreRef = useRef<HTMLSpanElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  // Ref forwarded into MoreDropdown so the outside-click handler
  // can check both the trigger button AND the panel itself before
  // deciding to close. Without this a pointerdown on a menu item
  // would close the dropdown before the Link's click/navigation
  // had a chance to complete.
  const dropdownPanelRef = useRef<HTMLDivElement | null>(null);
  const [overflowAt, setOverflowAt] = useState(active.subLinks.length);
  const [moreOpen, setMoreOpen] = useState(false);
  // Screen coords for the fixed dropdown
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  // Measure which sub-links fit in the visible row.
  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const layer = measureLayerRef.current;
      if (!container || !layer) return;

      const availableWidth = container.offsetWidth;
      const spans = Array.from(layer.children).filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && el.dataset.subnavMeasure === "link"
      );
      if (spans.length === 0) return;

      // Pass 1: does everything fit?
      let allFit = 0;
      for (let i = 0; i < spans.length; i++) {
        if (spans[i].offsetLeft + spans[i].offsetWidth > availableWidth) break;
        allFit = i + 1;
      }
      if (allFit === spans.length) {
        setOverflowAt(spans.length);
        return;
      }

      // Pass 2: reserve More-button width
      const moreWidth = measureMoreRef.current?.offsetWidth ?? 90;
      const allowed = availableWidth - moreWidth - 16;
      let count = 0;
      for (let i = 0; i < spans.length; i++) {
        if (spans[i].offsetLeft + spans[i].offsetWidth > allowed) break;
        count = i + 1;
      }
      setOverflowAt(Math.max(1, count));
    };

    measure();
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Open dropdown and capture the trigger button's position
  const openMore = () => {
    if (!moreButtonRef.current) return;
    const rect = moreButtonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,   // 4 px gap below the button
      right: window.innerWidth - rect.right,
    });
    setMoreOpen(true);
  };

  const closeMore = () => setMoreOpen(false);

  // Close on outside click or Escape
  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      // Close only when the click is outside BOTH the trigger button
      // and the dropdown panel. This prevents the pointerdown from
      // closing the menu before a Link inside the panel has time to
      // fire its click / navigation event.
      const target = e.target as Node;
      const insideButton = moreButtonRef.current?.contains(target) ?? false;
      const insidePanel = dropdownPanelRef.current?.contains(target) ?? false;
      if (!insideButton && !insidePanel) {
        closeMore();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMore();
    };
    // Re-position on scroll so the dropdown follows the button if
    // the page scrolls (though with sticky header this is minimal)
    const onScroll = () => {
      if (moreButtonRef.current) {
        const rect = moreButtonRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [moreOpen]);

  const visible = active.subLinks.slice(0, overflowAt);
  const overflow = active.subLinks.slice(overflowAt);

  return (
    <div className="hidden border-b border-border bg-white lg:block">
      <div className={cn("relative", NAV_X_PADDING)}>
        {/* Hidden measurement mirror */}
        <div
          ref={measureLayerRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 flex items-center gap-x-4 overflow-hidden whitespace-nowrap py-2.5 invisible sm:inset-x-6 lg:inset-x-8 xl:inset-x-5 xl:gap-x-7 2xl:inset-x-10"
        >
          {active.subLinks.map((link) => (
            <span
              key={`measure-${link.label}`}
              data-subnav-measure="link"
              className="text-sm font-bold uppercase tracking-[0.04em] xl:text-[15px] xl:tracking-[0.06em]"
            >
              {getSubNavLabel(link.label, language)}
            </span>
          ))}
          <span
            ref={measureMoreRef}
            data-subnav-measure="more"
            className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.04em] xl:text-[15px] xl:tracking-[0.06em]"
          >
            {language === "es" ? "Más" : "More"}
            <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          </span>
        </div>

        {/* Visible row */}
        <div ref={containerRef} className="flex items-stretch">
          <nav
            aria-label={`${getHeaderLabel(active.label, language)} services`}
            className="flex items-stretch gap-x-4 xl:gap-x-7 flex-1 min-w-0 overflow-hidden"
          >
            {visible.map((link) => {
              const href = resolveSubLinkHref(link, active.href, language);
              const isCurrent = !href.startsWith("#") && pathname === href;
              return (
                <SubNavItem
                  key={link.label}
                  href={href}
                  label={getSubNavLabel(link.label, language)}
                  current={isCurrent}
                />
              );
            })}
          </nav>

          {overflow.length > 0 && (
            <div className="relative flex-shrink-0 flex items-stretch ml-3 xl:ml-4">
              <button
                ref={moreButtonRef}
                type="button"
                onClick={() => (moreOpen ? closeMore() : openMore())}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={cn(
                  "group relative inline-flex items-center gap-1.5 whitespace-nowrap py-2.5 text-sm font-bold uppercase tracking-[0.04em] transition-colors focus:outline-none focus-visible:text-primary xl:text-[15px] xl:tracking-[0.06em]",
                  moreOpen
                    ? "text-primary"
                    : "text-foreground/65 hover:text-primary"
                )}
              >
                {language === "es" ? "Más" : "More"}
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform duration-200",
                    moreOpen && "rotate-180"
                  )}
                  aria-hidden
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-0 left-0 right-0 h-[2px] origin-left bg-secondary transition-transform duration-200",
                    moreOpen
                      ? "scale-x-100"
                      : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100"
                  )}
                />
              </button>

              {/* Dropdown — fixed position so it escapes every
                  overflow / stacking context in the sticky header */}
              {moreOpen && dropdownPos && (
                <MoreDropdown
                  links={overflow}
                  active={active}
                  pathname={pathname}
                  language={language}
                  top={dropdownPos.top}
                  right={dropdownPos.right}
                  onClose={closeMore}
                  panelRef={dropdownPanelRef}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── More dropdown rendered at fixed screen coordinates ────────

interface MoreDropdownProps {
  links: SubNavLink[];
  active: TopLevelEntry;
  pathname: string;
  language: SiteLanguage;
  top: number;
  right: number;
  onClose: () => void;
  /** Forwarded ref attached to the panel div so the outside-click
   *  handler in DesktopSubNav can test containment before closing. */
  panelRef: React.RefObject<HTMLDivElement | null>;
}

function MoreDropdown({
  links,
  active,
  pathname,
  language,
  top,
  right,
  onClose,
  panelRef,
}: MoreDropdownProps) {
  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={`${getHeaderLabel(active.label, language)} ${
        language === "es" ? "más servicios" : "more services"
      }`}
      style={{
        position: "fixed",
        top,
        right,
        width: "18rem",   // w-72
        zIndex: 9999,
      }}
      className="bg-white border border-border rounded-lg shadow-xl py-2"
    >
      {links.map((link) => {
        const href = resolveSubLinkHref(link, active.href, language);
        const isCurrent = !href.startsWith("#") && pathname === href;
        return (
          <Link
            key={link.label}
            href={href}
            role="menuitem"
            aria-current={isCurrent ? "page" : undefined}
            onClick={onClose}
            className={cn(
              "block px-4 py-2.5 text-sm font-bold uppercase tracking-[0.06em] transition-colors focus:outline-none focus-visible:bg-surface",
              isCurrent
                ? "text-primary bg-primary/5"
                : "text-foreground/75 hover:text-primary hover:bg-surface"
            )}
          >
            {getSubNavLabel(link.label, language)}
          </Link>
        );
      })}
    </div>
  );
}

// ── Sub-nav visible link ──────────────────────────────────────

interface SubNavItemProps {
  href: string;
  label: string;
  current: boolean;
}

function SubNavItem({ href, label, current }: SubNavItemProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group relative inline-flex items-center whitespace-nowrap py-2.5 text-sm font-bold uppercase tracking-[0.04em] transition-colors focus:outline-none focus-visible:text-primary xl:text-[15px] xl:tracking-[0.06em]",
        current ? "text-primary" : "text-foreground/65 hover:text-primary"
      )}
    >
      {label}
      <span
        aria-hidden
        className={cn(
          "absolute bottom-0 left-0 right-0 h-[2px] origin-left bg-secondary transition-transform duration-200",
          current
            ? "scale-x-100"
            : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100"
        )}
      />
    </Link>
  );
}
