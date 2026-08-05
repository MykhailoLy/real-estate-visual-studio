import type { PropertyLanguageCode } from "./types.ts";

export interface PropertyMediaLabels {
  video: string;
  videoCta: string;
  openVideo: string;
  virtualTour: string;
  virtualTourCta: string;
  fullscreen: string;
  openOriginalTour: string;
  openOriginalInteractivePlan: string;
  openInteractivePlanNewTab: string;
  interactivePlanTrouble: string;
}

export const PROPERTY_MEDIA_LABELS: Record<
  PropertyLanguageCode,
  PropertyMediaLabels
> = {
  en: {
    video: "Video",
    videoCta: "View video",
    openVideo: "Open video in new tab",
    virtualTour: "360 tour",
    virtualTourCta: "View 360 tour",
    fullscreen: "Fullscreen",
    openOriginalTour: "Open original tour",
    openOriginalInteractivePlan: "Open original interactive plan",
    openInteractivePlanNewTab: "Open interactive plan in new tab",
    interactivePlanTrouble: "Having trouble viewing the plan?",
  },
  es: {
    video: "Video",
    videoCta: "Ver video",
    openVideo: "Abrir video en una pestaña nueva",
    virtualTour: "Tour 360",
    virtualTourCta: "Ver tour 360",
    fullscreen: "Pantalla completa",
    openOriginalTour: "Abrir tour original",
    openOriginalInteractivePlan: "Abrir plano interactivo original",
    openInteractivePlanNewTab: "Abrir plano interactivo en una pestaña nueva",
    interactivePlanTrouble: "¿Problemas para ver el plano?",
  },
  de: {
    video: "Video",
    videoCta: "Video ansehen",
    openVideo: "Video in neuem Tab öffnen",
    virtualTour: "360°-Tour",
    virtualTourCta: "360°-Tour ansehen",
    fullscreen: "Vollbild",
    openOriginalTour: "Originaltour öffnen",
    openOriginalInteractivePlan: "Originalen interaktiven Plan öffnen",
    openInteractivePlanNewTab: "Interaktiven Plan in neuem Tab öffnen",
    interactivePlanTrouble: "Probleme beim Anzeigen des Plans?",
  },
  fr: {
    video: "Vidéo",
    videoCta: "Voir la vidéo",
    openVideo: "Ouvrir la vidéo dans un nouvel onglet",
    virtualTour: "Visite 360°",
    virtualTourCta: "Voir la visite 360°",
    fullscreen: "Plein écran",
    openOriginalTour: "Ouvrir la visite originale",
    openOriginalInteractivePlan: "Ouvrir le plan interactif original",
    openInteractivePlanNewTab: "Ouvrir le plan interactif dans un nouvel onglet",
    interactivePlanTrouble: "Difficultés à afficher le plan ?",
  },
  nl: {
    video: "Video",
    videoCta: "Video bekijken",
    openVideo: "Video in nieuw tabblad openen",
    virtualTour: "360°-tour",
    virtualTourCta: "Bekijk 360°-tour",
    fullscreen: "Volledig scherm",
    openOriginalTour: "Originele tour openen",
    openOriginalInteractivePlan: "Originele interactieve plattegrond openen",
    openInteractivePlanNewTab: "Interactieve plattegrond in nieuw tabblad openen",
    interactivePlanTrouble: "Problemen met de plattegrond?",
  },
  pl: {
    video: "Wideo",
    videoCta: "Obejrzyj wideo",
    openVideo: "Otwórz wideo w nowej karcie",
    virtualTour: "Spacer 360°",
    virtualTourCta: "Zobacz spacer 360°",
    fullscreen: "Pełny ekran",
    openOriginalTour: "Otwórz oryginalny spacer",
    openOriginalInteractivePlan: "Otwórz oryginalny plan interaktywny",
    openInteractivePlanNewTab: "Otwórz plan interaktywny w nowej karcie",
    interactivePlanTrouble: "Problemy z wyświetleniem planu?",
  },
  uk: {
    video: "Відео",
    videoCta: "Переглянути відео",
    openVideo: "Відкрити відео у новій вкладці",
    virtualTour: "360° тур",
    virtualTourCta: "Переглянути 360° тур",
    fullscreen: "На весь екран",
    openOriginalTour: "Відкрити оригінальний тур",
    openOriginalInteractivePlan: "Відкрити оригінальний інтерактивний план",
    openInteractivePlanNewTab: "Відкрити інтерактивний план у новій вкладці",
    interactivePlanTrouble: "Не вдається переглянути план?",
  },
  ru: {
    video: "Видео",
    videoCta: "Посмотреть видео",
    openVideo: "Открыть видео в новой вкладке",
    virtualTour: "360° тур",
    virtualTourCta: "Посмотреть 360° тур",
    fullscreen: "На весь экран",
    openOriginalTour: "Открыть оригинальный тур",
    openOriginalInteractivePlan: "Открыть оригинальный интерактивный план",
    openInteractivePlanNewTab: "Открыть интерактивный план в новой вкладке",
    interactivePlanTrouble: "Не удается просмотреть план?",
  },
};
