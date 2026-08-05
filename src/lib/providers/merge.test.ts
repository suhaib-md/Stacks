import { describe, expect, it } from "vitest";
import { isThin, mergeMetadata } from "./merge";
import type { BookMetadata } from "./types";

const base = (over: Partial<BookMetadata> = {}): BookMetadata => ({
  isbn13: "9780306406157",
  isbn10: "0306406152",
  title: "Title",
  subtitle: null,
  authors: [],
  publisher: null,
  publishedYear: null,
  pageCount: null,
  description: null,
  coverUrl: null,
  categories: [],
  language: null,
  source: "openlibrary",
  ...over,
});

describe("mergeMetadata", () => {
  it("returns null when neither provider found anything", () => {
    expect(mergeMetadata(null, null)).toBeNull();
  });

  it("passes a single provider straight through", () => {
    const ol = base({ title: "Only OL" });
    expect(mergeMetadata(ol, null)).toBe(ol);

    const gb = base({ title: "Only GB", source: "googlebooks" });
    expect(mergeMetadata(null, gb)).toBe(gb);
  });

  it("prefers Open Library for physical and publication data", () => {
    const merged = mergeMetadata(
      base({ publisher: "Da Capo", pageCount: 424, publishedYear: 2003 }),
      base({
        publisher: "Wrong Publisher",
        pageCount: 999,
        publishedYear: 1990,
        source: "googlebooks",
      }),
    );

    expect(merged).toMatchObject({
      publisher: "Da Capo",
      pageCount: 424,
      publishedYear: 2003,
      source: "merged",
    });
  });

  it("prefers Google Books for editorial data", () => {
    const merged = mergeMetadata(
      base({ description: null, categories: [], language: null }),
      base({
        description: "A real description.",
        categories: ["Fiction"],
        language: "en",
        source: "googlebooks",
      }),
    );

    expect(merged).toMatchObject({
      description: "A real description.",
      categories: ["Fiction"],
      language: "en",
    });
  });

  it("never lets an empty value overwrite a populated one", () => {
    const merged = mergeMetadata(
      base({ pageCount: null, authors: [] }),
      base({ pageCount: 300, authors: ["Someone"], source: "googlebooks" }),
    );

    // Open Library is preferred for these, but it had nothing — so Google fills in.
    expect(merged?.pageCount).toBe(300);
    expect(merged?.authors).toEqual(["Someone"]);
  });

  it("keeps the Open Library cover, which matches the physical edition", () => {
    const merged = mergeMetadata(
      base({ coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg" }),
      base({ coverUrl: "https://books.google.com/thumb", source: "googlebooks" }),
    );
    expect(merged?.coverUrl).toBe("https://covers.openlibrary.org/b/id/1-L.jpg");
  });

  it("marks a two-provider result as merged", () => {
    expect(mergeMetadata(base(), base({ source: "googlebooks" }))?.source).toBe("merged");
  });
});

describe("isThin", () => {
  it("treats a missing result as thin", () => {
    expect(isThin(null)).toBe(true);
  });

  it("flags records missing authors, pages, or description", () => {
    expect(isThin(base({ authors: [], pageCount: 300, description: "x" }))).toBe(true);
    expect(isThin(base({ authors: ["A"], pageCount: null, description: "x" }))).toBe(true);
    expect(isThin(base({ authors: ["A"], pageCount: 300, description: null }))).toBe(true);
  });

  it("passes a complete record, so no Google call is spent", () => {
    expect(isThin(base({ authors: ["A"], pageCount: 300, description: "x" }))).toBe(false);
  });
});
