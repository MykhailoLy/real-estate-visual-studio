"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PicchuSpotLogo, BrandWordmark } from "@/components/brand";
import TrackedLink from "@/components/analytics/TrackedLink";
import CookieSettingsButton from "@/components/privacy/CookieSettingsButton";

type FooterLink = {
  href: string;
  label: string;
  tracked?: boolean;
};

const footerCopy = {
  en: {
    tagline: "Real Estate Visuals",
    description:
      "Property visuals that make listings stand out. Remote digital services worldwide. Local photography in Alicante & Costa Blanca.",
    servicesHeading: "Services",
    pagesHeading: "Pages",
    serviceAreaHeading: "Service Area",
    rights: "All rights reserved.",
    cookieSettings: "Cookie settings",
    services: [
      { href: "/pricing/virtual-staging", label: "Virtual Staging" },
      { href: "/pricing/virtual-renovation", label: "Virtual Renovation" },
      { href: "/pricing/floor-plans", label: "3D Floor Plans" },
      { href: "/pricing/photo-editing", label: "Photo Editing" },
      { href: "/local#real-estate-photography", label: "Photography" },
    ],
    pages: [
      { href: "/gallery", label: "Gallery" },
      { href: "/pricing", label: "Pricing" },
      { href: "/order", label: "Order Online", tracked: true },
      { href: "/about", label: "About Us" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact", tracked: true },
    ],
    legal: [
      { href: "/legal", label: "Legal Notice" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/cookies", label: "Cookie Policy" },
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/refunds", label: "Refunds & Cancellations" },
    ],
  },
  es: {
    tagline: "Visuales inmobiliarios",
    description:
      "Visuales inmobiliarios que hacen destacar los anuncios. Servicios digitales remotos en todo el mundo. Fotografía local en Alicante y Costa Blanca.",
    servicesHeading: "Servicios",
    pagesHeading: "Páginas",
    serviceAreaHeading: "Área de servicio",
    rights: "Todos los derechos reservados.",
    cookieSettings: "Configuración de cookies",
    services: [
      { href: "/es/pricing/virtual-staging", label: "Virtual Staging" },
      { href: "/es/pricing/virtual-renovation", label: "Renovación virtual" },
      { href: "/es/pricing/floor-plans", label: "Planos 3D" },
      { href: "/es/pricing/photo-editing", label: "Edición fotográfica" },
      { href: "/es/pricing", label: "Fotografía" },
    ],
    pages: [
      { href: "/es/gallery", label: "Galería" },
      { href: "/es/pricing", label: "Precios" },
      { href: "/order", label: "Pedir online", tracked: true },
      { href: "/es/about", label: "Sobre nosotros" },
      { href: "/es/faq", label: "Preguntas frecuentes" },
      { href: "/es/contact", label: "Contacto", tracked: true },
    ],
    legal: [
      { href: "/es/legal", label: "Aviso legal" },
      { href: "/es/privacy", label: "Política de privacidad" },
      { href: "/es/cookies", label: "Política de cookies" },
      { href: "/es/terms", label: "Términos y condiciones" },
      { href: "/es/refunds", label: "Reembolsos y cancelaciones" },
    ],
  },
} satisfies Record<
  "en" | "es",
  {
    tagline: string;
    description: string;
    servicesHeading: string;
    pagesHeading: string;
    serviceAreaHeading: string;
    rights: string;
    cookieSettings: string;
    services: FooterLink[];
    pages: FooterLink[];
    legal: FooterLink[];
  }
>;

const serviceAreaCities = [
  "Alicante",
  "Benidorm",
  "Torrevieja",
  "Javea",
  "Denia",
  "Calpe",
  "Orihuela Costa",
  "Elche",
  "Santa Pola",
  "Villajoyosa",
];

function isSpanishPath(pathname: string | null): boolean {
  return pathname === "/es" || Boolean(pathname?.startsWith("/es/"));
}

function FooterLinkItem({
  link,
}: {
  link: FooterLink;
}) {
  if (link.tracked) {
    return (
      <TrackedLink
        href={link.href}
        analyticsLabel={link.label}
        analyticsLocation="footer"
        className="text-base text-white/70 hover:text-white transition-colors"
      >
        {link.label}
      </TrackedLink>
    );
  }

  return (
    <Link
      href={link.href}
      className="text-base text-white/70 hover:text-white transition-colors"
    >
      {link.label}
    </Link>
  );
}

export default function Footer() {
  const pathname = usePathname();
  const language = isSpanishPath(pathname) ? "es" : "en";
  const copy = footerCopy[language];

  return (
    <footer className="bg-primary text-white">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-2" aria-label="PicchuSpot home">
              <PicchuSpotLogo
                variant="mark-light"
                className="h-7 w-auto lg:h-9"
                width={72}
                height={36}
                alt=""
              />
              <BrandWordmark theme="dark" className="text-xl lg:text-2xl" />
            </Link>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60 mb-4">
              {copy.tagline}
            </p>
            <p className="text-base leading-relaxed text-white/70 mb-4">
              {copy.description}
            </p>
          </div>

          <div>
            <p className="text-base font-semibold uppercase tracking-wider mb-4">
              {copy.servicesHeading}
            </p>
            <ul className="space-y-2">
              {copy.services.map((link) => (
                <li key={link.href}>
                  <FooterLinkItem link={link} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-base font-semibold uppercase tracking-wider mb-4">
              {copy.pagesHeading}
            </p>
            <ul className="space-y-2">
              {copy.pages.map((link) => (
                <li key={link.href}>
                  <FooterLinkItem link={link} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-base font-semibold uppercase tracking-wider mb-4">
              {copy.serviceAreaHeading}
            </p>
            <p className="text-base leading-relaxed text-white/70">
              {serviceAreaCities.join(" · ")}
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/20 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} PicchuSpot. {copy.rights}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {copy.legal.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <CookieSettingsButton label={copy.cookieSettings} />
          </div>
        </div>
      </div>
    </footer>
  );
}
