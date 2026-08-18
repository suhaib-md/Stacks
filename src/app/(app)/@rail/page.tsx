import { isNotNull, sql } from "drizzle-orm";
import { RailFilters, type Facet } from "@/components/library/RailFilters";
import { getDb } from "@/db";
import { books, BOOK_FORMATS, READ_STATUSES } from "@/db/schema";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

/**
 * The Library's rail content. Counts are unfiltered totals — the rail describes
 * the whole library, so the numbers hold still while you filter rather than
 * collapsing to whatever is on screen.
 */
export default async function LibraryRail() {
  const db = await getDb();

  const [statusRows, formatRows, genreRows] = await Promise.all([
    db
      .select({ value: books.readStatus, count: sql<number>`count(*)` })
      .from(books)
      .groupBy(books.readStatus),
    db
      .select({ value: books.format, count: sql<number>`count(*)` })
      .from(books)
      .groupBy(books.format),
    // Ordered by how many books carry each genre, so the useful ones surface
    // first and the long tail of catalogue headings sinks.
    db
      .select({ value: books.genre, count: sql<number>`count(*)` })
      .from(books)
      .where(isNotNull(books.genre))
      .groupBy(books.genre)
      .orderBy(sql`count(*) desc`, books.genre),
  ]);

  const byValue = (rows: { value: string | null; count: number }[]) =>
    new Map(rows.map((r) => [r.value ?? "", r.count]));

  const statusCounts = byValue(statusRows);
  const formatCounts = byValue(formatRows);

  // Statuses and formats keep their canonical order and show even at zero, so
  // the list doesn't reshuffle as the library changes.
  const statuses: Facet[] = READ_STATUSES.map((s) => ({
    value: s,
    label: STATUS_LABEL[s] ?? s,
    count: statusCounts.get(s) ?? 0,
  }));

  const formats: Facet[] = BOOK_FORMATS.map((f) => ({
    value: f,
    label: f[0].toUpperCase() + f.slice(1),
    count: formatCounts.get(f) ?? 0,
  }));

  const genres: Facet[] = genreRows
    .filter((r) => Boolean(r.value))
    .map((r) => ({ value: r.value as string, label: r.value as string, count: r.count }));

  return <RailFilters statuses={statuses} formats={formats} genres={genres} />;
}
