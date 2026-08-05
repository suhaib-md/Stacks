import { describe, expect, it } from "vitest";
import {
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
  isbn13To10,
  normalizeIsbnInput,
  parseIsbn,
  toIsbn13,
} from "./isbn";

/**
 * Real ISBNs from real books. Checksum code is exactly the kind that looks right
 * and is quietly wrong, so these are verified pairs rather than invented digits.
 */
const PAIRS: Array<{ isbn10: string; isbn13: string; note: string }> = [
  { isbn10: "0306406152", isbn13: "9780306406157", note: "standard" },
  { isbn10: "043942089X", isbn13: "9780439420891", note: "X check digit" },
  { isbn10: "080442957X", isbn13: "9780804429573", note: "X check digit" },
  { isbn10: "0140328726", isbn13: "9780140328721", note: "standard" },
];

describe("normalizeIsbnInput", () => {
  it("strips hyphens and spaces", () => {
    expect(normalizeIsbnInput("978-0-306-40615-7")).toBe("9780306406157");
    expect(normalizeIsbnInput(" 978 0306 406157 ")).toBe("9780306406157");
  });

  it("uppercases the ISBN-10 check character", () => {
    expect(normalizeIsbnInput("043942089x")).toBe("043942089X");
  });
});

describe("isValidIsbn10", () => {
  it.each(PAIRS)("accepts $isbn10 ($note)", ({ isbn10 }) => {
    expect(isValidIsbn10(isbn10)).toBe(true);
  });

  it("accepts hyphenated and lowercase-x input", () => {
    expect(isValidIsbn10("0-306-40615-2")).toBe(true);
    expect(isValidIsbn10("043942089x")).toBe(true);
  });

  it("rejects a bad check digit", () => {
    expect(isValidIsbn10("0306406153")).toBe(false);
  });

  it("rejects wrong lengths and stray letters", () => {
    expect(isValidIsbn10("030640615")).toBe(false);
    expect(isValidIsbn10("03064061522")).toBe(false);
    expect(isValidIsbn10("03064A6152")).toBe(false);
    // X is only legal in the final position.
    expect(isValidIsbn10("X306406152")).toBe(false);
  });
});

describe("isValidIsbn13", () => {
  it.each(PAIRS)("accepts $isbn13 ($note)", ({ isbn13 }) => {
    expect(isValidIsbn13(isbn13)).toBe(true);
  });

  it("accepts a 979-prefixed ISBN", () => {
    expect(isValidIsbn13("9791234567896")).toBe(true);
  });

  it("rejects a bad check digit", () => {
    expect(isValidIsbn13("9780306406158")).toBe(false);
  });

  it("rejects a checksum-valid EAN-13 that is not a book", () => {
    // Valid EAN-13, but not a Bookland prefix — scanning a cereal box must not
    // produce a lookup.
    expect(isValidIsbn13("4006381333931")).toBe(false);
  });

  it("rejects non-digits and wrong lengths", () => {
    expect(isValidIsbn13("978030640615")).toBe(false);
    expect(isValidIsbn13("978030640615X")).toBe(false);
  });
});

describe("isbn10To13", () => {
  it.each(PAIRS)("converts $isbn10 -> $isbn13 ($note)", ({ isbn10, isbn13 }) => {
    expect(isbn10To13(isbn10)).toBe(isbn13);
  });

  it("returns null for an invalid ISBN-10", () => {
    expect(isbn10To13("0306406153")).toBeNull();
  });
});

describe("isbn13To10", () => {
  it.each(PAIRS)("converts $isbn13 -> $isbn10 ($note)", ({ isbn10, isbn13 }) => {
    expect(isbn13To10(isbn13)).toBe(isbn10);
  });

  it("returns null for 979 — there is no 10-digit equivalent", () => {
    expect(isbn13To10("9791234567896")).toBeNull();
  });
});

describe("round trips", () => {
  it.each(PAIRS)("$isbn10 survives 10 -> 13 -> 10 ($note)", ({ isbn10 }) => {
    const thirteen = isbn10To13(isbn10);
    expect(thirteen).not.toBeNull();
    expect(isbn13To10(thirteen!)).toBe(isbn10);
  });
});

describe("toIsbn13", () => {
  it("normalizes every accepted input form to bare ISBN-13", () => {
    expect(toIsbn13("0306406152")).toBe("9780306406157");
    expect(toIsbn13("0-306-40615-2")).toBe("9780306406157");
    expect(toIsbn13("9780306406157")).toBe("9780306406157");
    expect(toIsbn13("978-0-306-40615-7")).toBe("9780306406157");
  });

  it("returns null for anything that is not a book ISBN", () => {
    expect(toIsbn13("4006381333931")).toBeNull();
    expect(toIsbn13("hello")).toBeNull();
    expect(toIsbn13("")).toBeNull();
  });
});

describe("parseIsbn", () => {
  it("returns both forms for a 978 ISBN", () => {
    expect(parseIsbn("0306406152")).toEqual({
      isbn13: "9780306406157",
      isbn10: "0306406152",
    });
  });

  it("returns a null isbn10 for a 979 ISBN", () => {
    expect(parseIsbn("9791234567896")).toEqual({
      isbn13: "9791234567896",
      isbn10: null,
    });
  });

  it("returns null for invalid input", () => {
    expect(parseIsbn("9780306406158")).toBeNull();
  });
});

