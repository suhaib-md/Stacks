import { describe, expect, it } from "vitest";
import {
  COVER_PALETTE,
  effectiveCoverColor,
  generatedCoverBackground,
  readableOn,
  shade,
  titleColor,
} from "./cover";

const HEX = /^#[0-9a-f]{6}$/;

describe("titleColor", () => {
  it("returns hex, not an hsl() string", () => {
    // shade() parses hex. Returning hsl() here made every generated gradient
    // silently flat, because shading was a no-op on an unparseable value.
    expect(titleColor("Structures")).toMatch(HEX);
  });

  it("is deterministic — a book must look the same everywhere, always", () => {
    expect(titleColor("A Wizard of Earthsea")).toBe(titleColor("A Wizard of Earthsea"));
  });

  it("distinguishes different titles", () => {
    expect(titleColor("Persuader")).not.toBe(titleColor("No Plan B"));
  });

  it("copes with an empty title", () => {
    expect(titleColor("")).toMatch(HEX);
  });
});

describe("shade", () => {
  it("lightens and darkens", () => {
    const base = "#8a5a2b";
    expect(shade(base, 0.1)).not.toBe(base);
    expect(shade(base, -0.1)).not.toBe(base);
    expect(shade(base, 0.1)).not.toBe(shade(base, -0.1));
  });

  it("stays within hex bounds at the extremes", () => {
    expect(shade("#8a5a2b", 5)).toMatch(HEX);
    expect(shade("#8a5a2b", -5)).toMatch(HEX);
  });

  it("returns the input unchanged when it isn't hex", () => {
    expect(shade("not a colour", 0.1)).toBe("not a colour");
  });
});

describe("generatedCoverBackground", () => {
  it("is a flat colour — the ledger has no gradients", () => {
    expect(generatedCoverBackground("#2743d8")).toBe("#2743d8");
  });

  it("passes an automatic colour through unchanged", () => {
    const base = titleColor("Some Book");
    expect(generatedCoverBackground(base)).toBe(base);
  });
});

describe("COVER_PALETTE", () => {
  it("is all valid hex", () => {
    for (const swatch of COVER_PALETTE) expect(swatch.hex).toMatch(HEX);
  });

  it("has no duplicates", () => {
    expect(new Set(COVER_PALETTE.map((s) => s.hex)).size).toBe(COVER_PALETTE.length);
  });

  it("pairs every entry with a label colour that contrasts", () => {
    // The palette is deliberately not all-dark any more — Bone is a light
    // ground — so legibility comes from readableOn rather than from the
    // palette being uniformly dark.
    for (const { hex, name } of COVER_PALETTE) {
      const fg = readableOn(hex);
      expect(["#201e1d", "#f3f2f2"], `${name} got an unexpected label colour`).toContain(fg);
    }
  });

  it("puts ink on the light grounds and paper on the dark ones", () => {
    expect(readableOn("#e8e4dc")).toBe("#201e1d");
    expect(readableOn("#201e1d")).toBe("#f3f2f2");
    expect(readableOn("#2743d8")).toBe("#f3f2f2");
  });

  it("falls back to paper for an unparseable colour", () => {
    expect(readableOn("nonsense")).toBe("#f3f2f2");
  });
});

describe("effectiveCoverColor", () => {
  it("prefers an explicit choice", () => {
    expect(effectiveCoverColor("#2f3b52", "Any Title")).toBe("#2f3b52");
  });

  it("falls back to the title-derived colour", () => {
    expect(effectiveCoverColor(null, "Any Title")).toBe(titleColor("Any Title"));
    expect(effectiveCoverColor(undefined, "Any Title")).toBe(titleColor("Any Title"));
  });
});
