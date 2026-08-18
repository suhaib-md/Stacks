"use client";

import { useState } from "react";
import { useLibraryParams } from "@/lib/useLibraryParams";

/**
 * The filters, in the rail, on desktop. Nothing collapses or hides except the
 * long tail of genres — every status and format is visible with its count, so
 * the shape of the library is readable without touching anything.
 */

export type Facet = { value: string; label: string; count: number };

/** How many genres show before "Show all". Providers hand back dozens. */
const GENRE_PREVIEW = 10;

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b-2 border-rule px-4 py-3">
      <span className="lbl block text-accent">{label}</span>
      <ul className="mt-2">{children}</ul>
    </div>
  );
}

function Row({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`flex min-h-8 w-full items-center gap-2 px-2 text-left text-[13px] transition-colors ${
          active ? "bg-accent text-on-accent" : "hover:bg-ink/[.06]"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className={`tabular text-[11px] ${active ? "opacity-80" : "text-ink-muted"}`}>
          {count}
        </span>
      </button>
    </li>
  );
}

export function RailFilters({
  statuses,
  formats,
  genres,
}: {
  statuses: Facet[];
  formats: Facet[];
  genres: Facet[];
}) {
  const { params, query, setQuery, toggle, clearAll, hasActive } = useLibraryParams();
  const [showAllGenres, setShowAllGenres] = useState(false);

  const shown = showAllGenres ? genres : genres.slice(0, GENRE_PREVIEW);

  return (
    <div>
      <div className="border-b-2 border-rule px-4 py-3">
        <label htmlFor="rail-q" className="lbl block text-accent">
          Search
        </label>
        <input
          id="rail-q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title, author, notes"
          className="mt-2 w-full border-2 border-rule bg-paper px-2 py-1.5 text-[13px] outline-none placeholder:text-ink-faint"
        />
      </div>

      {statuses.length > 0 ? (
        <Section label="Status">
          {statuses.map((f) => (
            <Row
              key={f.value}
              label={f.label}
              count={f.count}
              active={params.get("status") === f.value}
              onClick={() => toggle("status", f.value)}
            />
          ))}
        </Section>
      ) : null}

      {formats.length > 0 ? (
        <Section label="Format">
          {formats.map((f) => (
            <Row
              key={f.value}
              label={f.label}
              count={f.count}
              active={params.get("format") === f.value}
              onClick={() => toggle("format", f.value)}
            />
          ))}
        </Section>
      ) : null}

      {genres.length > 0 ? (
        <Section label="Genre">
          {shown.map((f) => (
            <Row
              key={f.value}
              label={f.label}
              count={f.count}
              active={params.get("genre") === f.value}
              onClick={() => toggle("genre", f.value)}
            />
          ))}
          {genres.length > GENRE_PREVIEW ? (
            <li>
              <button
                type="button"
                onClick={() => setShowAllGenres((v) => !v)}
                className="mt-1 px-2 py-1 text-[12px] text-accent underline"
              >
                {showAllGenres ? "Show fewer" : `Show all ${genres.length} genres`}
              </button>
            </li>
          ) : null}
        </Section>
      ) : null}

      {hasActive ? (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={clearAll}
            className="w-full border-2 border-rule px-2 py-1.5 text-[12px] font-medium hover:bg-ink/[.08]"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  );
}
