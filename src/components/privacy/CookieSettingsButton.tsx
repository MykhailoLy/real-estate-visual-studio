"use client";

import { openCookieSettings } from "@/lib/cookie-consent";

export default function CookieSettingsButton({
  label = "Cookie settings",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="text-sm text-white/60 transition-colors hover:text-white"
    >
      {label}
    </button>
  );
}
