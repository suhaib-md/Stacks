import { describe, expect, it } from "vitest";
import { mapGoogleVolume } from "./googlebooks";
import { mapOpenLibrary, mapOpenLibraryDoc } from "./openlibrary";

/**
 * Fixtures trimmed from real responses. The point of these tests is the ragged
 * edges — records missing pages, authors shaped unexpectedly, http image URLs —
 * because that is what actually turns up when cataloguing a real shelf.
 */

describe("mapOpenLibrary", () => {
  const ISBN = "9780306406157";

  const full = {
    [`ISBN:${ISBN}`]: {
      title: "Structures",
      subtitle: "Or Why Things Don't Fall Down",
      authors: [{ name: "J. E. Gordon", url: "https://openlibrary.org/authors/OL1A" }],
      number_of_pages: 424,
      publishers: [{ name: "Da Capo Press" }],
      publish_date: "July 2003",
      subjects: [{ name: "Structural engineering" }, { name: "Materials" }],
      cover: {
        small: "https://covers.openlibrary.org/b/id/1-S.jpg",
        large: "https://covers.openlibrary.org/b/id/1-L.jpg",
      },
      identifiers: { isbn_10: ["0306406152"], isbn_13: [ISBN] },
    },
  };

  it("maps a complete record", () => {
    const result = mapOpenLibrary(full, ISBN);
    expect(result).toMatchObject({
      isbn13: ISBN,
      isbn10: "0306406152",
      title: "Structures",
      subtitle: "Or Why Things Don't Fall Down",
      authors: ["J. E. Gordon"],
      publisher: "Da Capo Press",
      publishedYear: 2003,
      pageCount: 424,
      source: "openlibrary",
    });
    expect(result?.coverUrl).toBe("https://covers.openlibrary.org/b/id/1-L.jpg");
    expect(result?.categories).toEqual(["Structural engineering", "Materials"]);
  });

  it("returns null when the ISBN key is absent (a miss)", () => {
    expect(mapOpenLibrary({}, ISBN)).toBeNull();
    expect(mapOpenLibrary({ "ISBN:9999999999999": {} }, ISBN)).toBeNull();
  });

  it("returns null for a record with no title", () => {
    expect(mapOpenLibrary({ [`ISBN:${ISBN}`]: { publishers: [] } }, ISBN)).toBeNull();
  });

  it("survives a sparse record and still yields a cover", () => {
    const result = mapOpenLibrary({ [`ISBN:${ISBN}`]: { title: "Bare" } }, ISBN);
    expect(result).toMatchObject({
      title: "Bare",
      authors: [],
      publisher: null,
      pageCount: null,
      publishedYear: null,
    });
    // Falls back to the deterministic per-ISBN cover rather than nothing.
    expect(result?.coverUrl).toBe(`https://covers.openlibrary.org/b/isbn/${ISBN}-L.jpg`);
    // A 978 ISBN always has a derivable ISBN-10 even when not listed.
    expect(result?.isbn10).toBe("0306406152");
  });

  it("treats number_of_pages 0 as unknown", () => {
    const result = mapOpenLibrary(
      { [`ISBN:${ISBN}`]: { title: "Zero Pages", number_of_pages: 0 } },
      ISBN,
    );
    expect(result?.pageCount).toBeNull();
  });

  it("ignores malformed author and publisher entries", () => {
    const result = mapOpenLibrary(
      {
        [`ISBN:${ISBN}`]: {
          title: "Odd",
          authors: [{ name: "Real Author" }, { url: "no name here" }, "a bare string"],
          publishers: ["not an object"],
        },
      },
      ISBN,
    );
    expect(result?.authors).toEqual(["Real Author"]);
    expect(result?.publisher).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(mapOpenLibrary(null, ISBN)).toBeNull();
    expect(mapOpenLibrary("nope", ISBN)).toBeNull();
    expect(mapOpenLibrary([], ISBN)).toBeNull();
  });
});

describe("mapGoogleVolume", () => {
  it("maps a complete volume", () => {
    const result = mapGoogleVolume({
      volumeInfo: {
        title: "The Dispossessed",
        authors: ["Ursula K. Le Guin"],
        publisher: "Harper & Row",
        publishedDate: "1974-05-01",
        description: "An ambiguous utopia.",
        industryIdentifiers: [
          { type: "ISBN_10", identifier: "0060105712" },
          { type: "ISBN_13", identifier: "9780060105716" },
        ],
        pageCount: 341,
        categories: ["Fiction"],
        language: "en",
        imageLinks: {
          thumbnail: "http://books.google.com/books/content?id=1&edge=curl&zoom=1",
        },
      },
    });

    expect(result).toMatchObject({
      isbn13: "9780060105716",
      isbn10: "0060105712",
      title: "The Dispossessed",
      publishedYear: 1974,
      pageCount: 341,
      language: "en",
      source: "googlebooks",
    });
    // http would be blocked as mixed content; the curl overlay fakes a page fold.
    expect(result?.coverUrl).toBe(
      "https://books.google.com/books/content?id=1&zoom=1",
    );
  });

  it("treats pageCount 0 as unknown, not as zero pages", () => {
    // Real case: 9780345391803 (Hitchhiker's Guide) returns 0. Kept as 0 it
    // fails the min(1) validator on save AND beats the other provider's real
    // page count during the merge, because 0 is not null.
    const result = mapGoogleVolume({
      volumeInfo: { title: "Hitch Hiker's Guide", pageCount: 0 },
    });
    expect(result?.pageCount).toBeNull();
  });

  it("returns null without volumeInfo or title", () => {
    expect(mapGoogleVolume({})).toBeNull();
    expect(mapGoogleVolume({ volumeInfo: {} })).toBeNull();
    expect(mapGoogleVolume(null)).toBeNull();
  });

  it("tolerates a volume with no identifiers or images", () => {
    const result = mapGoogleVolume({ volumeInfo: { title: "Sparse" } });
    expect(result).toMatchObject({
      title: "Sparse",
      isbn13: null,
      isbn10: null,
      coverUrl: null,
      authors: [],
      categories: [],
    });
  });

  it("normalizes an ISBN-13 that arrives hyphenated", () => {
    const result = mapGoogleVolume({
      volumeInfo: {
        title: "Hyphenated",
        industryIdentifiers: [{ type: "ISBN_13", identifier: "978-0-06-010571-6" }],
      },
    });
    expect(result?.isbn13).toBe("9780060105716");
  });
});

describe("mapOpenLibraryDoc (search)", () => {
  it("maps a search doc and picks a usable ISBN", () => {
    const result = mapOpenLibraryDoc({
      title: "A Wizard of Earthsea",
      author_name: ["Ursula K. Le Guin"],
      first_publish_year: 1968,
      isbn: ["not-an-isbn", "0553383043"],
      number_of_pages_median: 183,
      publisher: ["Bantam"],
      cover_i: 8231856,
      language: ["eng"],
    });

    expect(result).toMatchObject({
      title: "A Wizard of Earthsea",
      authors: ["Ursula K. Le Guin"],
      publishedYear: 1968,
      pageCount: 183,
      publisher: "Bantam",
      language: "eng",
    });
    expect(result?.isbn13).toBe("9780553383041");
    expect(result?.coverUrl).toBe("https://covers.openlibrary.org/b/id/8231856-L.jpg");
  });

  it("handles a doc with no ISBN or cover", () => {
    const result = mapOpenLibraryDoc({ title: "Obscure Regional Edition" });
    expect(result).toMatchObject({ title: "Obscure Regional Edition", isbn13: null, coverUrl: null });
  });
});
