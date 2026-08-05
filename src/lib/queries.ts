import { and, asc, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { books, type Book } from "@/db/schema";

/**
 * One definition of "what the library query means", shared by the page and by
 * /api/books. Two copies of this would drift the moment a filter changes.
 */

export type LibraryFilters = {
  q: string | null;
  status: Book["readStatus"] | null;
  genre: string | null;
  format: Book["format"] | null;
  sort: keyof typeof SORT_COLUMNS;
  order: "asc" | "desc";
  page: number;
  perPage: number;
  view: "grid" | "list";
};

const SORT_COLUMNS = {
  created: books.createdAt,
  title: books.title,
  author: books.authors,
  rating: books.rating,
  finished: books.finishedAt,
} as const;

const STATUSES = new Set(["unread", "reading", "finished", "dnf"]);
const FORMATS = new Set(["paperback", "hardcover", "ebook", "other"]);

type ParamSource = { get(key: string): string | null };

export function parseFilters(
  params: ParamSource,
  defaults: { view?: "grid" | "list" } = {},
): LibraryFilters {
  const status = params.get("status");
  const format = params.get("format");
  const requestedSort = params.get("sort");
  const view = params.get("view") ?? defaults.view ?? "grid";

  // Filtering to Finished is asking "what have I read?", and that question is
  // ordered by when you finished — not by when the book was catalogued. An
  // explicit ?sort= still wins.
  const fallbackSort = status === "finished" ? "finished" : "created";

  return {
    q: params.get("q")?.trim() || null,
    status: status && STATUSES.has(status) ? (status as Book["readStatus"]) : null,
    genre: params.get("genre")?.trim() || null,
    format: format && FORMATS.has(format) ? (format as Book["format"]) : null,
    sort:
      requestedSort && requestedSort in SORT_COLUMNS
        ? (requestedSort as keyof typeof SORT_COLUMNS)
        : fallbackSort,
    order: params.get("order") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
    perPage: Math.min(
      100,
      Math.max(1, Number.parseInt(params.get("perPage") ?? "60", 10) || 60),
    ),
    view: view === "list" ? "list" : "grid",
  };
}

export function bookWhere(filters: LibraryFilters): SQL | undefined {
  const clauses: SQL[] = [];

  if (filters.q) {
    const needle = `%${filters.q.toLowerCase()}%`;
    // LIKE over a few hundred rows is fine; the upgrade path is an FTS5 virtual
    // table, not a rewrite. `authors` is JSON text, so this searches it as text.
    const match = or(
      like(sql`lower(${books.title})`, needle),
      like(sql`lower(${books.authors})`, needle),
      like(sql`lower(${books.notes})`, needle),
    );
    if (match) clauses.push(match);
  }

  if (filters.status) clauses.push(eq(books.readStatus, filters.status));
  if (filters.genre) clauses.push(eq(books.genre, filters.genre));
  if (filters.format) clauses.push(eq(books.format, filters.format));

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export function bookOrder(filters: LibraryFilters) {
  const column = SORT_COLUMNS[filters.sort];
  return filters.order === "asc" ? asc(column) : desc(column);
}

export function hasActiveFilters(filters: LibraryFilters): boolean {
  return Boolean(filters.q || filters.status || filters.genre || filters.format);
}
