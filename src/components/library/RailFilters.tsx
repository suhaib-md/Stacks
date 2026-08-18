"use client";

import { useState } from "react";
import { useLibraryParams } from "@/lib/useLibraryParams";

/**
 * The filters, in the rail, on desktop.
 *
 * Each group collapses. The design's rail showed everything at once, but a real
 * library carries four statuses, four formats and dozens of genres — open, that
 * is a wall of rows before you have touched anything. Status stays open because
 * it is the one people reach for; the rest open on demand.
 */

export type Facet = { value: string; label: string; count: number };

/** How many genres show before "Show all". Providers hand back dozens. */
const GENRE_PREVIEW = 10;

function Group({
  label,
  active,
  defaultOpen = false,
  children,
}: {
  label: string;
  /** The chosen value, shown on the header so a collapsed group still reads. */
  active?: string | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-rule-control">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-ink/[.06]"
      >
        <span className="lbl text-accent">{label}</span>
        {!open && active ? (
          <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">{active}</span>
        ) : (
          <span className="flex-1" />
        )}
        <span aria-hidden="true" className="text-[10px] text-ink-muted">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <ul className="pb-2">{children}</ul> : null}
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
        className={`flex min-h-8 w-full items-center gap-2 px-4 text-left text-[13px] transition-colors ${
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
  const { params, toggle, clearAll, hasActive } = useLibraryParams();
  const [showAllGenres, setShowAllGenres] = useState(false);

  const activeStatus = params.get("status");
  const activeFormat = params.get("format");
  const activeGenre = params.get("genre");
  const shown = showAllGenres ? genres : genres.slice(0, GENRE_PREVIEW);

  const labelFor = (facets: Facet[], value: string | null) =>
    facets.find((f) => f.value === value)?.label ?? null;

  return (
    <div>
      {statuses.length > 0 ? (
        <Group label="Status" active={labelFor(statuses, activeStatus)} defaultOpen>
          {statuses.map((f) => (
            <Row
              key={f.value}
              label={f.label}
              count={f.count}
              active={activeStatus === f.value}
              onClick={() => toggle("status", f.value)}
            />
          ))}
        </Group>
      ) : null}

      {formats.length > 0 ? (
        <Group label="Format" active={labelFor(formats, activeFormat)}>
          {formats.map((f) => (
            <Row
              key={f.value}
              label={f.label}
              count={f.count}
              active={activeFormat === f.value}
              onClick={() => toggle("format", f.value)}
            />
          ))}
        </Group>
      ) : null}

      {genres.length > 0 ? (
        <Group label="Genre" active={activeGenre}>
          {shown.map((f) => (
            <Row
              key={f.value}
              label={f.label}
              count={f.count}
              active={activeGenre === f.value}
              onClick={() => toggle("genre", f.value)}
            />
          ))}
          {genres.length > GENRE_PREVIEW ? (
            <li>
              <button
                type="button"
                onClick={() => setShowAllGenres((v) => !v)}
                className="px-4 py-1.5 text-[12px] text-accent underline"
              >
                {showAllGenres ? "Show fewer" : `Show all ${genres.length} genres`}
              </button>
            </li>
          ) : null}
        </Group>
      ) : null}

      {hasActive ? (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={clearAll}
            className="w-full border border-rule-control px-2 py-1.5 text-[12px] font-medium hover:bg-ink/[.08]"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  );
}
