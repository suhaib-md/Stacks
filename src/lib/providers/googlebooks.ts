import { toIsbn13 } from "@/lib/isbn";
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
 * Google Books — fallback for ISBN, primary for free-text search.
 *
 * Split by strength: it's quota-limited without a key (hence not primary for
 * ISBN), but its relevance ranking for title/author queries is materially better
 * than Open Library's.
 */

const BASE = "https://www.googleapis.com/books/v1/volumes";

function url(query: string, apiKey: string | undefined, maxResults: number): string {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
    printType: "books",
  });
  if (apiKey) params.set("key", apiKey);
  return `${BASE}?${params.toString()}`;
}

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : null;

/** Map one `items[]` entry. Exported for testing without network. */
export function mapGoogleVolume(item: unknown): BookMetadata | null {
  const info = asRec(asRec(item)?.volumeInfo);
  if (!info) return null;

  const title = str(info.title);
  if (!title) return null;

  let isbn13: string | null = null;
  let isbn10: string | null = null;
  if (Array.isArray(info.industryIdentifiers)) {
    for (const entry of info.industryIdentifiers) {
      const rec = asRec(entry);
      const type = str(rec?.type);
      const identifier = str(rec?.identifier);
      if (!identifier) continue;
      if (type === "ISBN_13") isbn13 = toIsbn13(identifier);
      if (type === "ISBN_10") isbn10 = identifier;
    }
  }

  const images = asRec(info.imageLinks);
  // Thumbnails come back with a zoom/edge query string; strip the page-curl
  // overlay, which otherwise renders a fake fold on every cover.
  const rawCover = str(images?.thumbnail) ?? str(images?.smallThumbnail);
  const coverUrl = toHttps(rawCover ? rawCover.replace(/&edge=curl/g, "") : null);

  return {
    isbn13,
    isbn10,
    title,
    subtitle: str(info.subtitle),
    authors: strArray(info.authors),
    publisher: str(info.publisher),
    publishedYear: yearFrom(info.publishedDate),
    pageCount: int(info.pageCount),
    description: str(info.description),
    coverUrl,
    categories: strArray(info.categories).slice(0, 8),
    language: str(info.language),
    source: "googlebooks",
  };
}

function mapVolumeList(raw: unknown, limit: number): BookMetadata[] {
  const items = asRec(raw)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map(mapGoogleVolume)
    .filter((v): v is BookMetadata => v !== null)
    .slice(0, limit);
}

export async function fetchGoogleBooksByIsbn(
  isbn13: string,
  apiKey?: string,
): Promise<BookMetadata | null> {
  const raw = await fetchJson(url(`isbn:${isbn13}`, apiKey, 1));
  if (raw === null) return null;
  const [first] = mapVolumeList(raw, 1);
  if (!first) return null;
  // Trust the ISBN we asked for over whatever the volume happens to carry.
  return { ...first, isbn13 };
}

export async function searchGoogleBooks(
  query: string,
  apiKey: string | undefined,
  limit = 10,
): Promise<BookMetadata[]> {
  const raw = await fetchJson(url(query, apiKey, Math.min(limit, 40)));
  if (raw === null) return [];
  return mapVolumeList(raw, limit);
}
