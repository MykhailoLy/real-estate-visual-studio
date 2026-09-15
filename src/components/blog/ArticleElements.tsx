import type { ReactNode } from "react";
import Link from "next/link";

export const sectionHeadingClass =
  "scroll-mt-24 pt-5 text-3xl font-bold leading-tight tracking-tight text-primary lg:text-4xl";
export const subsectionHeadingClass =
  "scroll-mt-24 pt-3 text-2xl font-bold leading-tight text-primary";
export const listClass = "ml-6 list-disc space-y-2 marker:text-secondary-dark";
export const articleLinkClass =
  "rounded-sm font-semibold text-primary underline decoration-secondary underline-offset-4 hover:text-primary-light focus-visible:ring-2 focus-visible:ring-primary";

export function ExternalArticleLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={articleLinkClass}
    >
      {children}
    </a>
  );
}

export function InternalArticleLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={articleLinkClass}>
      {children}
    </Link>
  );
}

export function ResponsiveTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="max-w-full overflow-x-auto rounded-xl border border-border"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm leading-6 lg:text-base">
        {children}
      </table>
    </div>
  );
}
