import { describe, expect, it, vi } from "vitest";
import { readLookupCache, writeLookupCache } from "./cache";
import type { BookMetadata } from "./types";

/**
 * The cache decides how long a wrong answer survives, so the TTL tiers are worth
 * pinning down. A minimal fake stands in for Drizzle — this is about the policy,
 * not about SQL.
 */

const complete: BookMetadata = {
  isbn13: "9780306406157",
  isbn10: "0306406152",
  title: "Structures",
  subtitle: null,
  authors: ["J. E. Gordon"],
  publisher: "Da Capo",
  publishedYear: 2003,
  pageCount: 424,
  description: "Why things don't fall down.",
  coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
  categories: ["Engineering"],
  language: "en",
  source: "merged",
};

const thin: BookMetadata = { ...complete, description: null, pageCount: null };

type Row = Record<string, unknown>;

function fakeDb(row: Row | undefined) {
  const captured: { values?: Row } = {};
  const db = {
    select: () => ({
      from: () => ({ where: () => ({ get: async () => row }) }),
    }),
    insert: () => ({
      values: (v: Row) => ({
        onConflictDoUpdate: async () => {
          captured.values = v;
        },
      }),
    }),
  };
  // The fake satisfies only the surface these two functions touch.
  return { db: db as never, captured };
}

describe("writeLookupCache TTL policy", () => {
  it("never expires a complete result", async () => {
    const { db, captured } = fakeDb(undefined);
    await writeLookupCache(db, complete.isbn13!, complete);
    expect(captured.values?.expiresAt).toBeNull();
    expect(captured.values?.found).toBe(1);
  });

  it("sets a recheck date on a thin result", async () => {
    // Thin usually means a provider was throttled. Caching that forever would
    // make today's outage permanent.
    const { db, captured } = fakeDb(undefined);
    await writeLookupCache(db, thin.isbn13!, thin);
    expect(captured.values?.expiresAt).toEqual(expect.any(String));
    expect(captured.values?.found).toBe(1);
  });

  it("sets a recheck date on a miss", async () => {
    const { db, captured } = fakeDb(undefined);
    await writeLookupCache(db, "9780306406157", null);
    expect(captured.values?.expiresAt).toEqual(expect.any(String));
    expect(captured.values?.found).toBe(0);
    expect(captured.values?.payload).toBeNull();
  });
});

describe("readLookupCache", () => {
  const base = {
    isbn13: complete.isbn13,
    payload: JSON.stringify(complete),
    found: 1,
    provider: "merged",
    fetchedAt: new Date().toISOString(),
  };

  it("returns null when there is no row", async () => {
    const { db } = fakeDb(undefined);
    expect(await readLookupCache(db, "9780306406157")).toBeNull();
  });

  it("returns a fresh hit as not stale", async () => {
    const { db } = fakeDb({ ...base, expiresAt: null });
    const entry = await readLookupCache(db, complete.isbn13!);
    expect(entry).toMatchObject({ found: true, stale: false });
    expect(entry?.metadata?.title).toBe("Structures");
  });

  it("still returns an expired hit, marked stale", async () => {
    // The route uses this as a fallback when a re-fetch also comes up empty.
    vi.setSystemTime(new Date("2030-01-01"));
    const { db } = fakeDb({ ...base, expiresAt: "2020-01-01T00:00:00.000Z" });
    const entry = await readLookupCache(db, complete.isbn13!);
    expect(entry).toMatchObject({ found: true, stale: true });
    expect(entry?.metadata?.title).toBe("Structures");
    vi.useRealTimers();
  });

  it("reports a cached miss", async () => {
    const { db } = fakeDb({ ...base, payload: null, found: 0, expiresAt: null });
    expect(await readLookupCache(db, complete.isbn13!)).toMatchObject({
      found: false,
      metadata: null,
    });
  });

  it("treats a corrupt payload as no row at all", async () => {
    const { db } = fakeDb({ ...base, payload: "{not json", expiresAt: null });
    expect(await readLookupCache(db, complete.isbn13!)).toBeNull();
  });
});
