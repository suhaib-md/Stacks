import { describe, expect, it } from "vitest";
import type { Book } from "@/db/schema";
import type { BookMetadata } from "@/lib/providers/types";
import { fillMissing, isIncomplete } from "./refresh";

const book = (over: Partial<Book> = {}): Book =>
  ({
    id: "id-1",
    isbn13: "9780306406157",
    isbn10: "0306406152",
    title: "Structures",
    subtitle: null,
    authors: JSON.stringify(["J. E. Gordon"]),
    publisher: null,
    publishedYear: null,
    pageCount: null,
    genre: null,
    tags: "[]",
    format: "paperback",
    language: null,
    description: null,
    coverUrl: null,
    coverColor: null,
    readStatus: "finished",
    currentPage: 0,
    rating: 5,
    notes: "My own note",
    startedAt: null,
    finishedAt: null,
    source: "scan",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as Book;

const metadata = (over: Partial<BookMetadata> = {}): BookMetadata => ({
  isbn13: "9780306406157",
  isbn10: "0306406152",
  title: "Provider Title",
  subtitle: "A Subtitle",
  authors: ["Provider Author"],
  publisher: "Da Capo",
  publishedYear: 2003,
  pageCount: 424,
  description: "Why things don't fall down.",
  coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
  categories: ["Engineering"],
  language: "en",
  source: "merged",
  ...over,
});

describe("fillMissing", () => {
  it("fills every empty field", () => {
    const { patch, filled } = fillMissing(book(), metadata());
    expect(patch).toMatchObject({
      subtitle: "A Subtitle",
      publisher: "Da Capo",
      publishedYear: 2003,
      pageCount: 424,
      description: "Why things don't fall down.",
      language: "en",
      genre: "Engineering",
    });
    expect(filled).toContain("pageCount");
  });

  it("never overwrites a value that is already there", () => {
    // The entire point: a refresh recovers gaps, it does not relitigate your edits.
    const existing = book({
      publisher: "My Publisher",
      pageCount: 999,
      description: "My description",
      genre: "My Genre",
    });
    const { patch, filled } = fillMissing(existing, metadata());

    expect(patch.publisher).toBeUndefined();
    expect(patch.pageCount).toBeUndefined();
    expect(patch.description).toBeUndefined();
    expect(patch.genre).toBeUndefined();
    expect(filled).not.toContain("publisher");
  });

  it("never touches title, authors, rating or notes", () => {
    const { patch } = fillMissing(book(), metadata());
    expect(patch).not.toHaveProperty("title");
    expect(patch).not.toHaveProperty("authors");
    expect(patch).not.toHaveProperty("rating");
    expect(patch).not.toHaveProperty("notes");
  });

  it("treats an empty string as missing", () => {
    const { filled } = fillMissing(book({ publisher: "   " }), metadata());
    expect(filled).toContain("publisher");
  });

  it("skips fields the provider also lacks", () => {
    const { patch, filled } = fillMissing(
      book(),
      metadata({ description: null, pageCount: null, categories: [] }),
    );
    expect(patch.description).toBeUndefined();
    expect(patch.pageCount).toBeUndefined();
    expect(patch.genre).toBeUndefined();
    expect(filled).not.toContain("description");
  });

  it("reports nothing filled when the book is already complete", () => {
    const complete = book({
      subtitle: "s",
      publisher: "p",
      publishedYear: 2000,
      pageCount: 100,
      description: "d",
      coverUrl: "https://example.com/c.jpg",
      language: "en",
      genre: "g",
    });
    expect(fillMissing(complete, metadata()).filled).toEqual([]);
  });
});

describe("isIncomplete", () => {
  const shape = (over: Partial<Parameters<typeof isIncomplete>[0]> = {}) => ({
    isbn13: "9780306406157",
    description: "d",
    pageCount: 100,
    coverUrl: "https://example.com/c.jpg",
    publisher: "p",
    ...over,
  });

  it("is false for a complete book", () => {
    expect(isIncomplete(shape())).toBe(false);
  });

  it("is true when any of the four is missing", () => {
    expect(isIncomplete(shape({ description: null }))).toBe(true);
    expect(isIncomplete(shape({ pageCount: null }))).toBe(true);
    expect(isIncomplete(shape({ coverUrl: null }))).toBe(true);
    expect(isIncomplete(shape({ publisher: null }))).toBe(true);
  });

  it("is false without an ISBN — there would be nothing to look up", () => {
    expect(isIncomplete(shape({ isbn13: null, description: null }))).toBe(false);
  });
});
