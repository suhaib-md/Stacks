import type { Book } from "@/db/schema";
import { parseStringArray } from "@/db/serde";

/**
 * CSV export — the backstop for everything else in this app (docs/backend-schema.md §7).
 *
 * Notes routinely contain commas, quotes AND newlines, which is exactly the
 * combination naive exporters get wrong, so quoting is not optional here.
 */

/** Excel reads a BOM-less UTF-8 file as the system codepage and mangles every accent. */
export const UTF8_BOM = "﻿";

export const CSV_COLUMNS = [
  "id",
  "isbn13",
  "isbn10",
  "title",
  "subtitle",
  "authors",
  "publisher",
  "published_year",
  "page_count",
  "genre",
  "tags",
  "format",
  "language",
  "read_status",
  "current_page",
  "rating",
  "notes",
  "started_at",
  "finished_at",
  "source",
  "created_at",
  "updated_at",
  "cover_url",
] as const;

/**
 * RFC 4180: quote when the value contains a comma, quote, CR or LF, and double
 * any inner quotes.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value);
  if (text.length === 0) return "";

  const needsQuoting = /[",\r\n]/.test(text);
  if (!needsQuoting) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(escapeCsvValue).join(",");
}

/**
 * Arrays are joined with "; " rather than exported as raw JSON — spreadsheets
 * handle that far better, and this file exists to be opened in one.
 */
function joinList(raw: string | null): string {
  return parseStringArray(raw).join("; ");
}

export function bookToCsvRow(book: Book): string {
  // `description` is deliberately omitted: it's provider data, not yours, and it
  // bloats the file. The ISBN is enough to recover it.
  return csvRow([
    book.id,
    book.isbn13,
    book.isbn10,
    book.title,
    book.subtitle,
    joinList(book.authors),
    book.publisher,
    book.publishedYear,
    book.pageCount,
    book.genre,
    joinList(book.tags),
    book.format,
    book.language,
    book.readStatus,
    book.currentPage,
    book.rating,
    book.notes,
    book.startedAt,
    book.finishedAt,
    book.source,
    book.createdAt,
    book.updatedAt,
    book.coverUrl,
  ]);
}

export function booksToCsv(books: readonly Book[]): string {
  // CRLF line endings, per RFC 4180 and what Excel expects.
  const lines = [csvRow(CSV_COLUMNS), ...books.map(bookToCsvRow)];
  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/** e.g. stacks-2026-08-05.csv */
export function csvFilename(now = new Date()): string {
  return `stacks-${now.toISOString().slice(0, 10)}.csv`;
}
