import { describe, expect, it } from "vitest";
import {
  authorKey,
  clampPage,
  deriveStatusChanges,
  isProbableDuplicate,
  normalizeTitle,
  updateBookSchema,
} from "./books";

const TODAY = new Date().toISOString().slice(0, 10);

const state = (over: Partial<Parameters<typeof deriveStatusChanges>[0]> = {}) => ({
  readStatus: "unread" as const,
  startedAt: null,
  finishedAt: null,
  currentPage: 0,
  pageCount: 300,
  ...over,
});

describe("deriveStatusChanges", () => {
  it("does nothing when the status is unchanged or absent", () => {
    expect(deriveStatusChanges(state(), undefined, null)).toEqual({});
    expect(deriveStatusChanges(state({ readStatus: "reading" }), "reading", null)).toEqual({});
  });

  it("stamps startedAt on the first move to reading", () => {
    expect(deriveStatusChanges(state(), "reading", null)).toEqual({ startedAt: TODAY });
  });

  it("does not overwrite an existing startedAt", () => {
    const changes = deriveStatusChanges(
      state({ readStatus: "unread", startedAt: "2020-01-01" }),
      "reading",
      null,
    );
    expect(changes.startedAt).toBeUndefined();
  });

  it("finishing stamps the date and completes progress", () => {
    // Otherwise the bar sits at 40% on a book you've read.
    expect(deriveStatusChanges(state({ readStatus: "reading", currentPage: 120 }), "finished", null))
      .toEqual({ finishedAt: TODAY, currentPage: 300 });
  });

  it("finishing a book with unknown length leaves progress alone", () => {
    expect(
      deriveStatusChanges(state({ readStatus: "reading", pageCount: null }), "finished", null),
    ).toEqual({ finishedAt: TODAY });
  });

  it("DNF stamps a finished date but does not complete progress", () => {
    const changes = deriveStatusChanges(state({ readStatus: "reading" }), "dnf", null);
    expect(changes).toEqual({ finishedAt: TODAY });
  });

  it("returning to unread resets progress but preserves the dates", () => {
    // An accidental status tap must not destroy reading history.
    const changes = deriveStatusChanges(
      state({ readStatus: "finished", startedAt: "2020-01-01", finishedAt: "2020-02-01", currentPage: 300 }),
      "unread",
      null,
    );
    expect(changes).toEqual({ currentPage: 0 });
  });
});

describe("updateBookSchema", () => {
  it("produces no keys at all for an empty patch", () => {
    // The bug this guards: deriving the patch schema from createBookSchema via
    // .partial() let Zod's .default() values through, so every PATCH silently
    // reset readStatus, format, authors and tags.
    const parsed = updateBookSchema.parse({});
    expect(Object.keys(parsed).filter((k) => parsed[k as keyof typeof parsed] !== undefined))
      .toEqual([]);
  });

  it("carries through only the field being changed", () => {
    const parsed = updateBookSchema.parse({ currentPage: 77 });
    const present = Object.entries(parsed).filter(([, v]) => v !== undefined);
    expect(present).toEqual([["currentPage", 77]]);
  });

  it("leaves absent text fields absent rather than nulling them", () => {
    const parsed = updateBookSchema.parse({ title: "Kept" });
    expect(parsed.subtitle).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
    expect(parsed.publisher).toBeUndefined();
  });

  it("still allows an explicit clear", () => {
    expect(updateBookSchema.parse({ notes: null }).notes).toBeNull();
    expect(updateBookSchema.parse({ notes: "" }).notes).toBeNull();
  });
});

describe("clampPage", () => {
  it("keeps a page inside the book", () => {
    expect(clampPage(150, 300)).toBe(150);
    expect(clampPage(400, 300)).toBe(300);
    expect(clampPage(-5, 300)).toBe(0);
  });

  it("allows any positive page when the length is unknown", () => {
    expect(clampPage(9999, null)).toBe(9999);
  });

  it("rejects nonsense", () => {
    expect(clampPage(Number.NaN, 300)).toBe(0);
  });
});

describe("normalizeTitle", () => {
  it("ignores case, punctuation, and spacing", () => {
    expect(normalizeTitle("The Left Hand of Darkness")).toBe("left hand of darkness");
    expect(normalizeTitle("the   left-hand  of darkness!")).toBe("left hand of darkness");
  });

  it("strips a leading article so editions match", () => {
    expect(normalizeTitle("A Wizard of Earthsea")).toBe("wizard of earthsea");
    expect(normalizeTitle("Wizard of Earthsea")).toBe("wizard of earthsea");
  });

  it("folds accents", () => {
    expect(normalizeTitle("Les Misérables")).toBe(normalizeTitle("Les Miserables"));
  });

  it("does not strip an article that is part of the title body", () => {
    expect(normalizeTitle("Rendezvous with The Rama")).toBe("rendezvous with the rama");
  });
});

describe("authorKey", () => {
  it("uses the surname", () => {
    expect(authorKey("Ursula K. Le Guin")).toBe("guin");
    expect(authorKey("J. E. Gordon")).toBe("gordon");
  });

  it("handles inverted 'Surname, Given' form", () => {
    expect(authorKey("Le Guin, Ursula K.")).toBe("le guin");
  });

  it("returns empty for unusable input", () => {
    expect(authorKey("")).toBe("");
    expect(authorKey("123")).toBe("");
  });
});

describe("isProbableDuplicate", () => {
  const existing = { title: "A Wizard of Earthsea", authors: ["Ursula K. Le Guin"] };

  it("matches the same book across editions", () => {
    expect(
      isProbableDuplicate(existing, {
        title: "Wizard of Earthsea",
        authors: ["Ursula K. Le Guin"],
      }),
    ).toBe(true);
  });

  it("does not match a different book by the same author", () => {
    expect(
      isProbableDuplicate(existing, {
        title: "The Dispossessed",
        authors: ["Ursula K. Le Guin"],
      }),
    ).toBe(false);
  });

  it("does not match the same title by a different author", () => {
    // "Selected Poems" collides constantly — title alone must never be enough.
    expect(
      isProbableDuplicate(
        { title: "Selected Poems", authors: ["Robert Frost"] },
        { title: "Selected Poems", authors: ["Emily Dickinson"] },
      ),
    ).toBe(false);
  });

  it("falls back to the title when either side has no author", () => {
    expect(
      isProbableDuplicate({ title: "Selected Poems", authors: [] }, {
        title: "Selected Poems",
        authors: ["Emily Dickinson"],
      }),
    ).toBe(true);
  });

  it("matches when only one of several authors overlaps", () => {
    expect(
      isProbableDuplicate(
        { title: "Good Omens", authors: ["Terry Pratchett", "Neil Gaiman"] },
        { title: "Good Omens", authors: ["Neil Gaiman"] },
      ),
    ).toBe(true);
  });
});
