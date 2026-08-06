import { eq } from "drizzle-orm";
import { getDb, getEnv } from "@/db";
import { books } from "@/db/schema";
import { toApiBook } from "@/lib/books";
import { apiError, apiOk } from "@/lib/http";
import { writeLookupCache } from "@/lib/providers/cache";
import { fetchGoogleBooksByIsbn } from "@/lib/providers/googlebooks";
import { mergeMetadata } from "@/lib/providers/merge";
import { fetchOpenLibraryByIsbn } from "@/lib/providers/openlibrary";
import { fillMissing } from "@/lib/refresh";

/**
 * Re-run the lookup for one book and fill in whatever is still missing.
 *
 * Deliberately BYPASSES the lookup cache. A manual refresh exists precisely
 * because the cached answer was thin — usually captured while a provider was
 * throttled — so serving that same answer back would be pointless.
 *
 * Only empty fields are filled; nothing you have typed is ever overwritten.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const db = await getDb();
  const book = await db.select().from(books).where(eq(books.id, id)).get();
  if (!book) return apiError("NOT_FOUND", "No such book.");

  if (!book.isbn13) {
    return apiError("VALIDATION_FAILED", "This book has no ISBN, so there's nothing to look up.");
  }

  const env = await getEnv();

  // Both providers, unconditionally: with a key in place Google is usually the
  // one holding the description that was missing.
  const [openLibrary, google] = await Promise.all([
    fetchOpenLibraryByIsbn(book.isbn13),
    fetchGoogleBooksByIsbn(book.isbn13, env.GOOGLE_BOOKS_KEY),
  ]);

  const metadata = mergeMetadata(openLibrary, google);
  if (!metadata) {
    return apiError("NOT_FOUND", "Neither catalogue has anything for that ISBN today.");
  }

  // Refresh the cache too, so the next scan of this ISBN benefits.
  await writeLookupCache(db, book.isbn13, metadata);

  const { patch, filled } = fillMissing(book, metadata);

  if (filled.length === 0) {
    return apiOk({ book: toApiBook(book), filled: [] });
  }

  await db
    .update(books)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(books.id, id));

  const updated = await db.select().from(books).where(eq(books.id, id)).get();
  return apiOk({ book: updated ? toApiBook(updated) : null, filled });
}
