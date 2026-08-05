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
  // Held in a muted band so a wall of generated tiles reads as cloth spines
  // rather than a colour chart, and stays legible under white text.
  return `hsl(${hue} 28% 38%)`;
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
