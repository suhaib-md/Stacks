import { desc } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { parseStringArray } from "@/db/serde";

// Reads the request-scoped D1 binding, so this page can never be prerendered.
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

export default async function LibraryPage() {
  const db = await getDb();
  const library = await db.select().from(books).orderBy(desc(books.createdAt)).limit(60);

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>
        {library.length > 0 ? (
          <span className="text-sm text-ink-muted tabular">{library.length} books</span>
        ) : null}
      </div>

      {library.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="font-display text-xl">Your shelves are empty</p>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">
            Add your first book by ISBN, by searching, or by hand.
          </p>
          <Link
            href="/add"
            className="mt-6 inline-flex min-h-11 items-center rounded-card bg-accent px-5 text-sm font-medium text-paper"
          >
            Add a book
          </Link>
        </div>
      ) : (
        // A plain list for now. The cover grid is Phase 3.
        <ul className="mt-6 divide-y divide-rule">
          {library.map((book) => {
            const authors = parseStringArray(book.authors);
            return (
              <li key={book.id}>
                <Link
                  href={`/book/${book.id}`}
                  className="flex items-start gap-3 py-3 transition-colors hover:bg-surface-sunk"
                >
                  {book.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote covers are unoptimized by design
                    <img
                      src={book.coverUrl}
                      alt=""
                      width={40}
                      height={60}
                      loading="lazy"
                      className="h-[60px] w-10 shrink-0 rounded-cover border border-rule object-cover"
                    />
                  ) : (
                    <div className="h-[60px] w-10 shrink-0 rounded-cover border border-rule bg-surface-sunk" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base">{book.title}</span>
                    <span className="block truncate text-sm text-ink-muted">
                      {authors.length > 0 ? authors.join(", ") : "Unknown author"}
                    </span>
                  </span>
                  <span className="shrink-0 self-center rounded-full bg-surface-sunk px-2 py-1 text-[11px] font-medium text-ink-muted">
                    {STATUS_LABEL[book.readStatus] ?? book.readStatus}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
