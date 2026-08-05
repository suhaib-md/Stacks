import { getDb, getEnv } from "@/db";
import { apiError, apiOk } from "@/lib/http";
import { parseIsbn } from "@/lib/isbn";
import { readLookupCache, writeLookupCache } from "@/lib/providers/cache";
import { fetchGoogleBooksByIsbn } from "@/lib/providers/googlebooks";
import { isThin, mergeMetadata } from "@/lib/providers/merge";
import { fetchOpenLibraryByIsbn } from "@/lib/providers/openlibrary";

/**
 * ISBN → BookMetadata.
 *
 * Order: cache → Open Library → Google Books (only if the first result is thin)
 * → merge → cache the outcome, including a miss.
 *
 * Never throws on provider failure. A dead lookup returns 404 and the UI opens
 * the confirm sheet with the ISBN prefilled, which is the whole point of the
 * manual path being first-class.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ isbn: string }> },
) {
  const { isbn } = await params;

  const parsed = parseIsbn(isbn);
  if (!parsed) {
    return apiError("INVALID_ISBN", "That doesn't look like a valid book ISBN.");
  }

  const db = await getDb();

  const cached = await readLookupCache(db, parsed.isbn13);
  if (cached && !cached.stale) {
    if (!cached.found) {
      return apiError("NOT_FOUND", "No metadata found for that ISBN.");
    }
    return apiOk({ metadata: cached.metadata, cached: true });
  }

  const env = await getEnv();

  const openLibrary = await fetchOpenLibraryByIsbn(parsed.isbn13);
  // Only spend a Google call when Open Library left real gaps — this is the
  // difference between staying inside the keyless quota and not.
  const google = isThin(openLibrary)
    ? await fetchGoogleBooksByIsbn(parsed.isbn13, env.GOOGLE_BOOKS_KEY)
    : null;

  const merged = mergeMetadata(openLibrary, google);

  if (!merged) {
    // Providers found nothing NOW, but a stale row means they found something
    // before. Serving that beats discarding it because a provider is down today.
    if (cached?.metadata) {
      return apiOk({ metadata: cached.metadata, cached: true, stale: true });
    }
    await writeLookupCache(db, parsed.isbn13, null);
    return apiError("NOT_FOUND", "No metadata found for that ISBN.");
  }

  // The ISBN we were asked about is more trustworthy than whatever the record
  // carries — providers return sibling editions surprisingly often.
  const metadata = {
    ...merged,
    isbn13: parsed.isbn13,
    isbn10: merged.isbn10 ?? parsed.isbn10,
  };

  await writeLookupCache(db, parsed.isbn13, metadata);
  return apiOk({ metadata, cached: false });
}
