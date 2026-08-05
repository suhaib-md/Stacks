import { isbn13To10, toIsbn13 } from "@/lib/isbn";
import {
  type BookMetadata,
  fetchJson,
  int,
  str,
  strArray,
  toHttps,
  yearFrom,
} from "./types";

/**
 * Open Library — primary for ISBN lookups. Free, no key, and the better source
 * for physical/publication data (publisher, page count, edition year).
 *
 * It does NOT reliably return a description via jscmd=data; that's what Google
 * Books fills in.
 */

const DATA_URL = (isbn13: string) =>
  `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`;

/** Deterministic cover URL — usable even when the record carries no cover object. */
export const coverUrlForIsbn = (isbn13: string) =>
  `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`;

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : null;

/** Map the `{ "ISBN:978...": {...} }` envelope. Exported for testing without network. */
export function mapOpenLibrary(raw: unknown, isbn13: string): BookMetadata | null {
  const envelope = asRec(raw);
  if (!envelope) return null;

  const record = asRec(envelope[`ISBN:${isbn13}`]);
  if (!record) return null;

  const title = str(record.title);
  if (!title) return null; // A record with no title is not a usable result.

  // authors: [{ name, url }]
  const authors = Array.isArray(record.authors)
    ? record.authors
        .map((a) => str(asRec(a)?.name))
        .filter((v): v is string => v !== null)
    : [];

  // publishers: [{ name }]
  const publisher = Array.isArray(record.publishers)
    ? str(asRec(record.publishers[0])?.name)
    : null;

  // subjects: [{ name, url }]
  const categories = Array.isArray(record.subjects)
    ? record.subjects
        .map((s) => str(asRec(s)?.name))
        .filter((v): v is string => v !== null)
        .slice(0, 8)
    : [];

  const cover = asRec(record.cover);
  const coverUrl =
    toHttps(str(cover?.large) ?? str(cover?.medium) ?? str(cover?.small)) ??
    coverUrlForIsbn(isbn13);

  const identifiers = asRec(record.identifiers);
  const isbn10 = strArray(identifiers?.isbn_10)[0] ?? isbn13To10(isbn13);

  // `notes` is occasionally prose about the edition; it's the closest thing to a
  // description this endpoint offers, and only when it's a plain string.
  const description = str(record.notes) ?? str(asRec(record.notes)?.value);

  return {
    isbn13,
    isbn10,
    title,
    subtitle: str(record.subtitle),
    authors,
    publisher,
    publishedYear: yearFrom(record.publish_date),
    pageCount: int(record.number_of_pages),
    description,
    coverUrl,
    categories,
    language: null, // jscmd=data doesn't expose it; Google Books does.
    source: "openlibrary",
  };
}

export async function fetchOpenLibraryByIsbn(isbn13: string): Promise<BookMetadata | null> {
  const raw = await fetchJson(DATA_URL(isbn13));
  if (raw === null) return null;
  return mapOpenLibrary(raw, isbn13);
}

// --- free-text search (fallback for /api/lookup/search) ----------------------

const SEARCH_FIELDS = [
  "title",
  "subtitle",
  "author_name",
  "first_publish_year",
  "isbn",
  "number_of_pages_median",
  "publisher",
  "cover_i",
  "language",
].join(",");

const SEARCH_URL = (query: string, limit: number) =>
  `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=${SEARCH_FIELDS}`;

/** Map one `docs[]` entry from search.json. Exported for testing without network. */
export function mapOpenLibraryDoc(doc: unknown): BookMetadata | null {
  const rec = asRec(doc);
  if (!rec) return null;

  const title = str(rec.title);
  if (!title) return null;

  // search.json returns every ISBN across all editions; take the first that is a
  // well-formed 13, else convert the first valid 10.
  const isbns = strArray(rec.isbn);
  let isbn13: string | null = null;
  for (const candidate of isbns) {
    const normalized = toIsbn13(candidate);
    if (normalized) {
      isbn13 = normalized;
      break;
    }
  }

  const coverId = int(rec.cover_i);
  const coverUrl = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : isbn13
      ? coverUrlForIsbn(isbn13)
      : null;

  return {
    isbn13,
    isbn10: isbn13 ? isbn13To10(isbn13) : null,
    title,
    subtitle: str(rec.subtitle),
    authors: strArray(rec.author_name),
    publisher: strArray(rec.publisher)[0] ?? null,
    publishedYear: int(rec.first_publish_year),
    pageCount: int(rec.number_of_pages_median),
    description: null,
    coverUrl,
    categories: [],
    language: strArray(rec.language)[0] ?? null,
    source: "openlibrary",
  };
}

export async function searchOpenLibrary(query: string, limit = 10): Promise<BookMetadata[]> {
  const raw = await fetchJson(SEARCH_URL(query, limit));
  const docs = asRec(raw)?.docs;
  if (!Array.isArray(docs)) return [];
  return docs
    .map(mapOpenLibraryDoc)
    .filter((v): v is BookMetadata => v !== null)
    .slice(0, limit);
}
