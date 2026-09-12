"use client";

import { useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { CLIENT_ORDER_REVIEW_COMMENT_MAX } from "@/lib/client-order-review";

interface DisplayReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface ReviewApiResponse {
  error?: string;
  review?: DisplayReview;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const value = index + 1;
        return (
          <Star
            key={value}
            className={[
              "h-6 w-6",
              value <= rating
                ? "fill-secondary text-secondary"
                : "fill-transparent text-border-strong",
            ].join(" ")}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

export default function ClientOrderReviewCard({
  orderId,
  initialReview,
}: {
  orderId: string;
  initialReview: DisplayReview | null;
}) {
  const [review, setReview] = useState(initialReview);
  const [rating, setRating] = useState<number | null>(null);
  const [previewRating, setPreviewRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayedRating = previewRating ?? rating;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/client/orders/${orderId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const payload = (await response.json().catch(() => ({}))) as ReviewApiResponse;
      if (!response.ok || !payload.review) {
        setError(payload.error ?? "Could not submit your review. Please try again.");
        return;
      }
      setReview(payload.review);
    } catch {
      setError("Could not submit your review. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      data-order-review-card
      aria-labelledby="order-review-heading"
      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <div className="border-b border-border px-4 py-2.5 sm:px-5">
        <h2
          id="order-review-heading"
          className="text-dashboard-section font-bold text-primary lg:text-lg"
        >
          {review ? "Your review" : "How was your order?"}
        </h2>
      </div>

      {review ? (
        <div data-review-saved className="space-y-3 p-4 sm:p-5">
          <Stars rating={review.rating} />
          {review.comment ? (
            <p className="whitespace-pre-wrap break-words text-dashboard-body text-foreground">
              {review.comment}
            </p>
          ) : null}
          <p className="text-dashboard-metadata font-semibold text-muted">
            Review submitted
          </p>
        </div>
      ) : (
        <form
          data-review-form
          className="space-y-2 px-4 py-2.5"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-end">
            <fieldset>
              <legend
                id="order-rating-label"
                className="text-dashboard-metadata font-bold text-foreground"
              >
                Rate your experience
              </legend>
              <div
                className="mt-1 flex flex-wrap gap-1"
                role="group"
                aria-labelledby="order-rating-label"
                onMouseLeave={() => setPreviewRating(null)}
              >
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  const selected =
                    displayedRating !== null && value <= displayedRating;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={rating === value}
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition-colors hover:bg-secondary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      onMouseEnter={() => setPreviewRating(value)}
                      onFocus={() => setPreviewRating(value)}
                      onBlur={() => setPreviewRating(null)}
                      onClick={() => {
                        setRating(value);
                        setPreviewRating(null);
                        setError(null);
                      }}
                    >
                      <Star
                        className={[
                          "h-7 w-7",
                          selected
                            ? "fill-secondary text-secondary"
                            : "fill-transparent text-border-strong",
                        ].join(" ")}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="order-review-comment"
                className="text-dashboard-metadata font-bold text-foreground"
              >
                Share any additional feedback (optional)
              </label>
              <textarea
                id="order-review-comment"
                value={comment}
                maxLength={CLIENT_ORDER_REVIEW_COMMENT_MAX}
                rows={2}
                className="mt-1.5 block min-h-18 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-dashboard-body text-foreground outline-none transition-colors placeholder:text-muted-light focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Your feedback"
                onChange={(event) => setComment(event.target.value)}
              />
            </div>
          </div>

          {error ? (
            <p
              className="text-dashboard-metadata font-semibold text-primary"
              aria-live="polite"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-secondary px-5 py-2.5 text-dashboard-action font-bold uppercase tracking-[0.04em] text-white shadow-sm transition-colors hover:bg-secondary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Submit review"}
          </button>
        </form>
      )}
    </section>
  );
}
