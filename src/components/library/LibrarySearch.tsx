"use client";

import { useLibraryParams } from "@/lib/useLibraryParams";

/**
 * Search sits in the top bar beside the one red action, on every width — it is
 * the thing reached for most often, so it belongs where the eye already is
 * rather than buried in the rail.
 */
export function LibrarySearch() {
  const { query, setQuery } = useLibraryParams();

  return (
    <div className="relative w-full sm:w-72">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="square" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Title, author, or notes"
        aria-label="Search your library"
        className="min-h-10 w-full border border-rule-control bg-paper pl-9 pr-3 text-[13px] outline-none placeholder:text-ink-faint"
      />
    </div>
  );
}
