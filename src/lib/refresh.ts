import type { Book } from "@/db/schema";
import type { BookMetadata } from "@/lib/providers/types";

/**
 * Fill gaps in a stored book from a fresh lookup.
 *
 * Only ever fills what is EMPTY. A refresh must never overwrite something you
 * typed — the whole reason books end up here is that a provider was thin or
 * throttled when they were catalogued, not that your edits were wrong.
 *
 * Never touched at all: title, authors, isbn, rating, notes, tags, readStatus,
 * currentPage, coverColor and the reading dates. Those are yours, or derived
 * from your actions.
 */
export type FillableField =
  | "subtitle"
  | "publisher"
  | "publishedYear"
  | "pageCount"
  | "description"
  | "coverUrl"
  | "language"
  | "genre";

export type RefreshResult = {
  patch: Partial<Pick<Book, FillableField>>;
  filled: FillableField[];
};

type TextField = Extract<
  FillableField,
  "subtitle" | "publisher" | "description" | "coverUrl" | "language" | "genre"
>;
type NumberField = Extract<FillableField, "publishedYear" | "pageCount">;

/** A stored value counts as missing if it's null, undefined, or an empty string. */
function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export function fillMissing(book: Book, metadata: BookMetadata): RefreshResult {
  const patch: RefreshResult["patch"] = {};
  const filled: FillableField[] = [];

  // Written field by field rather than through a generic map: the columns have
  // different types, and a loose `string | number` patch silently fails to
  // typecheck against the Drizzle update.
  const text = (field: TextField, incoming: string | null) => {
    if (!isEmpty(book[field]) || isEmpty(incoming)) return;
    patch[field] = incoming;
    filled.push(field);
  };

  const number = (field: NumberField, incoming: number | null) => {
    if (!isEmpty(book[field]) || isEmpty(incoming)) return;
    patch[field] = incoming;
    filled.push(field);
  };

  text("subtitle", metadata.subtitle);
  text("publisher", metadata.publisher);
  number("publishedYear", metadata.publishedYear);
  number("pageCount", metadata.pageCount);
  text("description", metadata.description);
  text("coverUrl", metadata.coverUrl);
  text("language", metadata.language);
  // Only Google's BISAC-style categories reach `categories` now. Open Library's
  // LCSH subjects used to land here and produced "Viajes alrededor del mundo".
  text("genre", metadata.categories[0] ?? null);

  return { patch, filled };
}

/** Which books are worth offering a refresh for. */
export function isIncomplete(book: Pick<Book, "description" | "pageCount" | "coverUrl" | "publisher" | "isbn13">): boolean {
  // No ISBN means nothing to look up — offering a refresh would be a dead end.
  if (!book.isbn13) return false;
  return (
    isEmpty(book.description) ||
    isEmpty(book.pageCount) ||
    isEmpty(book.coverUrl) ||
    isEmpty(book.publisher)
  );
}
