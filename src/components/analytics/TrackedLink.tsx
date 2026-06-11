"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackButtonClick, trackLeadIntent } from "@/lib/analytics";

type TrackedLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  analyticsLabel: string;
  analyticsLocation: string;
  analyticsIntentType?: string;
};

export default function TrackedLink({
  href,
  children,
  className,
  analyticsLabel,
  analyticsLocation,
  analyticsIntentType,
}: TrackedLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackButtonClick(analyticsLabel, analyticsLocation);
        if (analyticsIntentType) {
          trackLeadIntent(analyticsIntentType, analyticsLocation);
        }
      }}
    >
      {children}
    </Link>
  );
}
