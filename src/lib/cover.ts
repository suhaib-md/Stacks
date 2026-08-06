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
  // Hex, not hsl(): every colour in this module has to be shadeable, and shade()
  // parses hex. Returning an hsl() string made gradients silently flat.
  // Held in a muted band so a wall of generated tiles reads as cloth spines
  // rather than a colour chart, and stays legible under white text.
  return hslToHex(hue / 360, 0.28, 0.38);
}

/**
 * Hand-picked backgrounds for generated covers.
 *
 * Older and regional editions frequently have no cover art anywhere, so a
 * chosen colour is often the only art a book will ever have. All are dark
 * enough to carry white text, and held in one saturation band so a shelf of
 * them looks like a set rather than a paint chart.
 */
export const COVER_PALETTE: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Leather", hex: "#8a5a2b" },
  { name: "Clay", hex: "#8a4436" },
  { name: "Wine", hex: "#6b2f3a" },
  { name: "Plum", hex: "#553350" },
  { name: "Ink", hex: "#2f3b52" },
  { name: "Teal", hex: "#2b5555" },
  { name: "Forest", hex: "#3a5a45" },
  { name: "Moss", hex: "#556033" },
  { name: "Ochre", hex: "#8a6b2b" },
  { name: "Slate", hex: "#414d57" },
];

/** Shift a hex colour's lightness. Positive lightens, negative darkens. */
export function shade(hex: string, delta: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;

  const int = Number.parseInt(match[1], 16);
  const [h, s, l] = rgbToHsl((int >> 16) & 255, (int >> 8) & 255, int & 255);
  return hslToHex(h, s, Math.min(1, Math.max(0, l + delta)));
}

/**
 * The background for a generated cover: a soft vertical gradient rather than a
 * flat fill, which reads as cloth or board instead of a colour swatch.
 */
export function generatedCoverBackground(base: string): string {
  return `linear-gradient(155deg, ${shade(base, 0.08)} 0%, ${base} 52%, ${shade(base, -0.07)} 100%)`;
}

/** The colour a book gets when you haven't chosen one. */
export function effectiveCoverColor(
  coverColor: string | null | undefined,
  title: string,
): string {
  return coverColor ?? titleColor(title);
}

/**
 * Clamp an extracted cover colour into a band that stays legible behind white
 * text in both themes. A near-white cover would otherwise wash the header out.
 */
export function clampAccent(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;

  const int = Number.parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const [h, s, l] = rgbToHsl(r, g, b);
  const clampedL = Math.min(0.55, Math.max(0.22, l));
  const clampedS = Math.min(0.65, Math.max(0.15, s));
  return hslToHex(h, clampedS, clampedL);
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

/**
 * Dominant colour from a cover image, computed on the client.
 *
 * Returns null on any failure — most often a cover host that sends no CORS
 * headers, which taints the canvas. That is expected and common, so it must be
 * silent: logging here would fire on nearly every detail view.
 */
export async function extractDominantColor(src: string): Promise<string | null> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("load failed"));
    });

    const size = 32; // Downsample hard; we want the dominant hue, not detail.
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(image, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      if (alpha < 200) continue;

      // Covers are mostly paper and ink at the edges; those pixels are not the
      // book's colour.
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 240 && min > 240) continue;
      if (max < 24) continue;

      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }

    if (buckets.size === 0) return null;

    // Most frequent bucket, tie-broken by saturation so a large flat grey loses
    // to a slightly smaller but characterful colour.
    let best: { score: number; r: number; g: number; b: number } | null = null;
    for (const bucket of buckets.values()) {
      const r = bucket.r / bucket.count;
      const g = bucket.g / bucket.count;
      const b = bucket.b / bucket.count;
      const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      const score = bucket.count * (1 + saturation);
      if (!best || score > best.score) best = { score, r, g, b };
    }

    if (!best) return null;

    const hex = `#${[best.r, best.g, best.b]
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("")}`;
    return clampAccent(hex);
  } catch {
    return null;
  }
}
