import { describe, expect, it } from "vitest";
import type { Book } from "@/db/schema";
import { UTF8_BOM, bookToCsvRow, booksToCsv, csvFilename, escapeCsvValue } from "./csv";

const book = (over: Partial<Book> = {}): Book =>
  ({
    id: "id-1",
    isbn13: "9780306406157",
    isbn10: "0306406152",
    title: "Structures",
    subtitle: null,
    authors: JSON.stringify(["J. E. Gordon"]),
    publisher: "Da Capo",
    publishedYear: 2003,
    pageCount: 424,
    genre: "Engineering",
    tags: JSON.stringify(["cabinet-one", "loaned"]),
    format: "paperback",
    language: "en",
    description: "Long provider blurb that must not appear in the export.",
    coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
    coverColor: "#7a4b2a",
    readStatus: "finished",
    currentPage: 424,
    rating: 5,
    notes: null,
    startedAt: "2026-01-01",
    finishedAt: "2026-02-01",
    source: "scan",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...over,
  }) as Book;

describe("escapeCsvValue", () => {
  it("leaves ordinary values alone", () => {
    expect(escapeCsvValue("Structures")).toBe("Structures");
    expect(escapeCsvValue(424)).toBe("424");
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("quotes values containing a comma", () => {
    expect(escapeCsvValue("Gordon, J. E.")).toBe('"Gordon, J. E."');
  });

  it("doubles inner quotes", () => {
    expect(escapeCsvValue('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("quotes values containing newlines", () => {
    expect(escapeCsvValue("line one\nline two")).toBe('"line one\nline two"');
    expect(escapeCsvValue("crlf\r\nhere")).toBe('"crlf\r\nhere"');
  });

  it("handles the combination that breaks naive exporters", () => {
    // A real note: comma, quote and newline together.
    const notes = 'Lent to S, who said "keep it".\nStill waiting.';
    expect(escapeCsvValue(notes)).toBe(
      '"Lent to S, who said ""keep it"".\nStill waiting."',
    );
  });

  it("preserves a leading zero rather than treating values as numbers", () => {
    expect(escapeCsvValue("0306406152")).toBe("0306406152");
  });
});

describe("bookToCsvRow", () => {
  it("joins arrays with a semicolon rather than emitting JSON", () => {
    const row = bookToCsvRow(book());
    expect(row).toContain("J. E. Gordon");
    expect(row).toContain("cabinet-one; loaned");
    expect(row).not.toContain("[");
  });

  it("omits the provider description", () => {
    expect(bookToCsvRow(book())).not.toContain("Long provider blurb");
  });

  it("escapes a title containing a comma", () => {
    expect(bookToCsvRow(book({ title: "Cakes, and how to bake them" }))).toContain(
      '"Cakes, and how to bake them"',
    );
  });

  it("emits empty fields for nulls, keeping column alignment", () => {
    const row = bookToCsvRow(
      book({ isbn13: null, isbn10: null, publisher: null, rating: null, subtitle: null }),
    );
    expect(row.split(",").length).toBeGreaterThanOrEqual(23);
    expect(row.startsWith("id-1,,,Structures,,")).toBe(true);
  });

  it("survives a book whose author list is malformed", () => {
    expect(bookToCsvRow(book({ authors: "not json" }))).toBeTypeOf("string");
  });
});

describe("booksToCsv", () => {
  it("starts with a BOM so Excel reads it as UTF-8", () => {
    expect(booksToCsv([]).startsWith(UTF8_BOM)).toBe(true);
    expect(booksToCsv([]).charCodeAt(0)).toBe(0xfeff);
  });

  it("writes a header even with no books", () => {
    const csv = booksToCsv([]);
    expect(csv).toContain("id,isbn13,isbn10,title");
  });

  it("uses CRLF line endings", () => {
    const csv = booksToCsv([book()]);
    expect(csv).toContain("\r\n");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("emits one line per book plus the header", () => {
    const csv = booksToCsv([book({ id: "a" }), book({ id: "b" })]);
    // A note containing a newline would break naive line counting, so use a
    // book set without one here.
    expect(csv.trimEnd().split("\r\n")).toHaveLength(3);
  });

  it("keeps a multiline note inside one quoted field", () => {
    const csv = booksToCsv([book({ notes: "first\nsecond" })]);
    expect(csv).toContain('"first\nsecond"');
  });
});

describe("csvFilename", () => {
  it("is dated, so successive backups don't overwrite each other", () => {
    expect(csvFilename(new Date("2026-08-05T10:00:00Z"))).toBe("stacks-2026-08-05.csv");
  });
});
