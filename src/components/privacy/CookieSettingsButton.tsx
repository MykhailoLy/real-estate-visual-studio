"use client";

import { openCookieSettings } from "@/lib/cookie-consent";

export default function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="text-sm text-white/60 transition-colors hover:text-white"
    >
      Cookie settings
    </button>
  );
}
