import type { BookMetadata } from "./types";

/**
 * Merge strategy (docs/trd.md §5.1).
 *
 * Open Library is authoritative for publisher / page count / publication year —
 * it catalogues physical editions, so its data matches the book in your hand.
 * Google Books supplies description, categories and language, which Open Library
 * largely doesn't return.
 *
 * The rule underneath both: a non-empty value always beats an empty one. Neither
 * provider is ever allowed to blank a field the other actually populated.
 */

const pick = <T>(preferred: T | null, fallback: T | null): T | null =>
  preferred !== null && preferred !== undefined ? preferred : (fallback ?? null);

const pickList = (preferred: string[], fallback: string[]): string[] =>
  preferred.length > 0 ? preferred : fallback;

export function mergeMetadata(
  openLibrary: BookMetadata | null,
  google: BookMetadata | null,
): BookMetadata | null {
  if (!openLibrary && !google) return null;
  if (!google) return openLibrary;
  if (!openLibrary) return google;

  return {
    isbn13: pick(openLibrary.isbn13, google.isbn13),
    isbn10: pick(openLibrary.isbn10, google.isbn10),

    // Open Library titles track the physical edition; Google sometimes returns a
    // series or omnibus title for the same ISBN.
    title: openLibrary.title || google.title,
    subtitle: pick(openLibrary.subtitle, google.subtitle),
    authors: pickList(openLibrary.authors, google.authors),

    // Physical/publication data — Open Library wins.
    publisher: pick(openLibrary.publisher, google.publisher),
    publishedYear: pick(openLibrary.publishedYear, google.publishedYear),
    pageCount: pick(openLibrary.pageCount, google.pageCount),

    // Editorial data — Google wins; Open Library rarely has it at all.
    description: pick(google.description, openLibrary.description),
    categories: pickList(google.categories, openLibrary.categories),
    language: pick(google.language, openLibrary.language),

    // Open Library's cover is the edition's actual jacket and is served at a
    // usable size; Google's thumbnail is small and often the wrong printing.
    coverUrl: pick(openLibrary.coverUrl, google.coverUrl),

    source: "merged",
  };
}

/**
 * True when a result is too sparse to show in the confirm sheet without
 * embarrassment — the signal to spend a Google Books call filling it in.
 */
export function isThin(metadata: BookMetadata | null): boolean {
  if (!metadata) return true;
  return (
    metadata.authors.length === 0 ||
    metadata.pageCount === null ||
    metadata.description === null
  );
}
