import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { formatAuthors } from "@/db/serde";

// Reads the request-scoped D1 binding, so this page can never be prerendered.
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const db = await getDb();
  const library = await db.select().from(books).orderBy(desc(books.createdAt)).limit(60);

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>

      {library.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="font-display text-xl">Your shelves are empty</p>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">
            Scanning arrives in Phase 2. For now, this page proves the database is
            wired up end to end.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-rule">
          {library.map((book) => (
            <li key={book.id} className="py-3">
              <p className="font-display text-lg">{book.title}</p>
              <p className="text-sm text-ink-muted">{formatAuthors(book.authors)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
