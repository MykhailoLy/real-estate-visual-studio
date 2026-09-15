import Image from "next/image";

type ArticleImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type ArticleBeforeAfterProps = {
  label: string;
  before: ArticleImage;
  after: ArticleImage;
  caption: string;
  annotateRealism?: boolean;
};

const realismDetails = [
  {
    title: "Perspective",
    description: "Follow the sofa and TV furniture alongside the room’s floor lines.",
    left: "39%",
    top: "65%",
  },
  {
    title: "Scale",
    description: "Compare the sofa, armchair and coffee table with the available room space.",
    left: "34%",
    top: "84%",
  },
  {
    title: "Contact shadows",
    description: "Look beneath the coffee table where its base meets the rug.",
    left: "55%",
    top: "82%",
  },
  {
    title: "Architecture preserved",
    description: "Compare the window frame and surrounding walls with the original photograph.",
    left: "60%",
    top: "28%",
  },
] as const;

const imageLabelClass =
  "absolute bottom-3 left-3 rounded-md border border-secondary/60 bg-primary/95 px-3 py-1.5 text-xs font-bold tracking-[0.12em] text-white";

export default function ArticleBeforeAfter({
  label,
  before,
  after,
  caption,
  annotateRealism = false,
}: ArticleBeforeAfterProps) {
  return (
    <figure aria-label={label} className="rounded-2xl border border-border bg-white p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl border border-border bg-dashboard-canvas">
          <Image
            src={before.src}
            alt={before.alt}
            width={before.width}
            height={before.height}
            sizes="(max-width: 767px) calc(100vw - 2rem), 432px"
            className="h-auto w-full"
          />
          <span className={imageLabelClass}>BEFORE</span>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border bg-dashboard-canvas">
          <Image
            src={after.src}
            alt={after.alt}
            width={after.width}
            height={after.height}
            sizes="(max-width: 767px) calc(100vw - 2rem), 432px"
            className="h-auto w-full"
          />
          <span className={imageLabelClass}>AFTER</span>
          {annotateRealism && (
            <div aria-hidden="true" data-realism-markers className="pointer-events-none absolute inset-0 hidden md:block">
              {realismDetails.map((detail, index) => (
                <span
                  key={detail.title}
                  style={{ left: detail.left, top: detail.top }}
                  className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-secondary bg-primary/90 text-xs font-semibold text-white shadow-sm"
                >
                  {index + 1}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {annotateRealism && (
        <aside aria-label="Realism details" className="mt-4 rounded-xl bg-ivory p-3 sm:p-4">
          <ol className="grid gap-3 text-sm leading-6 sm:grid-cols-2">
            {realismDetails.map((detail, index) => (
              <li key={detail.title} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-secondary bg-white text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <strong className="font-semibold text-primary">{detail.title}</strong>
                  <p className="text-muted">{detail.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      )}
      <figcaption className="mt-3 border-t border-border px-1 pt-3 text-sm leading-6 text-muted sm:px-1">
        {caption}
      </figcaption>
    </figure>
  );
}
