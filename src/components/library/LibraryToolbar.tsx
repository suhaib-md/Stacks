"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { READ_STATUSES, BOOK_FORMATS } from "@/db/schema";

/**
 * Filters, sort, and view all live in the URL — not in client state.
 *
 * That is what makes the back button, deep links, and "restore where I was"
 * work without any extra machinery, and it lets the server resolve the query.
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

/**
 * Remembered for next visit. A cookie rather than localStorage so the server can
 * honour it on first paint instead of flashing the wrong layout then correcting.
 */
function rememberView(view: string): void {
  document.cookie = `stacks-view=${view}; path=/; max-age=31536000; samesite=lax`;
}

export function LibraryToolbar({ genres }: { genres: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const currentQ = params.get("q") ?? "";
  const [query, setQuery] = useState(currentQ);

  // Debounced search. Writes to the URL rather than to state, so the server
  // re-resolves the list and the history entry is meaningful.
  useEffect(() => {
    if (query === currentQ) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, currentQ, params, pathname, router]);

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    next.delete("page"); // Any filter change invalidates the current page.

    if (key === "view" && value) rememberView(value);

    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  /** Clicking an active chip clears it — chips are toggles, not radio buttons. */
  function toggle(key: string, value: string) {
    update(key, params.get(key) === value ? null : value);
  }

  const view = params.get("view") ?? "grid";
  const sort = params.get("sort") ?? "created";
  const order = params.get("order") ?? "desc";
  const activeFilters = ["status", "genre", "format"].filter((k) => params.get(k));

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Title, author, or notes"
            aria-label="Search your library"
            className="min-h-11 w-full rounded-card bg-surface-sunk pl-9 pr-3 text-sm outline-none ring-accent focus:ring-2"
          />
        </div>

        <div
          role="group"
          aria-label="View"
          className="flex shrink-0 overflow-hidden rounded-card bg-surface-sunk"
        >
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update("view", v)}
              aria-pressed={view === v}
              aria-label={`${v} view`}
              className={`flex min-h-11 w-11 items-center justify-center transition-colors ${
                view === v ? "bg-accent-soft text-accent" : "text-ink-muted"
              }`}
            >
              {v === "grid" ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontally scrollable on phones; the row is longer than the screen. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        {READ_STATUSES.map((status) => (
          <Chip
            key={status}
            active={params.get("status") === status}
            onClick={() => toggle("status", status)}
          >
            {STATUS_LABEL[status]}
          </Chip>
        ))}

        <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-rule" />

        {BOOK_FORMATS.map((format) => (
          <Chip
            key={format}
            active={params.get("format") === format}
            onClick={() => toggle("format", format)}
          >
            <span className="capitalize">{format}</span>
          </Chip>
        ))}

        {genres.length > 0 ? (
          <>
            <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-rule" />
            {genres.map((genre) => (
              <Chip
                key={genre}
                active={params.get("genre") === genre}
                onClick={() => toggle("genre", genre)}
              >
                {genre}
              </Chip>
            ))}
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="sort" className="text-xs text-ink-muted">
          Sort
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => update("sort", e.target.value)}
          className="min-h-9 rounded-card bg-surface-sunk px-2 text-xs outline-none ring-accent focus:ring-2"
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
          aria-label={order === "asc" ? "Ascending, switch to descending" : "Descending, switch to ascending"}
          className="min-h-9 rounded-card bg-surface-sunk px-2 text-xs text-ink-muted"
        >
          {order === "asc" ? "↑" : "↓"}
        </button>

        {activeFilters.length > 0 || currentQ ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.replace(pathname, { scroll: false });
            }}
            className="ml-auto min-h-9 rounded-card px-2 text-xs font-medium text-accent"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors ${
        active
          ? "border border-accent bg-accent-soft text-accent"
          : "bg-surface-sunk text-ink-muted"
      }`}
    >
      {children}
    </button>
  );
}
