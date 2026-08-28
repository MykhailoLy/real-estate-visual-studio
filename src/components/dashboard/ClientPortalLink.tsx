import Link from "next/link";
import type { ComponentProps } from "react";

type ClientPortalLinkProps = Omit<ComponentProps<typeof Link>, "prefetch">;

/** Client-portal navigation without automatic authenticated-route fan-out. */
export default function ClientPortalLink(props: ClientPortalLinkProps) {
  return <Link {...props} prefetch={false} />;
}
