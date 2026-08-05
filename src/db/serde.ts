/**
 * The only place `authors` / `tags` JSON is parsed or stringified.
 *
 * Inline JSON.parse at call sites is how a single malformed row takes down a page —
 * these never throw, they degrade to an empty list.
 */

export function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

export function serializeStringArray(values: readonly string[] | null | undefined): string {
  if (!values) return "[]";
  const cleaned = values
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return JSON.stringify(Array.from(new Set(cleaned)));
}

/** "Ursula K. Le Guin & Someone Else" — for display in a single line. */
export function formatAuthors(raw: string | null | undefined): string {
  const authors = parseStringArray(raw);
  if (authors.length === 0) return "Unknown author";
  if (authors.length <= 2) return authors.join(" & ");
  return `${authors[0]} & ${authors.length - 1} others`;
}
