export type BeforeAfterAltLocale = "en" | "es";

export interface BeforeAfterAltInput {
  /** User-authored ALT for the specific Before image. Preserved verbatim. */
  beforeAlt?: string | null;
  /** User-authored ALT for the specific After image. Preserved verbatim. */
  afterAlt?: string | null;
  /** Shared scene description, such as site_media_items.alt_text. */
  sharedAlt?: string | null;
  title?: string | null;
  description?: string | null;
  /** Prefer the canonical human-readable label when one is available. */
  serviceLabel?: string | null;
  /** Free-text fallback for legacy site-media rows without a known label. */
  serviceSlug?: string | null;
  locale?: BeforeAfterAltLocale;
}

export interface BeforeAfterAltResult {
  beforeAlt: string;
  afterAlt: string;
}

function explicitAlt(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function metadataText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function serviceContext({
  serviceLabel,
  serviceSlug,
  locale,
}: Pick<
  BeforeAfterAltInput,
  "serviceLabel" | "serviceSlug" | "locale"
>): string | null {
  const label = metadataText(serviceLabel);
  const slugFallback = metadataText(serviceSlug)?.replace(/-+/g, " ");
  const context = label ?? slugFallback;
  if (!context) return null;

  if (locale === "es") return context;

  const lower = context.toLocaleLowerCase("en-US");
  return lower === "day to dusk" || lower === "day-to-dusk"
    ? "day-to-dusk editing"
    : lower;
}

function comparisonWords(value: string): string[] {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 0 &&
        !["editing", "service", "servicio", "edicion"].includes(word),
    );
}

function sceneIncludesService(scene: string, context: string): boolean {
  const sceneWords = new Set(comparisonWords(scene));
  const contextWords = comparisonWords(context);
  return (
    contextWords.length > 0 &&
    contextWords.every((word) => sceneWords.has(word))
  );
}

function cleanGeneratedScene(value: string | null): string | null {
  if (!value) return null;
  const withoutSidePrefix = value.replace(
    /^(?:before|after|antes|despu[eé]s)(?:\s+(?:image|photo|imagen|foto))?\s*(?::|[-–—])?\s*/i,
    "",
  );
  return metadataText(withoutSidePrefix);
}

function generatedAlt(
  side: "before" | "after",
  sceneValue: string | null,
  context: string | null,
  locale: BeforeAfterAltLocale,
): string {
  const scene = cleanGeneratedScene(sceneValue);
  const sideLabel =
    locale === "es"
      ? side === "before"
        ? "Antes"
        : "Después"
      : side === "before"
        ? "Before"
        : "After";

  if (scene) {
    if (!context || sceneIncludesService(scene, context)) {
      return `${sideLabel}: ${scene}`;
    }
    const connector = locale === "es" ? " de" : "";
    return `${sideLabel}${connector} ${context}: ${scene}`;
  }

  if (context) {
    const connector = locale === "es" ? " de" : "";
    return `${sideLabel}${connector} ${context}`;
  }

  return locale === "es"
    ? `${sideLabel} de la edición visual de la propiedad`
    : `${sideLabel} property visual editing`;
}

/**
 * Resolve accessible, distinct ALT text for a Before/After pair.
 *
 * Non-empty per-image values always win and are returned unchanged. Only a
 * missing side is generated, using shared ALT, the other side's explicit ALT,
 * description/title metadata, and finally service context.
 */
export function getBeforeAfterAlt({
  beforeAlt,
  afterAlt,
  sharedAlt,
  title,
  description,
  serviceLabel,
  serviceSlug,
  locale = "en",
}: BeforeAfterAltInput): BeforeAfterAltResult {
  const explicitBefore = explicitAlt(beforeAlt);
  const explicitAfter = explicitAlt(afterAlt);
  const sharedScene = metadataText(sharedAlt);
  const descriptionScene = metadataText(description);
  const titleScene = metadataText(title);
  const context = serviceContext({ serviceLabel, serviceSlug, locale });

  return {
    beforeAlt:
      explicitBefore ??
      generatedAlt(
        "before",
        sharedScene ?? explicitAfter ?? descriptionScene ?? titleScene,
        context,
        locale,
      ),
    afterAlt:
      explicitAfter ??
      generatedAlt(
        "after",
        sharedScene ?? explicitBefore ?? descriptionScene ?? titleScene,
        context,
        locale,
      ),
  };
}
