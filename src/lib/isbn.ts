/**
 * ISBN validation, conversion, and normalization.
 *
 * Everything stored or compared in this app is a bare ISBN-13 (digits only) —
 * see docs/backend-schema.md. ISBN-10 is kept alongside only because older and
 * regional editions are printed with it and it helps when searching by hand.
 */

/** Strip formatting and uppercase the ISBN-10 check character. */
export function normalizeIsbnInput(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIsbn10(raw: string): boolean {
  const s = normalizeIsbnInput(raw);
  if (!/^\d{9}[\dX]$/.test(s)) return false;

  // Weights descend 10..1; the check character X counts as 10.
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const char = s[i];
    const value = char === "X" ? 10 : Number(char);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(raw: string): boolean {
  const s = normalizeIsbnInput(raw);
  if (!/^\d{13}$/.test(s)) return false;

  // Only Bookland prefixes are books. Other EAN-13s (groceries, magazines with
  // issue codes) are valid barcodes but must never reach a metadata lookup.
  if (!s.startsWith("978") && !s.startsWith("979")) return false;

  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

export function isValidIsbn(raw: string): boolean {
  return isValidIsbn10(raw) || isValidIsbn13(raw);
}

function isbn13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

function isbn10CheckChar(first9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(first9[i]) * (10 - i);
  }
  const remainder = (11 - (sum % 11)) % 11;
  return remainder === 10 ? "X" : String(remainder);
}

export function isbn10To13(raw: string): string | null {
  const s = normalizeIsbnInput(raw);
  if (!isValidIsbn10(s)) return null;
  const body = `978${s.slice(0, 9)}`;
  return body + isbn13CheckDigit(body);
}

/**
 * Only 978-prefixed ISBN-13s have an ISBN-10 equivalent. 979 was allocated after
 * the 10-digit space was exhausted, so there is nothing to convert back to.
 */
export function isbn13To10(raw: string): string | null {
  const s = normalizeIsbnInput(raw);
  if (!isValidIsbn13(s)) return null;
  if (!s.startsWith("978")) return null;
  const body = s.slice(3, 12);
  return body + isbn10CheckChar(body);
}

/** The canonical storage form: bare ISBN-13, or null if the input isn't a book ISBN. */
export function toIsbn13(raw: string): string | null {
  const s = normalizeIsbnInput(raw);
  if (isValidIsbn13(s)) return s;
  if (isValidIsbn10(s)) return isbn10To13(s);
  return null;
}

export type ParsedIsbn = { isbn13: string; isbn10: string | null };

/** Parse any accepted input into both forms. Returns null for anything invalid. */
export function parseIsbn(raw: string): ParsedIsbn | null {
  const isbn13 = toIsbn13(raw);
  if (!isbn13) return null;
  return { isbn13, isbn10: isbn13To10(isbn13) };
}

/*
 * Deliberately no formatIsbn13().
 *
 * Correct ISBN hyphenation (978-0-306-40615-7) needs the ISBN range tables: the
 * registration-group and registrant elements are variable-width, so any fixed
 * split is wrong for a large share of real ISBNs. A confidently wrong grouping
 * is worse than none, and the table is ~200KB. Display the bare digits.
 */
