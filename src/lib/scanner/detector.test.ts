import { describe, expect, it } from "vitest";
import { rankByCentrality, type DetectedCode } from "./detector";

/**
 * Real book barcodes rarely appear alone. Bloomsbury house editions carry an
 * EAN-5 price add-on beside the ISBN, Indian-market printings get a shop sticker
 * with its own barcode, and two books often sit in shot together. Which code we
 * try first decides whether the right book is found — so it is pinned here.
 */

const box = (x: number, y: number, size = 40) => ({ x, y, width: size, height: size });

const code = (rawValue: string, boundingBox?: DetectedCode["boundingBox"]): DetectedCode => ({
  rawValue,
  format: "ean_13",
  boundingBox,
});

const FRAME_W = 1280;
const FRAME_H = 720;
// Centre of the frame is (640, 360).

describe("rankByCentrality", () => {
  it("puts the code nearest the centre first", () => {
    const ranked = rankByCentrality(
      [code("edge", box(20, 20)), code("centre", box(620, 340))],
      FRAME_W,
      FRAME_H,
    );
    expect(ranked[0]).toBe("centre");
  });

  it("prefers the aimed-at ISBN over a price add-on beside it", () => {
    // The add-on sits just to the right of the ISBN on those Harry Potter covers.
    const ranked = rankByCentrality(
      [code("90100", box(760, 340)), code("9781408898161", box(620, 340))],
      FRAME_W,
      FRAME_H,
    );
    expect(ranked).toEqual(["9781408898161", "90100"]);
  });

  it("orders two books in shot by which one you aimed at", () => {
    const ranked = rankByCentrality(
      [code("9780008172428", box(120, 340)), code("9781408898161", box(600, 340))],
      FRAME_W,
      FRAME_H,
    );
    expect(ranked[0]).toBe("9781408898161");
  });

  it("keeps every candidate, never just the winner", () => {
    // The whole bug was dropping the others: a shop sticker detected first hid
    // the ISBN sitting right beside it.
    const ranked = rankByCentrality(
      [code("a", box(0, 0)), code("b", box(640, 360)), code("c", box(1200, 700))],
      FRAME_W,
      FRAME_H,
    );
    expect(ranked).toHaveLength(3);
    expect([...ranked].sort()).toEqual(["a", "b", "c"]);
  });

  it("sends codes with no bounding box to the back rather than guessing", () => {
    const ranked = rankByCentrality(
      [code("unknown"), code("known", box(620, 340))],
      FRAME_W,
      FRAME_H,
    );
    expect(ranked).toEqual(["known", "unknown"]);
  });

  it("falls back to input order when the frame size is unknown", () => {
    const ranked = rankByCentrality([code("first"), code("second")], 0, 0);
    expect(ranked).toEqual(["first", "second"]);
  });

  it("handles an empty frame", () => {
    expect(rankByCentrality([], FRAME_W, FRAME_H)).toEqual([]);
  });
});
