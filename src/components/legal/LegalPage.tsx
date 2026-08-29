import Link from "next/link";
import Container from "@/components/layout/Container";
import { LEGAL_VERSION } from "@/lib/legal";

export type LegalSection = {
  id: string;
  title: string;
  body: React.ReactNode;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updatedLabel: string;
  updatedValue: string;
  versionLabel: string;
  contentsLabel: string;
  sections: readonly LegalSection[];
  contact: {
    prompt: string;
    href: string;
    label: string;
  };
};

export default function LegalPage({
  eyebrow,
  title,
  intro,
  updatedLabel,
  updatedValue,
  versionLabel,
  contentsLabel,
  sections,
  contact,
}: LegalPageProps) {
  return (
    <section className="bg-white py-14 sm:py-16 lg:py-24">
      <Container>
        <header className="max-w-4xl border-b border-line pb-10 lg:pb-14">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-secondary-dark">
            {eyebrow}
          </p>
          <h1 className="max-w-3xl text-3xl font-bold leading-[1.08] tracking-tight text-primary sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted lg:text-lg lg:leading-8">
            {intro}
          </p>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted sm:text-sm">
            <div className="flex gap-2">
              <dt className="font-semibold text-foreground">{updatedLabel}</dt>
              <dd>{updatedValue}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-foreground">{versionLabel}</dt>
              <dd>{LEGAL_VERSION}</dd>
            </div>
          </dl>
        </header>

        <div className="mt-10 grid min-w-0 gap-10 lg:mt-14 lg:grid-cols-[14rem_minmax(0,48rem)] lg:gap-16 xl:grid-cols-[16rem_minmax(0,52rem)] xl:gap-20">
          <nav
            aria-label={contentsLabel}
            className="border-y border-line py-5 lg:sticky lg:top-24 lg:h-fit lg:border-y-0 lg:border-l lg:py-0 lg:pl-5"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {contentsLabel}
            </p>
            <ol className="grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm leading-5 text-foreground transition-colors hover:text-secondary-dark focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="min-w-0">
            <div className="space-y-11 lg:space-y-14">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 border-b border-line pb-11 last:border-b-0 last:pb-0 lg:pb-14"
                >
                  <h2 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">
                    {section.title}
                  </h2>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-muted sm:text-base [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:decoration-line [&_a]:underline-offset-4 hover:[&_a]:text-primary-light [&_h3]:pt-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-foreground [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-14 border-t border-primary/20 pt-8 lg:mt-16">
              <p className="text-sm leading-6 text-muted">{contact.prompt}</p>
              <Link
                href={contact.href}
                className="mt-4 inline-flex min-h-11 items-center justify-center border border-primary px-5 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {contact.label}
              </Link>
            </div>
          </article>
        </div>
      </Container>
    </section>
  );
}
