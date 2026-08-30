export const localizedRoutes = [
  { englishPath: "/", spanishPath: "/es", priority: 1 },
  { englishPath: "/services", spanishPath: "/es/services", priority: 0.9 },
  { englishPath: "/pricing", spanishPath: "/es/pricing", priority: 0.9 },
  { englishPath: "/contact", spanishPath: "/es/contact", priority: 0.8 },
  { englishPath: "/about", spanishPath: "/es/about", priority: 0.7 },
  { englishPath: "/faq", spanishPath: "/es/faq", priority: 0.6 },
  { englishPath: "/legal", spanishPath: "/es/legal", priority: 0.4 },
  { englishPath: "/terms", spanishPath: "/es/terms", priority: 0.4 },
  { englishPath: "/privacy", spanishPath: "/es/privacy", priority: 0.4 },
  { englishPath: "/cookies", spanishPath: "/es/cookies", priority: 0.4 },
  { englishPath: "/refunds", spanishPath: "/es/refunds", priority: 0.4 },
  {
    englishPath: "/login",
    spanishPath: "/es/login",
    priority: 0,
    includeInSitemap: false,
  },
  {
    englishPath: "/signup",
    spanishPath: "/es/signup",
    priority: 0,
    includeInSitemap: false,
  },
  {
    englishPath: "/pricing/virtual-staging",
    spanishPath: "/es/pricing/virtual-staging",
    priority: 0.7,
  },
  {
    englishPath: "/pricing/photo-editing",
    spanishPath: "/es/pricing/photo-editing",
    priority: 0.7,
  },
  {
    englishPath: "/pricing/virtual-renovation",
    spanishPath: "/es/pricing/virtual-renovation",
    priority: 0.7,
  },
  {
    englishPath: "/pricing/floor-plans",
    spanishPath: "/es/pricing/floor-plans",
    priority: 0.7,
  },
  {
    englishPath: "/pricing/image-enhancement",
    spanishPath: "/es/pricing/image-enhancement",
    priority: 0.7,
  },
  {
    englishPath: "/pricing/day-to-dusk",
    spanishPath: "/es/pricing/day-to-dusk",
    priority: 0.7,
  },
  {
    englishPath: "/pricing/360-image-enhancement",
    spanishPath: "/es/pricing/360-image-enhancement",
    priority: 0.7,
  },
  {
    englishPath: "/pricing/360-virtual-staging",
    spanishPath: "/es/pricing/360-virtual-staging",
    priority: 0.7,
  },
  {
    englishPath: "/pricing/aerial-editing",
    spanishPath: "/es/pricing/aerial-editing",
    priority: 0.7,
  },
  {
    englishPath: "/pricing/development-site-plans",
    spanishPath: "/es/pricing/development-site-plans",
    priority: 0.7,
  },
  // ── Gallery ─────────────────────────────────────────────────
  { englishPath: "/gallery", spanishPath: "/es/gallery", priority: 0.8 },
  // Gallery service detail routes are kept for language switching but excluded
  // from the static sitemap. Content availability is dynamic (depends on what
  // the admin has published) and empty pages should not be indexed.
  {
    englishPath: "/gallery/virtual-staging",
    spanishPath: "/es/gallery/virtual-staging",
    priority: 0.7,
    includeInSitemap: false,
  },
  {
    englishPath: "/gallery/virtual-renovation",
    spanishPath: "/es/gallery/virtual-renovation",
    priority: 0.7,
    includeInSitemap: false,
  },
  {
    englishPath: "/gallery/floor-plans",
    spanishPath: "/es/gallery/floor-plans",
    priority: 0.7,
    includeInSitemap: false,
  },
  {
    englishPath: "/gallery/image-enhancement",
    spanishPath: "/es/gallery/image-enhancement",
    priority: 0.7,
    includeInSitemap: false,
  },
  {
    englishPath: "/gallery/item-removal-virtual-cleaning",
    spanishPath: "/es/gallery/item-removal-virtual-cleaning",
    priority: 0.7,
    includeInSitemap: false,
  },
  {
    englishPath: "/gallery/day-to-dusk",
    spanishPath: "/es/gallery/day-to-dusk",
    priority: 0.7,
    includeInSitemap: false,
  },
  {
    englishPath: "/gallery/360-image-enhancement",
    spanishPath: "/es/gallery/360-image-enhancement",
    priority: 0.7,
    includeInSitemap: false,
  },
  {
    englishPath: "/gallery/360-virtual-staging",
    spanishPath: "/es/gallery/360-virtual-staging",
    priority: 0.7,
    includeInSitemap: false,
  },
  {
    englishPath: "/gallery/aerial-editing",
    spanishPath: "/es/gallery/aerial-editing",
    priority: 0.7,
    includeInSitemap: false,
  },
  {
    englishPath: "/gallery/development-site-plans",
    spanishPath: "/es/gallery/development-site-plans",
    priority: 0.7,
    includeInSitemap: false,
  },
] as const satisfies readonly {
  englishPath: string;
  spanishPath: string;
  priority: number;
  includeInSitemap?: boolean;
}[];

export type LocalizedRoute = (typeof localizedRoutes)[number];
export type EnglishLocalizedPath = LocalizedRoute["englishPath"];
export type SpanishLocalizedPath = LocalizedRoute["spanishPath"];

export const englishToSpanishRoutes = Object.fromEntries(
  localizedRoutes.map(({ englishPath, spanishPath }) => [
    englishPath,
    spanishPath,
  ]),
) as Record<EnglishLocalizedPath, SpanishLocalizedPath>;

export const spanishToEnglishRoutes = Object.fromEntries(
  localizedRoutes.map(({ englishPath, spanishPath }) => [
    spanishPath,
    englishPath,
  ]),
) as Record<SpanishLocalizedPath, EnglishLocalizedPath>;

export function isEnglishLocalizedPath(
  path: string,
): path is EnglishLocalizedPath {
  return path in englishToSpanishRoutes;
}

export function isSpanishLocalizedPath(
  path: string,
): path is SpanishLocalizedPath {
  return path in spanishToEnglishRoutes;
}

export function getSpanishPath(path: string): SpanishLocalizedPath | null {
  return isEnglishLocalizedPath(path) ? englishToSpanishRoutes[path] : null;
}

export function getEnglishPath(path: string): EnglishLocalizedPath | null {
  return isSpanishLocalizedPath(path) ? spanishToEnglishRoutes[path] : null;
}
