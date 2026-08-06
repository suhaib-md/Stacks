import { describe, expect, it } from "vitest";
import {
  COVER_PALETTE,
  effectiveCoverColor,
  generatedCoverBackground,
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
  it("produces three genuinely different stops", () => {
    const css = generatedCoverBackground("#8a5a2b");
    const stops = css.match(/#[0-9a-f]{6}/g) ?? [];
    expect(stops).toHaveLength(3);
    expect(new Set(stops).size).toBe(3);
  });

  it("works from an automatic colour too", () => {
    const stops = generatedCoverBackground(titleColor("Some Book")).match(/#[0-9a-f]{6}/g) ?? [];
    expect(new Set(stops).size).toBe(3);
  });
});

describe("COVER_PALETTE", () => {
  it("is all valid hex", () => {
    for (const swatch of COVER_PALETTE) expect(swatch.hex).toMatch(HEX);
  });

  it("has no duplicates", () => {
    expect(new Set(COVER_PALETTE.map((s) => s.hex)).size).toBe(COVER_PALETTE.length);
  });

  it("is dark enough throughout to carry white text", () => {
    for (const { hex, name } of COVER_PALETTE) {
      const n = Number.parseInt(hex.slice(1), 16);
      // Rec. 601 luma; white on anything above ~0.55 starts to fail.
      const luma =
        (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      expect(luma, `${name} is too light for white text`).toBeLessThan(0.55);
    }
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
