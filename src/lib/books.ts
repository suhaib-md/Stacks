import { z } from "zod";
import {
  BOOK_FORMATS,
  BOOK_SOURCES,
  READ_STATUSES,
  type Book,
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

const nullableText = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => (v && v.length > 0 ? v : null));

export const createBookSchema = z.object({
  isbn13: z.string().trim().nullish(),
  isbn10: z.string().trim().nullish(),
  title: z.string().trim().min(1, "A title is required.").max(500),
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
