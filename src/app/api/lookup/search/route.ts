import { getEnv } from "@/db";
import { apiError, apiOk } from "@/lib/http";
import { searchGoogleBooks } from "@/lib/providers/googlebooks";
import { searchOpenLibrary } from "@/lib/providers/openlibrary";

/**
 * Free-text title/author search.
 *
 * Google Books is primary here — the inverse of the ISBN route — because its
 * relevance ranking on natural-language queries is materially better. Open
 * Library covers the case where Google is throttled or returns nothing.
 */
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return apiError("VALIDATION_FAILED", "Enter at least two characters to search.");
  }

  const env = await getEnv();

  let results = await searchGoogleBooks(query, env.GOOGLE_BOOKS_KEY, 10);
  let source: "googlebooks" | "openlibrary" = "googlebooks";

  if (results.length === 0) {
    results = await searchOpenLibrary(query, 10);
    source = "openlibrary";
  }

  // An empty result set is a valid answer, not an error — the UI offers manual
  // entry from here.
  return apiOk({ results, source, query });
}
