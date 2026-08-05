#!/usr/bin/env node
/**
 * Generates the PWA icon set.
 *
 *   node scripts/gen-icons.mjs
 *
 * No image dependency: the mark is a stack of book spines, which is nothing but
 * filled rectangles, and Node already ships zlib — everything a PNG needs. That
 * keeps a 40 MB rasterizer out of the tree for four small files.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// --- minimal PNG encoder ----------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter byte; 0 means "none".
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- drawing ----------------------------------------------------------------

const hex = (value) => {
  const n = Number.parseInt(value.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};

const PAPER = hex("#F6EFE4");
const LEATHER = hex("#8A5A2B");
const AMBER = hex("#E0A458");
const INK = hex("#2A1D12");

function canvas(size, [r, g, b, a]) {
  const px = new Uint8Array(size * size * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  }
  return px;
}

/** Rect in normalized 0–1 coordinates, so one description works at every size. */
function rect(px, size, x0, y0, x1, y1, [r, g, b, a]) {
  const left = Math.round(x0 * size);
  const top = Math.round(y0 * size);
  const right = Math.round(x1 * size);
  const bottom = Math.round(y1 * size);

  for (let y = Math.max(0, top); y < Math.min(size, bottom); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(size, right); x += 1) {
      const i = (y * size + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }
}

/**
 * Three spines on a shelf.
 *
 * `scale` shrinks the mark toward the centre for the maskable variant, whose
 * outer 10% on each edge can be cropped to a circle by the launcher.
 */
function drawMark(px, size, scale = 1) {
  const map = (v) => 0.5 + (v - 0.5) * scale;
  const bar = (x0, y0, x1, y1, colour) =>
    rect(px, size, map(x0), map(y0), map(x1), map(y1), colour);

  bar(0.20, 0.30, 0.34, 0.74, PAPER);
  bar(0.20, 0.30, 0.34, 0.36, INK); // head band
  bar(0.38, 0.24, 0.52, 0.74, AMBER);
  bar(0.38, 0.24, 0.52, 0.31, INK);
  bar(0.56, 0.34, 0.70, 0.74, PAPER);
  bar(0.56, 0.34, 0.70, 0.40, INK);
  bar(0.16, 0.74, 0.84, 0.80, INK); // shelf
}

function icon(size, { maskable = false } = {}) {
  const px = canvas(size, LEATHER);
  drawMark(px, size, maskable ? 0.8 : 1);
  return encodePng(size, px);
}

// --- output -----------------------------------------------------------------

const outDir = resolve(process.cwd(), "public", "icons");
mkdirSync(outDir, { recursive: true });

const files = [
  ["icon-192.png", icon(192)],
  ["icon-512.png", icon(512)],
  ["icon-512-maskable.png", icon(512, { maskable: true })],
  ["apple-touch-icon.png", icon(180)],
];

for (const [name, buffer] of files) {
  writeFileSync(resolve(outDir, name), buffer);
  console.log(`  ${name.padEnd(24)} ${(buffer.length / 1024).toFixed(1)} KB`);
}
console.log(`\nWrote ${files.length} icons to public/icons/`);
