export type MetadataSource = "openlibrary" | "googlebooks" | "merged" | "manual";

/** The unified shape every provider maps into. See docs/trd.md §5.3. */
export type BookMetadata = {
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
  categories: string[];
  language: string | null;
  source: MetadataSource;
};

export const PROVIDER_TIMEOUT_MS = 4000;

/**
 * One attempt, hard deadline, no retries. Any failure — timeout, non-200, bad
 * JSON, DNS — resolves to null. A lookup that degrades is recoverable; one that
 * throws takes the add flow down with it.
 */
export async function fetchJson(
  url: string,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        // Open Library asks for a contactable agent; being a good citizen here
        // is what keeps the keyless quota available.
        "user-agent": "Stacks/1.0 (personal book catalog)",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- shared coercion helpers ------------------------------------------------
// External APIs are inconsistent per edition: missing keys, nulls, numbers as
// strings, empty arrays. Everything funnels through these so a surprising shape
// yields null instead of a crash.

export function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function int(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * For counts, where 0 means "the provider doesn't know", not "zero pages".
 *
 * Both APIs return `pageCount: 0` for plenty of records. Treating that as a real
 * value is doubly wrong: it fails the `min(1)` validator on save, and because 0
 * isn't null it beats the other provider's real page count during the merge.
 */
export function positiveInt(value: unknown): number | null {
  const parsed = int(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(str).filter((v): v is string => v !== null);
}

/** Publishers write dates as "2004", "May 2004", "2004-05-01". Only the year is reliable. */
export function yearFrom(value: unknown): number | null {
  const raw = str(value);
  if (!raw) return null;
  const match = raw.match(/(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

/** Providers hand back http:// image URLs that would be blocked as mixed content. */
export function toHttps(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}
