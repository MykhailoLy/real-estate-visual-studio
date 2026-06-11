"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  getOrderServiceSlug,
  trackContactIntentClick,
  trackLoginClick,
  trackOrderIntentClick,
  trackPricingCtaClick,
  trackSignUpClick,
} from "@/lib/analytics";

type TrackedLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  analyticsLabel: string;
  analyticsLocation: string;
  analyticsIntentType?: string;
  analyticsEvent?: "sign_up" | "login" | "order_intent" | "pricing_cta" | "contact_intent";
  serviceSlug?: string;
};

export default function TrackedLink({
  href,
  children,
  className,
  analyticsLabel,
  analyticsLocation,
  analyticsIntentType,
  analyticsEvent,
  serviceSlug,
}: TrackedLinkProps) {
  const trackClick = () => {
    const eventType =
      analyticsEvent ??
      (analyticsIntentType === "order"
        ? "order_intent"
        : analyticsIntentType === "contact"
          ? "contact_intent"
          : href.startsWith("/signup")
            ? "sign_up"
            : href.startsWith("/login")
              ? "login"
              : href.startsWith("/order")
                ? "order_intent"
                : href.startsWith("/contact")
                  ? "contact_intent"
                  : null);
    const resolvedServiceSlug = serviceSlug ?? getOrderServiceSlug(href);

    if (eventType === "sign_up") {
      trackSignUpClick(analyticsLocation);
      return;
    }
    if (eventType === "login") {
      trackLoginClick(analyticsLocation);
      return;
    }
    if (eventType === "order_intent") {
      trackOrderIntentClick({
        location: analyticsLocation,
        href,
        serviceSlug: resolvedServiceSlug,
      });
      return;
    }
    if (eventType === "pricing_cta") {
      trackPricingCtaClick({
        location: analyticsLocation,
        serviceSlug: resolvedServiceSlug,
      });
      return;
    }
    if (eventType === "contact_intent") {
      trackContactIntentClick(analyticsLocation);
    }
  };

  return (
    <Link
      href={href}
      className={className}
      onClick={trackClick}
      aria-label={analyticsLabel}
    >
      {children}
    </Link>
  );
}
