import { desc, eq, isNotNull, sql } from "drizzle-orm";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { CoverTileSkeleton } from "@/components/book/CoverTile";
import { CurrentlyReading } from "@/components/library/CurrentlyReading";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { SelectableLibrary } from "@/components/library/SelectableLibrary";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { bookOrder, bookWhere, hasActiveFilters, parseFilters } from "@/lib/queries";

// Reads the request-scoped D1 binding, so this page can never be prerendered.
export const dynamic = "force-dynamic";

const GRID_CLASS =
  "grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-5 2xl:grid-cols-8";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = {
    get: (key: string) => {
      const value = raw[key];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  };

  // The view preference is a cookie, not localStorage, so the server can honour
  // it on first paint rather than flashing the wrong layout then correcting.
  const cookieStore = await cookies();
  const savedView = cookieStore.get("stacks-view")?.value;
  const filters = parseFilters(params, {
    view: savedView === "list" ? "list" : "grid",
  });

  const db = await getDb();
  const where = bookWhere(filters);

  const [rows, counted, reading, genreRows] = await Promise.all([
    db
      .select()
      .from(books)
      .where(where)
      .orderBy(bookOrder(filters))
      .limit(filters.perPage)
      .offset((filters.page - 1) * filters.perPage),
    db.select({ total: sql<number>`count(*)` }).from(books).where(where),
    db.select().from(books).where(eq(books.readStatus, "reading")).orderBy(desc(books.updatedAt)),
    // Ordered by how many books carry each genre, so the useful ones surface
    // first and the long tail of catalogue headings sinks.
    db
      .select({ genre: books.genre, count: sql<number>`count(*)` })
      .from(books)
      .where(isNotNull(books.genre))
      .groupBy(books.genre)
      .orderBy(sql`count(*) desc`, books.genre),
  ]);

  const total = counted[0]?.total ?? 0;
  const genres = genreRows
    .map((r) => ({ name: r.genre as string, count: r.count }))
    .filter((g) => Boolean(g.name));
  const filtered = hasActiveFilters(filters);
  const totalPages = Math.max(1, Math.ceil(total / filters.perPage));

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>
        <span className="shrink-0 text-sm text-ink-muted tabular">
          {total} {total === 1 ? "book" : "books"}
        </span>
      </div>

      {/* Hidden entirely rather than shown empty when nothing is being read. */}
      {reading.length > 0 && !filtered ? <CurrentlyReading books={reading} /> : null}

      <Suspense fallback={<div className="mt-4 h-11" />}>
        <LibraryToolbar genres={genres} />
      </Suspense>

      {rows.length === 0 ? (
        <EmptyState filtered={filtered} />
      ) : (
        <SelectableLibrary books={rows} view={filters.view} />
      )}

      {totalPages > 1 ? (
        <Pagination page={filters.page} totalPages={totalPages} params={raw} />
      ) : null}
    </>
  );
}

/**
 * A library with no books and a filter that matches nothing are different
 * problems, and must never look the same (docs/uiux.md §7).
 */
function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="font-display text-xl">No books match these filters</p>
        <p className="mt-2 max-w-xs text-sm text-ink-muted">
          Your library isn&apos;t empty — this search just came up short.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-card border border-rule px-5 text-sm font-medium"
        >
          Clear filters
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
        className="size-16 text-ink-faint"
      >
        <rect x="10" y="20" width="12" height="30" rx="1.5" />
        <rect x="24" y="14" width="10" height="36" rx="1.5" />
        <path d="M36 50l6-32 10 2-6 32z" strokeLinejoin="round" />
        <path d="M8 50h48" strokeLinecap="round" />
      </svg>
      <p className="mt-4 font-display text-xl">Your shelves are empty</p>
      <p className="mt-2 max-w-xs text-sm text-ink-muted">
        Point the camera at a barcode and it&apos;s catalogued in one tap.
      </p>
      <Link
        href="/add"
        className="mt-6 inline-flex min-h-11 items-center rounded-card bg-accent px-5 text-sm font-medium text-paper"
      >
        Scan your first book
      </Link>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | string[] | undefined>;
}) {
  const href = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      next.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
    }
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className="min-h-11 rounded-card border border-rule px-4 text-sm leading-[2.75rem]">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-ink-muted tabular">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className="min-h-11 rounded-card border border-rule px-4 text-sm leading-[2.75rem]">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function LibrarySkeleton() {
  return (
    <ul className={`mt-4 ${GRID_CLASS}`}>
      {Array.from({ length: 18 }, (_, i) => (
        <CoverTileSkeleton key={i} />
      ))}
    </ul>
  );
}
