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
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  nl: "Nederlands",
  pl: "Polski",
  uk: "Українська",
  ru: "Русский",
};

export type PublicUiLabels = {
  aboutHeading: string;
  askQuestion: string;
  brochure: string;
  checklistHeading: string;
  contactEmail: string;
  contactHeading: string;
  detailsEyebrow: string;
  floorPlans: string;
  floorPlansHeading: string;
  galleryEyebrow: string;
  galleryImageCount: (count: number) => string;
  highlightsEyebrow: string;
  interactiveFloorPlan: string;
  interactiveFloorPlanCta: string;
  language: string;
  location: string;
  mapApproximate: string;
  mapExactCoordinatesHidden: string;
  mapHidden: string;
  mapOpen: string;
  mapTrouble: string;
  presentedBy: string;
  reference: string;
  requestViewing: string;
  roomByRoomFloorPlan: string;
  status: Record<PropertyShowcase["status"], string>;
  whatsapp: string;
};

const EN_UI_LABELS: PublicUiLabels = {
  aboutHeading: "About this property",
  askQuestion: "Ask a question",
  brochure: "Open brochure",
  checklistHeading: "Highlights",
  contactEmail: "Email",
  contactHeading: "Interested in this listing?",
  detailsEyebrow: "Listing details",
  floorPlans: "Floor plans",
  floorPlansHeading: "See how the spaces connect.",
  galleryEyebrow: "Photo gallery",
  galleryImageCount: (count) => `${count} images`,
  highlightsEyebrow: "Highlights",
  interactiveFloorPlan: "Interactive floor plan",
  interactiveFloorPlanCta: "Open interactive floor plan",
  language: "Language",
  location: "Location",
  mapApproximate: "Approximate location",
  mapExactCoordinatesHidden:
    "Exact coordinates are not shown on this public page.",
  mapHidden: "Location is private",
  mapOpen: "Open map",
  mapTrouble: "Having trouble with the map?",
  presentedBy: "Presented by",
  reference: "Reference",
  requestViewing: "Request a viewing",
  roomByRoomFloorPlan: "Room-by-room floor plan",
  status: {
    "for-sale": "For sale",
    reserved: "Reserved",
    sold: "Sold",
    "off-market": "Off market",
  },
  whatsapp: "WhatsApp",
};

const ES_UI_LABELS: PublicUiLabels = {
  aboutHeading: "Sobre esta propiedad",
  askQuestion: "Hacer una pregunta",
  brochure: "Abrir folleto",
  checklistHeading: "Destacados",
  contactEmail: "Correo",
  contactHeading: "¿Le interesa esta propiedad?",
  detailsEyebrow: "Datos de la propiedad",
  floorPlans: "Planos",
  floorPlansHeading: "Vea cómo se conectan los espacios.",
  galleryEyebrow: "Galería de fotos",
  galleryImageCount: (count) => `${count} imágenes`,
  highlightsEyebrow: "Destacados",
  interactiveFloorPlan: "Plano interactivo",
  interactiveFloorPlanCta: "Abrir plano interactivo",
  language: "Idioma",
  location: "Ubicación",
  mapApproximate: "Ubicación aproximada",
  mapExactCoordinatesHidden:
    "Las coordenadas exactas no se muestran en esta página pública.",
  mapHidden: "Ubicación privada",
  mapOpen: "Abrir mapa",
  mapTrouble: "¿Problemas para ver el mapa?",
  presentedBy: "Presentado por",
  reference: "Referencia",
  requestViewing: "Solicitar visita",
  roomByRoomFloorPlan: "Plano habitación por habitación",
  status: {
    "for-sale": "En venta",
    reserved: "Reservado",
    sold: "Vendido",
    "off-market": "Fuera de mercado",
  },
  whatsapp: "WhatsApp",
};

const DE_UI_LABELS: PublicUiLabels = {
  aboutHeading: "Über diese Immobilie",
  askQuestion: "Frage stellen",
  brochure: "Broschüre öffnen",
  checklistHeading: "Highlights",
  contactEmail: "E-Mail",
  contactHeading: "Interessieren Sie sich für dieses Angebot?",
  detailsEyebrow: "Immobiliendetails",
  floorPlans: "Grundrisse",
  floorPlansHeading: "Sehen Sie, wie die Räume verbunden sind.",
  galleryEyebrow: "Fotogalerie",
  galleryImageCount: (count) => `${count} Bilder`,
  highlightsEyebrow: "Highlights",
  interactiveFloorPlan: "Interaktiver Grundriss",
  interactiveFloorPlanCta: "Interaktiven Grundriss öffnen",
  language: "Sprache",
  location: "Lage",
  mapApproximate: "Ungefähre Lage",
  mapExactCoordinatesHidden:
    "Exakte Koordinaten werden auf dieser öffentlichen Seite nicht angezeigt.",
  mapHidden: "Lage ist privat",
  mapOpen: "Karte öffnen",
  mapTrouble: "Probleme mit der Karte?",
  presentedBy: "Präsentiert von",
  reference: "Referenz",
  requestViewing: "Besichtigung anfragen",
  roomByRoomFloorPlan: "Raum-für-Raum-Grundriss",
  status: {
    "for-sale": "Zu verkaufen",
    reserved: "Reserviert",
    sold: "Verkauft",
    "off-market": "Nicht am Markt",
  },
  whatsapp: "WhatsApp",
};

const FR_UI_LABELS: PublicUiLabels = {
  aboutHeading: "À propos de ce bien",
  askQuestion: "Poser une question",
  brochure: "Ouvrir la brochure",
  checklistHeading: "Points forts",
  contactEmail: "E-mail",
  contactHeading: "Ce bien vous intéresse ?",
  detailsEyebrow: "Détails du bien",
  floorPlans: "Plans",
  floorPlansHeading: "Découvrez comment les espaces communiquent.",
  galleryEyebrow: "Galerie photo",
  galleryImageCount: (count) => `${count} images`,
  highlightsEyebrow: "Points forts",
  interactiveFloorPlan: "Plan interactif",
  interactiveFloorPlanCta: "Ouvrir le plan interactif",
  language: "Langue",
  location: "Localisation",
  mapApproximate: "Localisation approximative",
  mapExactCoordinatesHidden:
    "Les coordonnées exactes ne sont pas affichées sur cette page publique.",
  mapHidden: "Localisation privée",
  mapOpen: "Ouvrir la carte",
  mapTrouble: "La carte ne s'affiche pas correctement ?",
  presentedBy: "Présenté par",
  reference: "Référence",
  requestViewing: "Demander une visite",
  roomByRoomFloorPlan: "Plan pièce par pièce",
  status: {
    "for-sale": "À vendre",
    reserved: "Réservé",
    sold: "Vendu",
    "off-market": "Hors marché",
  },
  whatsapp: "WhatsApp",
};

const NL_UI_LABELS: PublicUiLabels = {
  aboutHeading: "Over deze woning",
  askQuestion: "Stel een vraag",
  brochure: "Brochure openen",
  checklistHeading: "Pluspunten",
  contactEmail: "E-mail",
  contactHeading: "Interesse in deze woning?",
  detailsEyebrow: "Woningdetails",
  floorPlans: "Plattegronden",
  floorPlansHeading: "Bekijk hoe de ruimtes met elkaar verbonden zijn.",
  galleryEyebrow: "Fotogalerij",
  galleryImageCount: (count) => `${count} beelden`,
  highlightsEyebrow: "Pluspunten",
  interactiveFloorPlan: "Interactieve plattegrond",
  interactiveFloorPlanCta: "Interactieve plattegrond openen",
  language: "Taal",
  location: "Locatie",
  mapApproximate: "Globale locatie",
  mapExactCoordinatesHidden:
    "Exacte coördinaten worden niet getoond op deze openbare pagina.",
  mapHidden: "Locatie is privé",
  mapOpen: "Kaart openen",
  mapTrouble: "Problemen met de kaart?",
  presentedBy: "Gepresenteerd door",
  reference: "Referentie",
  requestViewing: "Bezichtiging aanvragen",
  roomByRoomFloorPlan: "Plattegrond per kamer",
  status: {
    "for-sale": "Te koop",
    reserved: "Gereserveerd",
    sold: "Verkocht",
    "off-market": "Niet beschikbaar",
  },
  whatsapp: "WhatsApp",
};

const PL_UI_LABELS: PublicUiLabels = {
  aboutHeading: "O tej nieruchomości",
  askQuestion: "Zadaj pytanie",
  brochure: "Otwórz broszurę",
  checklistHeading: "Atuty",
  contactEmail: "E-mail",
  contactHeading: "Interesuje Cię ta oferta?",
  detailsEyebrow: "Szczegóły oferty",
  floorPlans: "Plany pięter",
  floorPlansHeading: "Zobacz, jak łączą się przestrzenie.",
  galleryEyebrow: "Galeria zdjęć",
  galleryImageCount: (count) => `${count} zdjęć`,
  highlightsEyebrow: "Atuty",
  interactiveFloorPlan: "Interaktywny plan",
  interactiveFloorPlanCta: "Otwórz interaktywny plan",
  language: "Język",
  location: "Lokalizacja",
  mapApproximate: "Przybliżona lokalizacja",
  mapExactCoordinatesHidden:
    "Dokładne współrzędne nie są pokazywane na tej publicznej stronie.",
  mapHidden: "Lokalizacja prywatna",
  mapOpen: "Otwórz mapę",
  mapTrouble: "Problem z wyświetleniem mapy?",
  presentedBy: "Prezentuje",
  reference: "Referencja",
  requestViewing: "Poproś o prezentację",
  roomByRoomFloorPlan: "Plan pokój po pokoju",
  status: {
    "for-sale": "Na sprzedaż",
    reserved: "Zarezerwowane",
    sold: "Sprzedane",
    "off-market": "Poza rynkiem",
  },
  whatsapp: "WhatsApp",
};

const UK_UI_LABELS: PublicUiLabels = {
  aboutHeading: "Про цю нерухомість",
  askQuestion: "Поставити запитання",
  brochure: "Відкрити брошуру",
  checklistHeading: "Переваги",
  contactEmail: "Ел. пошта",
  contactHeading: "Цікавить ця пропозиція?",
  detailsEyebrow: "Деталі оголошення",
  floorPlans: "Плани поверхів",
  floorPlansHeading: "Подивіться, як поєднані простори.",
  galleryEyebrow: "Фотогалерея",
  galleryImageCount: (count) => `${count} зображень`,
  highlightsEyebrow: "Переваги",
  interactiveFloorPlan: "Інтерактивний план",
  interactiveFloorPlanCta: "Відкрити інтерактивний план",
  language: "Мова",
  location: "Локація",
  mapApproximate: "Приблизна локація",
  mapExactCoordinatesHidden:
    "Точні координати не показуються на цій публічній сторінці.",
  mapHidden: "Локація прихована",
  mapOpen: "Відкрити карту",
  mapTrouble: "Проблеми з картою?",
  presentedBy: "Представлено",
  reference: "Референс",
  requestViewing: "Запросити перегляд",
  roomByRoomFloorPlan: "План кімната за кімнатою",
  status: {
    "for-sale": "У продажу",
    reserved: "Зарезервовано",
    sold: "Продано",
    "off-market": "Поза ринком",
  },
  whatsapp: "WhatsApp",
};

const RU_UI_LABELS: PublicUiLabels = {
  aboutHeading: "Об этой недвижимости",
  askQuestion: "Задать вопрос",
  brochure: "Открыть брошюру",
  checklistHeading: "Преимущества",
  contactEmail: "Эл. почта",
  contactHeading: "Интересует этот объект?",
  detailsEyebrow: "Детали объекта",
  floorPlans: "Планы этажей",
  floorPlansHeading: "Посмотрите, как связаны пространства.",
  galleryEyebrow: "Фотогалерея",
  galleryImageCount: (count) => `${count} изображений`,
  highlightsEyebrow: "Преимущества",
  interactiveFloorPlan: "Интерактивный план",
  interactiveFloorPlanCta: "Открыть интерактивный план",
  language: "Язык",
  location: "Локация",
  mapApproximate: "Приблизительная локация",
  mapExactCoordinatesHidden:
    "Точные координаты не показываются на этой публичной странице.",
  mapHidden: "Локация скрыта",
  mapOpen: "Открыть карту",
  mapTrouble: "Проблемы с картой?",
  presentedBy: "Представлено",
  reference: "Референс",
  requestViewing: "Запросить просмотр",
  roomByRoomFloorPlan: "План по комнатам",
  status: {
    "for-sale": "В продаже",
    reserved: "Зарезервировано",
    sold: "Продано",
    "off-market": "Вне рынка",
  },
  whatsapp: "WhatsApp",
};

export const PUBLIC_UI_LABELS: Record<
  PropertyLanguageCode,
  PublicUiLabels
> = {
  en: EN_UI_LABELS,
  es: ES_UI_LABELS,
  de: DE_UI_LABELS,
  fr: FR_UI_LABELS,
  nl: NL_UI_LABELS,
  pl: PL_UI_LABELS,
  uk: UK_UI_LABELS,
  ru: RU_UI_LABELS,
};

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

  if (property.primaryLanguage) {
    const modernLanguages = uniqueLanguages([
      primaryLanguage,
      ...property.languages,
      ...translationLanguages,
    ]);
    return modernLanguages.length > 0 ? modernLanguages : [primaryLanguage];
  }

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
  ]).filter((language) => language === "en" || language === "es");

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
