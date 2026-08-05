# Stacks — Backend Schema (v1)

**Companion to:** [TRD](trd.md)
**Database:** Cloudflare D1 (SQLite) · **ORM:** Drizzle
**Last updated:** 2026-08-05

---

## 1. Conventions

- **IDs** — UUID v4 stored as `text`. Generated in the app (`crypto.randomUUID()`), never by the database.
- **Timestamps** — ISO-8601 UTC strings (`2026-08-05T14:32:11.000Z`) in `text` columns. SQLite has no date type; ISO text sorts chronologically as a string and exports to CSV unambiguously.
- **Dates without time** — `YYYY-MM-DD` for `started_at` / `finished_at`. A reading date has day precision; storing a spurious timestamp implies accuracy that isn't there.
- **Enums** — `text` with a `CHECK` constraint. Validated in the app with Zod as well; the constraint is the backstop.
- **Arrays** — JSON-encoded `text` (`["Ursula K. Le Guin"]`). Always accessed through typed helpers, never parsed inline at call sites.
- **Booleans** — `integer` 0/1 (none in v1, but the convention is fixed now).
- **Naming** — `snake_case` columns, `camelCase` in the Drizzle model, mapped explicitly.

---

## 2. Table: `books`

The only table that matters.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | text | no | — | PK, UUID v4 |
| `isbn13` | text | yes | — | Normalized, digits only. **Unique** when non-null |
| `isbn10` | text | yes | — | Digits + possible trailing `X` |
| `title` | text | no | — | Required — the only required field |
| `subtitle` | text | yes | — | |
| `authors` | text | no | `'[]'` | JSON array of strings |
| `publisher` | text | yes | — | |
| `published_year` | integer | yes | — | Year only; publishers rarely agree on exact dates |
| `page_count` | integer | yes | — | Null when unknown; progress bar hides |
| `genre` | text | yes | — | Single primary genre, user-owned |
| `tags` | text | no | `'[]'` | JSON array of strings, user-owned |
| `format` | text | no | `'paperback'` | `paperback` \| `hardcover` \| `ebook` \| `other` |
| `language` | text | yes | — | ISO 639-1 where known |
| `description` | text | yes | — | From the provider; rendered as plain text |
| `cover_url` | text | yes | — | Remote URL; images are never hosted |
| `cover_color` | text | yes | — | Cached dominant hex, `#RRGGBB` |
| `read_status` | text | no | `'unread'` | `unread` \| `reading` \| `finished` \| `dnf` |
| `current_page` | integer | no | `0` | Clamped to `[0, page_count]` when page_count known |
| `rating` | integer | yes | — | 1–5, null when unrated |
| `notes` | text | yes | — | Private, free-form |
| `started_at` | text | yes | — | `YYYY-MM-DD` |
| `finished_at` | text | yes | — | `YYYY-MM-DD` |
| `source` | text | no | `'manual'` | `scan` \| `search` \| `manual` — how it entered the library |
| `created_at` | text | no | — | ISO datetime, set on insert |
| `updated_at` | text | no | — | ISO datetime, set on every write |

### Indexes

| Index | Columns | Serves |
|---|---|---|
| `books_isbn13_unq` | `isbn13` (unique) | Dedup on add — the correctness guarantee, not just the fast path |
| `books_title_idx` | `title` | Title sort and search |
| `books_status_idx` | `read_status` | Status filter, Currently Reading strip |
| `books_created_idx` | `created_at` | Default sort (recently added first) |
| `books_finished_idx` | `finished_at` | Reading-history view |

SQLite treats `NULL`s as distinct in a unique index, so multiple books with no ISBN coexist happily under `books_isbn13_unq`. This is exactly the behavior needed for the manual-entry path.

### Drizzle definition

```ts
// src/db/schema.ts
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id:            text('id').primaryKey(),
  isbn13:        text('isbn13'),
  isbn10:        text('isbn10'),
  title:         text('title').notNull(),
  subtitle:      text('subtitle'),
  authors:       text('authors').notNull().default('[]'),
  publisher:     text('publisher'),
  publishedYear: integer('published_year'),
  pageCount:     integer('page_count'),
  genre:         text('genre'),
  tags:          text('tags').notNull().default('[]'),
  format:        text('format', { enum: ['paperback','hardcover','ebook','other'] })
                   .notNull().default('paperback'),
  language:      text('language'),
  description:   text('description'),
  coverUrl:      text('cover_url'),
  coverColor:    text('cover_color'),
  readStatus:    text('read_status', { enum: ['unread','reading','finished','dnf'] })
                   .notNull().default('unread'),
  currentPage:   integer('current_page').notNull().default(0),
  rating:        integer('rating'),
  notes:         text('notes'),
  startedAt:     text('started_at'),
  finishedAt:    text('finished_at'),
  source:        text('source', { enum: ['scan','search','manual'] })
                   .notNull().default('manual'),
  createdAt:     text('created_at').notNull(),
  updatedAt:     text('updated_at').notNull(),
}, (t) => ({
  isbn13Unq:  uniqueIndex('books_isbn13_unq').on(t.isbn13),
  titleIdx:   index('books_title_idx').on(t.title),
  statusIdx:  index('books_status_idx').on(t.readStatus),
  createdIdx: index('books_created_idx').on(t.createdAt),
  finishedIdx:index('books_finished_idx').on(t.finishedAt),
}));

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
```

CHECK constraints on `rating BETWEEN 1 AND 5`, `current_page >= 0`, and the enum columns are added in the migration SQL — Drizzle's `enum` option is a TypeScript-level convenience and does not emit a database constraint on its own.

---

## 3. Table: `lookup_cache`

Every ISBN lookup result, so a re-scan never re-hits an external API. Directly serves NFR-2 and the Google Books quota risk.

| Column | Type | Null | Notes |
|---|---|---|---|
| `isbn13` | text | no | PK, normalized |
| `payload` | text | yes | JSON-serialized `BookMetadata`; null for a negative result |
| `found` | integer | no | 0/1 — distinguishes "not found" from "not yet looked up" |
| `provider` | text | yes | `openlibrary` \| `googlebooks` \| `merged` |
| `fetched_at` | text | no | ISO datetime |
| `expires_at` | text | yes | ISO datetime; null = never expires |

**TTL policy** — positive results never expire (book metadata is effectively immutable). Negative results expire after 7 days, so a book that later gets indexed is eventually picked up. A row is treated as a miss when `expires_at` is non-null and in the past.

This table is a pure cache. Dropping it costs nothing but re-fetches.

---

## 4. Table: `settings`

Flat key-value store for preferences that need to outlive the browser.

| Column | Type | Null | Notes |
|---|---|---|---|
| `key` | text | no | PK |
| `value` | text | no | JSON-encoded |
| `updated_at` | text | no | ISO datetime |

v1 keys: `theme` (`system`\|`light`\|`dark`), `default_view` (`grid`\|`list`), `last_used_format`. Device-local preferences stay in `localStorage`; this table is for anything that should follow the user across devices.

Present in v1 mainly so future features (reading goals, defaults) don't require a migration.

---

## 5. Query patterns

### Library list with filters
```sql
SELECT * FROM books
WHERE (:q IS NULL OR title LIKE :q OR authors LIKE :q OR notes LIKE :q)
  AND (:status IS NULL OR read_status = :status)
  AND (:genre  IS NULL OR genre = :genre)
  AND (:format IS NULL OR format = :format)
ORDER BY /* created_at | title | authors | rating | finished_at */ DESC
LIMIT :perPage OFFSET :offset;
```
Built with Drizzle's conditional `and(...)` composition. `LIKE '%term%'` on a single-user library is entirely adequate; if it ever isn't, the upgrade is an FTS5 virtual table, not a rewrite.

### Currently reading
```sql
SELECT * FROM books WHERE read_status = 'reading' ORDER BY updated_at DESC;
```

### Dedup check on add
1. Exact: `SELECT id, title FROM books WHERE isbn13 = ?` → 409 on hit.
2. Fuzzy: normalize title (lowercase, strip punctuation and leading articles) and compare against a normalized-title `LIKE`, then compare first-author surname. On a hit, create the book but return a `POSSIBLE_DUPLICATE` warning.

### Bulk update
One `db.batch([...])` call — a single D1 round trip, applied atomically.

---

## 6. Migrations

```
drizzle/
  0000_initial.sql        books + indexes + CHECK constraints
  0001_lookup_cache.sql   lookup_cache
  0002_settings.sql       settings
  meta/_journal.json
```

```bash
npx drizzle-kit generate                                # after editing schema.ts
npx wrangler d1 migrations apply stacks-db --local      # verify locally
npx wrangler d1 migrations apply stacks-db --remote     # then production
```

**Rules:**
- A migration applied to production is never edited. Fix forward with a new one.
- Prefer additive changes. SQLite's `ALTER TABLE` is limited; column removal or type changes mean a table rebuild, which is worth avoiding by adding columns nullable in the first place.
- Back up before any destructive migration: `wrangler d1 export stacks-db --remote --output backup.sql`.

---

## 7. CSV export format

One row per book. Columns, in order:

```
id, isbn13, isbn10, title, subtitle, authors, publisher, published_year,
page_count, genre, tags, format, language, read_status, current_page,
rating, notes, started_at, finished_at, source, created_at, updated_at, cover_url
```

- `authors` and `tags` are joined with `; ` (semicolon-space) rather than exported as raw JSON — spreadsheets handle that far better.
- Fields containing commas, quotes, or newlines are quoted with inner quotes doubled, per RFC 4180. Notes routinely contain all three; this is the field that breaks naive exporters.
- UTF-8 with a BOM, so Excel doesn't mangle non-ASCII titles.
- `description` is omitted — it is provider data, not user data, and it bloats the file. The ISBN is enough to recover it.

---

## 8. Future schema (post-v1, not built)

Recorded so v1 choices don't block them. None require changing existing columns:

| Feature | Change |
|---|---|
| Location tracking | New `locations` table + `books.location_id` |
| Lending | New `loans` table (book_id, person, lent_at, returned_at) |
| Wishlist | `books.owned` boolean, or a separate `wishlist` table |
| Series | `books.series_name` + `series_position` columns |
| Reading sessions / streaks | New `reading_sessions` table (book_id, date, pages_read) |
| Quotes | New `quotes` table (book_id, text, page, created_at) |

All additive. The v1 schema does not need to anticipate them beyond staying flat and nullable.

---

## 9. Related documents

- [PRD](prd.md) · [TRD](trd.md) · [App Flow](app-flow.md) · [UI/UX Spec](uiux.md) · [Implementation Plan](implementation-plan.md)
