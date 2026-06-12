"use client";

// ============================================================
// FilteredGalleryResults — client-side gallery filtering + layout
//
// Renders the service gallery header (eyebrow + H1 + intro on the
// left, optional FILTER select on the right) and the list of
// Before/After example rows below it (one example per row).
//
// Filtering is entirely client-side over the published items the
// server already fetched — no Supabase calls in the browser, no
// pagination. The incoming `items` array is pre-sorted by the
// server (featured_home, then sort_order, then created_at); that
// order is preserved.
//
// Filter UI rules:
//   - An "All" / "Todos" option is always present.
//   - Only filter options represented by at least one published
//     item are shown.
//   - Items with gallery_filter = null appear under "All" only.
//   - The select is only rendered when at least two distinct
//     populated filter categories exist; otherwise the examples
//     render without a redundant control.
//
// The selected value is mirrored to ?filter=<value> via
// history.replaceState (no reload, no server round-trip), and the
// initial value is read back from the URL on mount so shared /
// bookmarked links work. Canonical URLs are unaffected because
// metadata is defined statically on the server.
// ============================================================

import { useEffect, useId, useMemo, useState } from "react";
import GalleryBeforeAfterPair from "@/components/gallery/GalleryBeforeAfterPair";
import { trackGalleryFilterChange } from "@/lib/analytics";

export interface GalleryResultItem {
  id: string;
  beforeUrl: string;
  afterUrl: string;
  beforeAlt: string;
  afterAlt: string;
  galleryFilter: string | null;
}

export interface GalleryFilterOptionView {
  value: string;
  label: string;
}

interface FilteredGalleryResultsProps {
  serviceSlug: string;
  language: "en" | "es";
  /** Pre-sorted published items; both images guaranteed present. */
  items: GalleryResultItem[];
  // Header copy
  eyebrow: string;
  title: string;
  intro: string;
  // Pair label bars
  beforeLabel: string;
  afterLabel: string;
  // Filter config (localized full set for the service; may be empty)
  filterOptions: GalleryFilterOptionView[];
  allLabel: string;
  filterLabel: string;
}

const ALL_VALUE = "all";

export default function FilteredGalleryResults({
  serviceSlug,
  language,
  items,
  eyebrow,
  title,
  intro,
  beforeLabel,
  afterLabel,
  filterOptions,
  allLabel,
  filterLabel,
}: FilteredGalleryResultsProps) {
  const selectId = useId();

  // Which configured options actually have at least one published
  // item — preserving the configured order.
  const availableOptions = useMemo(() => {
    const populated = new Set(
      items
        .map((it) => it.galleryFilter)
        .filter((v): v is string => Boolean(v)),
    );
    return filterOptions.filter((opt) => populated.has(opt.value));
  }, [items, filterOptions]);

  // Only show the filter UI when ≥2 distinct populated categories.
  const showFilter = availableOptions.length >= 2;

  const [selected, setSelected] = useState<string>(ALL_VALUE);

  // On mount, hydrate the selection from ?filter= if it points at a
  // currently-populated option. Keeps the page static while still
  // honouring shared/bookmarked filter links. This is a legitimate
  // "read from external store (URL) after mount" case.
  useEffect(() => {
    if (!showFilter) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("filter");
    if (fromUrl && availableOptions.some((o) => o.value === fromUrl)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(fromUrl);
    }
    // Run once on mount; availableOptions is stable for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFilter]);

  function handleChange(value: string) {
    setSelected(value);

    // Mirror to the URL without a reload or server round-trip.
    try {
      const params = new URLSearchParams(window.location.search);
      if (value === ALL_VALUE) {
        params.delete("filter");
      } else {
        params.set("filter", value);
      }
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
    } catch {
      // Non-fatal — filtering still works without URL sync.
    }

    trackGalleryFilterChange({ serviceSlug, filterValue: value, language });
  }

  const visibleItems = useMemo(() => {
    if (!showFilter || selected === ALL_VALUE) return items;
    return items.filter((it) => it.galleryFilter === selected);
  }, [items, selected, showFilter]);

  return (
    <>
      {/* ── Header: title/intro left, filter right ──────────── */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-10 mb-8 lg:mb-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
            {eyebrow}
          </p>
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-4">
            {title}
          </h1>
          <p className="text-base lg:text-lg text-muted leading-relaxed">
            {intro}
          </p>
        </div>

        {showFilter && (
          <div className="lg:flex-shrink-0 w-full lg:w-auto">
            <label
              htmlFor={selectId}
              className="block text-[11px] font-bold tracking-[0.18em] uppercase text-muted mb-2"
            >
              {filterLabel}
            </label>
            <select
              id={selectId}
              value={selected}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full lg:w-64 min-h-11 px-3.5 py-2.5 rounded-lg border border-border bg-white text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
            >
              <option value={ALL_VALUE}>{allLabel}</option>
              {availableOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Examples: one per row, full width ───────────────── */}
      <div className="space-y-10 lg:space-y-14">
        {visibleItems.map((item, index) => (
          <GalleryBeforeAfterPair
            key={item.id}
            beforeUrl={item.beforeUrl}
            afterUrl={item.afterUrl}
            beforeAlt={item.beforeAlt}
            afterAlt={item.afterAlt}
            beforeLabel={beforeLabel}
            afterLabel={afterLabel}
            loading={index === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>
    </>
  );
}
