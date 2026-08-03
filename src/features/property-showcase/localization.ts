import type {
  LocalizedText,
  PropertyHighlight,
  PropertyLanguageCode,
  PropertyShowcase,
} from "./types";

export const SUPPORTED_PROPERTY_LANGUAGES: readonly PropertyLanguageCode[] = [
  "en",
  "es",
  "de",
  "fr",
  "nl",
  "pl",
  "uk",
  "ru",
];

export const PROPERTY_LANGUAGE_LABELS: Record<PropertyLanguageCode, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
  fr: "French",
  nl: "Dutch",
  pl: "Polish",
  uk: "Ukrainian",
  ru: "Russian",
};

type PublicUiLabels = {
  aboutHeading: string;
  brochure: string;
  checklistHeading: string;
  contactHeading: string;
  detailsEyebrow: string;
  floorPlans: string;
  galleryEyebrow: string;
  highlightsEyebrow: string;
  language: string;
  location: string;
  mapApproximate: string;
  mapHidden: string;
  mapOpen: string;
  mapTrouble: string;
  presentedBy: string;
  reference: string;
  requestViewing: string;
  status: Record<PropertyShowcase["status"], string>;
};

const EN_UI_LABELS: PublicUiLabels = {
  aboutHeading: "About this property",
  brochure: "Open brochure",
  checklistHeading: "Highlights",
  contactHeading: "Interested in this listing?",
  detailsEyebrow: "Listing details",
  floorPlans: "Floor plans",
  galleryEyebrow: "Photo gallery",
  highlightsEyebrow: "Highlights",
  language: "Language",
  location: "Location",
  mapApproximate: "Approximate location",
  mapHidden: "Location is private",
  mapOpen: "Open map",
  mapTrouble: "Having trouble with the map?",
  presentedBy: "Presented by",
  reference: "Reference",
  requestViewing: "Request a viewing",
  status: {
    "for-sale": "For sale",
    reserved: "Reserved",
    sold: "Sold",
    "off-market": "Off market",
  },
};

const ES_UI_LABELS: PublicUiLabels = {
  aboutHeading: "Sobre esta propiedad",
  brochure: "Abrir folleto",
  checklistHeading: "Destacados",
  contactHeading: "Le interesa esta propiedad?",
  detailsEyebrow: "Datos de la propiedad",
  floorPlans: "Planos",
  galleryEyebrow: "Galeria de fotos",
  highlightsEyebrow: "Destacados",
  language: "Idioma",
  location: "Ubicacion",
  mapApproximate: "Ubicacion aproximada",
  mapHidden: "Ubicacion privada",
  mapOpen: "Abrir mapa",
  mapTrouble: "Problemas para ver el mapa?",
  presentedBy: "Presentado por",
  reference: "Referencia",
  requestViewing: "Solicitar visita",
  status: {
    "for-sale": "En venta",
    reserved: "Reservado",
    sold: "Vendido",
    "off-market": "Fuera de mercado",
  },
};

export const PUBLIC_UI_LABELS: Record<
  PropertyLanguageCode,
  PublicUiLabels
> = {
  en: EN_UI_LABELS,
  es: ES_UI_LABELS,
  de: fallbackUi("Deutsch"),
  fr: fallbackUi("Francais"),
  nl: fallbackUi("Nederlands"),
  pl: fallbackUi("Polski"),
  uk: fallbackUi("Ukrainian"),
  ru: fallbackUi("Russian"),
};

function fallbackUi(languageName: string): PublicUiLabels {
  return {
    ...EN_UI_LABELS,
    language: languageName,
  };
}

function isSupportedLanguage(value: string | undefined): value is PropertyLanguageCode {
  return (SUPPORTED_PROPERTY_LANGUAGES as readonly string[]).includes(value ?? "");
}

function uniqueLanguages(
  languages: readonly (PropertyLanguageCode | undefined)[],
): PropertyLanguageCode[] {
  return languages.filter(
    (language, index, items): language is PropertyLanguageCode =>
      Boolean(language) &&
      isSupportedLanguage(language) &&
      items.indexOf(language) === index,
  );
}

function localizedKeys(value: LocalizedText | undefined): PropertyLanguageCode[] {
  if (!value) return [];
  return Object.entries(value)
    .filter(([, text]) => Boolean(text?.trim()))
    .map(([language]) => language)
    .filter(isSupportedLanguage);
}

export function getPrimaryLanguage(
  property: PropertyShowcase,
): PropertyLanguageCode {
  if (isSupportedLanguage(property.primaryLanguage)) {
    return property.primaryLanguage;
  }
  return property.languages.find(isSupportedLanguage) ?? "en";
}

export function localizedText(
  value: LocalizedText | undefined,
  language: PropertyLanguageCode,
  primaryLanguage: PropertyLanguageCode = "en",
): string {
  if (!value) return "";
  return (
    value[language]?.trim() ??
    value[primaryLanguage]?.trim() ??
    value.en?.trim() ??
    Object.values(value).find((item) => Boolean(item?.trim()))?.trim() ??
    ""
  );
}

function directLocalizedText(
  value: LocalizedText | undefined,
  language: PropertyLanguageCode,
): string {
  return value?.[language]?.trim() ?? "";
}

export function getPropertyLanguageOptions(
  property: PropertyShowcase,
): PropertyLanguageCode[] {
  const primaryLanguage = getPrimaryLanguage(property);
  const translationLanguages = property.translations
    ? (Object.keys(property.translations) as PropertyLanguageCode[])
    : [];
  const highlightLanguages = property.highlights.flatMap((highlight) =>
    localizedKeys(highlight.text ?? highlight.title ?? highlight.description),
  );
  const languages = uniqueLanguages([
    primaryLanguage,
    ...property.languages,
    ...translationLanguages,
    ...localizedKeys(property.title),
    ...localizedKeys(property.summary),
    ...property.description.flatMap(localizedKeys),
    ...highlightLanguages,
  ]);

  return languages.length > 0 ? languages : ["en"];
}

export function highlightChecklistText(
  highlight: PropertyHighlight,
  language: PropertyLanguageCode,
  primaryLanguage: PropertyLanguageCode,
): string {
  return localizedText(
    highlight.text ?? highlight.title ?? highlight.description,
    language,
    primaryLanguage,
  );
}

export function translationCompletion(
  property: PropertyShowcase,
  language: PropertyLanguageCode,
): number {
  const checks = [
    directLocalizedText(property.title, language),
    directLocalizedText(property.summary, language),
    ...property.description.map((paragraph) =>
      directLocalizedText(paragraph, language),
    ),
    ...property.highlights.map((highlight) =>
      directLocalizedText(
        highlight.text ?? highlight.title ?? highlight.description,
        language,
      ),
    ),
  ];
  if (checks.length === 0) return 0;
  return Math.round(
    (checks.filter((item) => item.length > 0).length / checks.length) * 100,
  );
}
