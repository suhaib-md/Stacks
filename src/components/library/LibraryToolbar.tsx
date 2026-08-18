"use client";

import { useState } from "react";
import { READ_STATUSES } from "@/db/schema";
import { useLibraryParams } from "@/lib/useLibraryParams";
import type { Facet } from "./RailFilters";

/**
 * View and sort, always. Search and the status filters as well — but only on
 * mobile, where there is no rail to hold them.
 */

const SORTS = [
  { value: "created", label: "Recently added" },
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "rating", label: "Rating" },
  { value: "finished", label: "Recently finished" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "DNF",
};

const GENRE_PREVIEW = 8;

export function LibraryToolbar({ genres }: { genres: Facet[] }) {
  const { params, update, toggle, clearAll, hasActive, view, sort, order } = useLibraryParams();
  const [genresOpen, setGenresOpen] = useState(false);
  const [showAllGenres, setShowAllGenres] = useState(false);

  const activeGenre = params.get("genre");
  const shownGenres = showAllGenres ? genres : genres.slice(0, GENRE_PREVIEW);

  return (
    <div className="mt-4 border-y border-rule-control">
      {/* Status — mobile only. */}
      <div className="flex gap-2 overflow-x-auto border-b border-rule-control p-2 [scrollbar-width:none] md:hidden">
        {READ_STATUSES.map((s) => {
          const active = params.get("status") === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle("status", s)}
              aria-pressed={active}
              className={`min-h-9 shrink-0 border-2 px-3 text-[12px] font-medium ${
                active
                  ? "border-accent bg-accent text-on-accent"
                  : "border-rule text-ink"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2">
        {/* View — a segmented control, not a menu. */}
        <div role="group" aria-label="View" className="flex border border-rule-control">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update("view", v)}
              aria-pressed={view === v}
              className={`min-h-8 px-3 text-[12px] font-medium capitalize ${
                view === v ? "bg-accent text-on-accent" : "hover:bg-ink/[.08]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="lbl text-ink-muted">
            Sort
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => update("sort", e.target.value)}
            className="min-h-8 border border-rule-control bg-paper px-2 text-[12px] outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => update("order", order === "asc" ? "desc" : "asc")}
            aria-label={
              order === "asc" ? "Ascending, switch to descending" : "Descending, switch to ascending"
            }
            className="min-h-8 border border-rule-control px-2 text-[12px] hover:bg-ink/[.08]"
          >
            {order === "asc" ? "↑" : "↓"}
          </button>
        </div>

        {/* Genre — mobile only, behind a disclosure. */}
        {genres.length > 0 ? (
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setGenresOpen((v) => !v)}
              aria-expanded={genresOpen}
              className={`min-h-8 border-2 px-3 text-[12px] font-medium ${
                activeGenre ? "border-accent bg-accent text-on-accent" : "border-rule"
              }`}
            >
              {activeGenre ?? "Genre"} ▾
            </button>
          </div>
        ) : null}

        {hasActive ? (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto min-h-8 px-2 text-[12px] font-medium text-accent underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {genresOpen ? (
        <div className="flex flex-wrap gap-2 border-t border-rule-control p-2 md:hidden">
          {shownGenres.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => toggle("genre", g.value)}
              aria-pressed={activeGenre === g.value}
              className={`min-h-8 border-2 px-3 text-[12px] ${
                activeGenre === g.value
                  ? "border-accent bg-accent text-on-accent"
                  : "border-rule"
              }`}
            >
              {g.label} <span className="tabular text-ink-muted">{g.count}</span>
            </button>
          ))}
          {genres.length > GENRE_PREVIEW ? (
            <button
              type="button"
              onClick={() => setShowAllGenres((v) => !v)}
              className="min-h-8 px-2 text-[12px] text-accent underline"
            >
              {showAllGenres ? "Show fewer" : `Show all ${genres.length}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
