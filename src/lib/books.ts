import { z } from "zod";
import {
  BOOK_FORMATS,
  BOOK_SOURCES,
  READ_STATUSES,
  type Book,
  type ReadStatus,
} from "@/db/schema";
import { parseStringArray } from "@/db/serde";

/** Wire shape: arrays are real arrays, not the JSON-in-text the column stores. */
export type ApiBook = Omit<Book, "authors" | "tags"> & {
  authors: string[];
  tags: string[];
};

export function toApiBook(row: Book): ApiBook {
  return {
    ...row,
    authors: parseStringArray(row.authors),
    tags: parseStringArray(row.tags),
  };
}

/** For create: an absent optional text field means "no value", i.e. null. */
const nullableText = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => (v && v.length > 0 ? v : null));

/**
 * For update: absent must stay absent so the PATCH handler leaves the column
 * alone. Only an explicit null or "" clears it. Using nullableText here would
 * blank subtitle, publisher, genre, language, description and notes on every
 * partial update.
 */
const patchableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v && v.length > 0 ? v : null));

export const createBookSchema = z.object({
  isbn13: z.string().trim().nullish(),
  isbn10: z.string().trim().nullish(),
  // `error` covers the missing-field case too; .min() alone only fires once the
  // value is already a string, so an absent title got Zod's raw type message.
  title: z
    .string({ error: "A title is required." })
    .trim()
    .min(1, "A title is required.")
    .max(500),
  subtitle: nullableText(500),
  authors: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  publisher: nullableText(300),
  publishedYear: z.number().int().min(1000).max(2200).nullish(),
  pageCount: z.number().int().min(1).max(50_000).nullish(),
  genre: nullableText(100),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  format: z.enum(BOOK_FORMATS).default("paperback"),
  language: nullableText(20),
  description: nullableText(10_000),
  coverUrl: z.string().trim().url().max(2000).nullish(),
  readStatus: z.enum(READ_STATUSES).default("unread"),
  rating: z.number().int().min(1).max(5).nullish(),
  notes: nullableText(20_000),
  source: z.enum(BOOK_SOURCES).default("manual"),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;

/**
 * PATCH schema, written out rather than derived from createBookSchema.
 *
 * `createBookSchema.partial()` looks equivalent and is not: Zod applies a
 * field's `.default()` when the key is absent, so a partial derived from it
 * silently rewrote readStatus, format, authors and tags to their defaults on
 * every update. Absent must mean "leave alone" here, so no field may carry a
 * default.
 */
export const updateBookSchema = z.object({
  isbn13: z.string().trim().nullish(),
  isbn10: z.string().trim().nullish(),
  title: z.string().trim().min(1, "A title is required.").max(500).optional(),
  subtitle: patchableText(500),
  authors: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  publisher: patchableText(300),
  publishedYear: z.number().int().min(1000).max(2200).nullish(),
  pageCount: z.number().int().min(1).max(50_000).nullish(),
  genre: patchableText(100),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  format: z.enum(BOOK_FORMATS).optional(),
  language: patchableText(20),
  description: patchableText(10_000),
  coverUrl: z.string().trim().url().max(2000).nullish(),
  readStatus: z.enum(READ_STATUSES).optional(),
  rating: z.number().int().min(1).max(5).nullish(),
  notes: patchableText(20_000),
  currentPage: z.number().int().min(0).max(100_000).optional(),
  // Written by the client-side extractor on first view of a detail page, and by
  // nothing else. Not part of create: it is derived from the cover.
  coverColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Expected a #RRGGBB colour.")
    .nullish(),
});

export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const bulkPatchSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
  patch: z.object({
    readStatus: z.enum(READ_STATUSES).optional(),
    addTags: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
    genre: z.string().trim().max(100).nullish(),
    // Null clears. Rating one book at a time meant 61 finished books stayed
    // unrated; this is the only way it realistically happens.
    rating: z.number().int().min(1).max(5).nullish(),
  }),
});

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Status-transition side effects, applied server-side so they hold no matter
 * which surface triggered the change (docs/trd.md §6).
 *
 * Returns only the derived columns; the caller merges them over the explicit
 * patch, so a user who sets a date by hand still wins.
 */
export function deriveStatusChanges(
  current: Pick<Book, "readStatus" | "startedAt" | "finishedAt" | "currentPage" | "pageCount">,
  nextStatus: ReadStatus | undefined,
  nextPageCount: number | null | undefined,
): Partial<Book> {
  if (!nextStatus || nextStatus === current.readStatus) return {};

  const pageCount = nextPageCount ?? current.pageCount;
  const changes: Partial<Book> = {};

  switch (nextStatus) {
    case "reading":
      if (!current.startedAt) changes.startedAt = todayIso();
      break;

    case "finished":
      if (!current.finishedAt) changes.finishedAt = todayIso();
      // Finishing implies you reached the end; without this the progress bar
      // sits at 40% on a book you've read.
      if (pageCount) changes.currentPage = pageCount;
      break;

    case "dnf":
      if (!current.finishedAt) changes.finishedAt = todayIso();
      break;

    case "unread":
      // Dates are deliberately preserved — an accidental status tap must not
      // destroy reading history.
      changes.currentPage = 0;
      break;
  }

  return changes;
}

/** current_page is meaningless outside [0, pageCount]. */
export function clampPage(page: number, pageCount: number | null | undefined): number {
  if (!Number.isFinite(page) || page < 0) return 0;
  if (pageCount && page > pageCount) return pageCount;
  return Math.trunc(page);
}

/**
 * Collapse a title to something comparable across editions: case, accents,
 * punctuation, and a leading article are all noise when asking "do I own this?".
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    // NFKD splits "é" into "e" + a combining acute. The mark must be DELETED
    // here; letting the punctuation rule below turn it into a space would split
    // "misérables" into "mise rables".
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Surname is the stable part — "Ursula K. Le Guin" vs "Le Guin, Ursula K.". */
export function authorKey(author: string): string {
  const cleaned = author
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned.includes(",")) return cleaned.split(",")[0].trim();
  const parts = cleaned.split(" ");
  return parts[parts.length - 1];
}

/**
 * A soft duplicate: same normalized title AND an overlapping author surname.
 * Title alone is too eager — "Selected Poems" collides constantly.
 */
export function isProbableDuplicate(
  a: { title: string; authors: string[] },
  b: { title: string; authors: string[] },
): boolean {
  if (normalizeTitle(a.title) !== normalizeTitle(b.title)) return false;

  const aKeys = new Set(a.authors.map(authorKey).filter(Boolean));
  const bKeys = b.authors.map(authorKey).filter(Boolean);

  // If either side has no usable author, the title match alone carries it.
  if (aKeys.size === 0 || bKeys.length === 0) return true;

  return bKeys.some((key) => aKeys.has(key));
}
