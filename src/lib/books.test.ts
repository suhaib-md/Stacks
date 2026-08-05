import { describe, expect, it } from "vitest";
import { authorKey, isProbableDuplicate, normalizeTitle } from "./books";

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
