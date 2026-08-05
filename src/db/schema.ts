import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Conventions (see docs/backend-schema.md):
 * - ids are app-generated UUID v4
 * - datetimes are ISO-8601 UTC strings; reading dates are YYYY-MM-DD (day precision)
 * - authors/tags are JSON-encoded text arrays, accessed only via helpers in ./serde
 */

export const BOOK_FORMATS = ["paperback", "hardcover", "ebook", "other"] as const;
export const READ_STATUSES = ["unread", "reading", "finished", "dnf"] as const;
export const BOOK_SOURCES = ["scan", "search", "manual"] as const;

export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),

    // Normalized to ISBN-13, digits only. Nullable: plenty of books have no barcode.
    isbn13: text("isbn13"),
    isbn10: text("isbn10"),

    title: text("title").notNull(),
    subtitle: text("subtitle"),
    authors: text("authors").notNull().default("[]"),
    publisher: text("publisher"),
    publishedYear: integer("published_year"),
    pageCount: integer("page_count"),

    genre: text("genre"),
    tags: text("tags").notNull().default("[]"),
    format: text("format", { enum: BOOK_FORMATS }).notNull().default("paperback"),
    language: text("language"),
    description: text("description"),

    coverUrl: text("cover_url"),
    coverColor: text("cover_color"),

    readStatus: text("read_status", { enum: READ_STATUSES }).notNull().default("unread"),
    currentPage: integer("current_page").notNull().default(0),
    rating: integer("rating"),
    notes: text("notes"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),

    source: text("source", { enum: BOOK_SOURCES }).notNull().default("manual"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    // NULLs are distinct in SQLite unique indexes, so many ISBN-less books coexist.
    uniqueIndex("books_isbn13_unq").on(t.isbn13),
    index("books_title_idx").on(t.title),
    index("books_status_idx").on(t.readStatus),
    index("books_created_idx").on(t.createdAt),
    index("books_finished_idx").on(t.finishedAt),

    check("books_rating_chk", sql`${t.rating} IS NULL OR (${t.rating} BETWEEN 1 AND 5)`),
    check("books_current_page_chk", sql`${t.currentPage} >= 0`),
    check("books_format_chk", sql`${t.format} IN ('paperback','hardcover','ebook','other')`),
    check("books_status_chk", sql`${t.readStatus} IN ('unread','reading','finished','dnf')`),
    check("books_source_chk", sql`${t.source} IN ('scan','search','manual')`),
  ],
);

/**
 * Pure cache of external metadata lookups. Dropping it costs nothing but re-fetches.
 * Negative results are cached too (found = 0) with a short TTL — that is what keeps
 * Google Books inside its quota.
 */
export const lookupCache = sqliteTable("lookup_cache", {
  isbn13: text("isbn13").primaryKey(),
  payload: text("payload"),
  found: integer("found").notNull().default(0),
  provider: text("provider"),
  fetchedAt: text("fetched_at").notNull(),
  expiresAt: text("expires_at"),
});

/** Preferences that should follow the user across devices. Device-local prefs stay in localStorage. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Login throttling. Keyed by client IP; rows older than the window are swept on write. */
export const authAttempts = sqliteTable("auth_attempts", {
  ip: text("ip").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: text("window_start").notNull(),
});

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type LookupCacheRow = typeof lookupCache.$inferSelect;

export type BookFormat = (typeof BOOK_FORMATS)[number];
export type ReadStatus = (typeof READ_STATUSES)[number];
export type BookSource = (typeof BOOK_SOURCES)[number];
