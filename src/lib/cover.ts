/**
 * Deterministic colour for books with no cover art.
 *
 * A hash of the title, not a random pick: the same book must look the same on
 * every render and every device, or the grid stops being recognisable — which
 * is the one thing the grid is for.
 */
export function titleColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  // Hex, not hsl(): shade() and readableOn() both parse hex only.
  // Saturated and deep enough to sit alongside COVER_PALETTE rather than beside
  // it — covers are the one place colour is allowed to be loud.
  return hslToHex(hue / 360, 0.42, 0.34);
}

/**
 * Backgrounds for generated cover art.
 *
 * Older and regional editions frequently have no cover art anywhere, so a
 * chosen colour is often the only art a book will ever have.
 *
 * Covers are the only full-colour thing in the app — everything around them is
 * ink, red and acid — so this is the one palette allowed to be bold.
 *
 * The design file's palette also contained the system red (#ec3013) and the
 * acid (#d6f34a). Both are deliberately left out: the sheet says acid means
 * reading progress and red means the action that commits, and a cover wearing
 * either would make those readings ambiguous on a shelf.
 */
export const COVER_PALETTE: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Ink", hex: "#201e1d" },
  { name: "Ultramarine", hex: "#2743d8" },
  { name: "Pine", hex: "#0f6b62" },
  { name: "Ochre", hex: "#c88a2b" },
  { name: "Violet", hex: "#4b2fa8" },
  { name: "Bone", hex: "#e8e4dc" },
  { name: "Rust", hex: "#a83208" },
  { name: "Slate", hex: "#46505c" },
];

/**
 * Ink or paper, whichever holds contrast on the given ground. Rec. 601 luma —
 * the bone and ochre entries need ink, the rest need paper.
 */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#f3f2f2";
  const n = Number.parseInt(m[1], 16);
  const luma = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luma > 0.6 ? "#201e1d" : "#f3f2f2";
}

/** Shift a hex colour's lightness. Positive lightens, negative darkens. */
export function shade(hex: string, delta: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;

  const int = Number.parseInt(match[1], 16);
  const [h, s, l] = rgbToHsl((int >> 16) & 255, (int >> 8) & 255, int & 255);
  return hslToHex(h, s, Math.min(1, Math.max(0, l + delta)));
}

/**
 * The background for a generated cover. Flat: the ledger has no gradients and
 * no elevation, so a stub cover is a solid field with the title set on it.
 * Kept as a function because every call site already goes through it.
 */
export function generatedCoverBackground(base: string): string {
  return base;
}

/** The colour a book gets when you haven't chosen one. */
export function effectiveCoverColor(
  coverColor: string | null | undefined,
  title: string,
): string {
  return coverColor ?? titleColor(title);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const value = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
