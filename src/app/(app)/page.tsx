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
    .filter((r) => Boolean(r.genre))
    .map((r) => ({ value: r.genre as string, label: r.genre as string, count: r.count }));

  // The header states the size of the shelf, not of the current filter.
  const [{ shelfBooks, shelfPages }] = await db
    .select({
      shelfBooks: sql<number>`count(*)`,
      shelfPages: sql<number>`coalesce(sum(${books.pageCount}), 0)`,
    })
    .from(books);
  const filtered = hasActiveFilters(filters);
  const totalPages = Math.max(1, Math.ceil(total / filters.perPage));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="disp text-[34px] md:text-[40px]">Library</h1>
          <p className="mt-1.5 text-[13px] text-ink-muted tabular">
            {filtered ? (
              <>
                {total.toLocaleString()} of {shelfBooks.toLocaleString()} shown
              </>
            ) : (
              <>
                {shelfBooks.toLocaleString()} {shelfBooks === 1 ? "book" : "books"} ·{" "}
                {shelfPages.toLocaleString()} pages
              </>
            )}
          </p>
        </div>

        {/* The only red on the screen: the action that adds something. */}
        <Link
          href="/add"
          className="min-h-10 bg-accent px-5 text-[13px] font-medium leading-10 text-on-accent"
        >
          Scan a book
        </Link>
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
      // Quiet, and it stays put: the library is right there behind it.
      <div className="border-b-2 border-rule py-6">
        <p className="disp text-lg">No books match these filters</p>
        <p className="mt-1.5 max-w-md text-[13px] text-ink-muted">
          Your library isn&apos;t empty — this search just came up short.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-9 items-center border-2 border-rule px-4 text-[12px] font-medium hover:bg-ink/[.08]"
        >
          Clear filters
        </Link>
      </div>
    );
  }

  return (
    // A poster with one instruction.
    <div className="mt-10 max-w-2xl border-t-2 border-rule pt-10">
      <span className="lbl text-accent">Nothing catalogued yet</span>
      <p className="disp mt-4 text-[38px] leading-none md:text-[54px]">
        Your shelves are empty.
      </p>
      <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-ink-muted">
        Point the camera at a barcode and the book is catalogued in one tap — title,
        author, edition, length and cover, without typing anything.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link
          href="/add"
          className="min-h-11 bg-accent px-5 text-[13px] font-medium leading-[2.75rem] text-on-accent"
        >
          Scan your first book
        </Link>
        <Link
          href="/add/search"
          className="min-h-11 border-2 border-rule px-4 text-[13px] font-medium leading-[2.6rem] hover:bg-ink/[.08]"
        >
          Search by title
        </Link>
        <Link href="/add/manual" className="text-[13px] text-ink-muted underline">
          Enter one by hand
        </Link>
      </div>
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
    <nav className="mt-8 flex items-center justify-between border-t-2 border-rule pt-4" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="min-h-9 border-2 border-rule px-4 text-[12px] font-medium leading-[2.1rem] hover:bg-ink/[.08]"
        >
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="lbl text-ink-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className="min-h-9 border-2 border-rule px-4 text-[12px] font-medium leading-[2.1rem] hover:bg-ink/[.08]"
        >
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
