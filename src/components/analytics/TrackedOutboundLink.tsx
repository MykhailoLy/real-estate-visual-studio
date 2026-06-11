"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  trackEmailClick,
  trackPhoneClick,
  trackSocialClick,
} from "@/lib/analytics";

type TrackedOutboundLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  analyticsLocation: string;
  platform?: string;
};

export default function TrackedOutboundLink({
  children,
  analyticsLocation,
  platform,
  href,
  onClick,
  ...props
}: TrackedOutboundLinkProps) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        if (href?.startsWith("mailto:")) {
          trackEmailClick(analyticsLocation);
        } else if (href?.startsWith("tel:")) {
          trackPhoneClick(analyticsLocation);
        } else if (platform) {
          trackSocialClick({ location: analyticsLocation, platform });
        }
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
