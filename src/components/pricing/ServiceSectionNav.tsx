interface ServiceSectionNavProps {
  locale?: "en" | "es";
  showStyles?: boolean;
}

/** Plain anchors keep long service pages easy to scan without more client JS. */
export default function ServiceSectionNav({
  locale = "en",
  showStyles = false,
}: ServiceSectionNavProps) {
  const es = locale === "es";
  const links = [
    { href: "#examples", label: es ? "Ejemplos" : "Examples" },
    ...(showStyles
      ? [{ href: "#styles", label: es ? "Estilos" : "Styles" }]
      : []),
    { href: "#requirements", label: es ? "Qué enviar" : "What to send" },
    { href: "#pricing", label: es ? "Precios" : "Pricing" },
    { href: "#faq", label: es ? "Preguntas frecuentes" : "FAQ" },
  ];

  return (
    <nav
      aria-label={es ? "En esta página" : "On this page"}
      className="mt-6 border-t border-border pt-3"
    >
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {links.map(({ href, label }) => (
          <li key={href}>
            <a
              href={href}
              className="inline-flex min-h-11 items-center text-public-copy-sm font-semibold text-muted underline-offset-4 hover:text-primary hover:underline"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
