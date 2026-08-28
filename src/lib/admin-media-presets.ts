import {
  STAGING_ADDONS,
  STAGING_STYLE_CARDS,
  RENOVATION_EXTERNAL_OPTIONS,
  RENOVATION_INTERNAL_OPTIONS,
  VIRTUAL_RENOVATION_GUIDE_ITEMS,
  VIRTUAL_STAGING_MEDIA_KEYS,
} from "../data/order-options.ts";
import { DUSK_STYLES } from "./day-to-dusk.ts";
import {
  AERIAL_EDITING_OPTIONS,
  SINGLE_EXPOSURE_ORDER_MEDIA_KEYS,
} from "./image-enhancement.ts";

export interface ServiceOptionMediaPreset {
  label: string;
  mediaKey: string;
}

export interface ServiceOptionMediaPresetGroup {
  label: string;
  presets: ServiceOptionMediaPreset[];
}

const VIRTUAL_STAGING_DAY_TO_DUSK_ADDON_ID = "day-to-dusk";

export const VIRTUAL_STAGING_ADDON_MEDIA_PRESETS: ServiceOptionMediaPreset[] =
  STAGING_ADDONS.map((addon) => ({
    label:
      addon.id === VIRTUAL_STAGING_DAY_TO_DUSK_ADDON_ID
        ? "Virtual Staging — Day to Dusk Add-on"
        : addon.label,
    mediaKey: addon.mediaKey,
  }));

/** Standalone Day-to-Dusk presets, derived from the selector source of truth. */
export const DAY_TO_DUSK_SKY_STYLE_MEDIA_PRESETS: ServiceOptionMediaPreset[] =
  DUSK_STYLES.map((style) => ({
    label: style.label,
    mediaKey: style.mediaKey,
  }));

export const VIRTUAL_RENOVATION_GUIDE_MEDIA_PRESETS: ServiceOptionMediaPreset[] =
  VIRTUAL_RENOVATION_GUIDE_ITEMS.map((item) => ({
    label: `Virtual Renovation Guide — ${
      item.group === "external" ? "External" : "Internal"
    } ${item.title}`,
    mediaKey: item.mediaKey,
  }));

export const VIRTUAL_RENOVATION_OPTION_MEDIA_PRESETS: ServiceOptionMediaPreset[] =
  [
    ...RENOVATION_INTERNAL_OPTIONS.map((option) => ({
      label: `Virtual Renovation — ${option.label}`,
      mediaKey: option.mediaKey,
    })),
    ...RENOVATION_EXTERNAL_OPTIONS.map((option) => ({
      label: `Virtual Renovation — ${
        option.id.startsWith("ext-") ? "Exterior " : ""
      }${option.label}`,
      mediaKey: option.mediaKey,
    })),
  ];

export const SERVICE_OPTION_MEDIA_PRESET_GROUPS: ServiceOptionMediaPresetGroup[] =
  [
    {
      label: "Furniture styles",
      presets: STAGING_STYLE_CARDS.map((style) => ({
        label: style.label,
        mediaKey: style.mediaKey,
      })),
    },
    {
      label: "Optional add-ons",
      presets: VIRTUAL_STAGING_ADDON_MEDIA_PRESETS,
    },
    {
      label: "Day to Dusk — Sky Styles",
      presets: DAY_TO_DUSK_SKY_STYLE_MEDIA_PRESETS,
    },
    {
      label: "Image Enhancement — Aerial Editing",
      presets: AERIAL_EDITING_OPTIONS.flatMap((option) =>
        option.mediaKey
          ? [{ label: option.label, mediaKey: option.mediaKey }]
          : [],
      ),
    },
    {
      label: "Virtual Renovation — Guide",
      presets: VIRTUAL_RENOVATION_GUIDE_MEDIA_PRESETS,
    },
    {
      label: "Virtual Renovation — Options",
      presets: VIRTUAL_RENOVATION_OPTION_MEDIA_PRESETS,
    },
  ];

export const ORDER_OPTION_MEDIA_PRESET_KEYS = [
  ...new Set(
    [
      ...VIRTUAL_STAGING_MEDIA_KEYS,
      ...SINGLE_EXPOSURE_ORDER_MEDIA_KEYS,
      ...SERVICE_OPTION_MEDIA_PRESET_GROUPS.flatMap((group) =>
        group.presets.map((preset) => preset.mediaKey),
      ),
    ],
  ),
];

export interface ServiceOptionMediaPresetDefaults {
  mediaType: "image";
  serviceSlug: string;
  title: string;
}

/** Values applied to the existing admin media fields when a preset is chosen. */
export function getServiceOptionMediaPresetDefaults(
  mediaKey: string,
): ServiceOptionMediaPresetDefaults | null {
  for (const group of SERVICE_OPTION_MEDIA_PRESET_GROUPS) {
    const preset = group.presets.find((candidate) => candidate.mediaKey === mediaKey);
    if (preset) {
      return {
        mediaType: "image",
        serviceSlug: preset.mediaKey,
        title: preset.label,
      };
    }
  }
  return null;
}
