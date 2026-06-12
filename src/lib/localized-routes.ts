export const localizedRoutes = [
  { englishPath: "/", spanishPath: "/es", priority: 1 },
  { englishPath: "/services", spanishPath: "/es/services", priority: 0.9 },
  { englishPath: "/pricing", spanishPath: "/es/pricing", priority: 0.9 },
  { englishPath: "/contact", spanishPath: "/es/contact", priority: 0.8 },
  { englishPath: "/about", spanishPath: "/es/about", priority: 0.7 },
  { englishPath: "/faq", spanishPath: "/es/faq", priority: 0.6 },
  { englishPath: "/terms", spanishPath: "/es/terms", priority: 0.4 },
  { englishPath: "/privacy", spanishPath: "/es/privacy", priority: 0.4 },
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
