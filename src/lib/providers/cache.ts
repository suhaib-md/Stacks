import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { lookupCache } from "@/db/schema";
import { isThin } from "./merge";
import type { BookMetadata } from "./types";

/**
 * Every lookup outcome is cached, including misses. This is what keeps repeat
 * scans free and Google Books inside its keyless quota.
 *
 * Three tiers, because "found something" is not the same as "found everything":
 *   - complete result  → never expires; an edition's metadata doesn't change
 *   - thin result      → 7 days; it's usually thin because a provider was down
 *                        or throttled, and caching that forever would make the
 *                        outage permanent
 *   - miss             → 7 days, so a book indexed later is eventually picked up
 */
const RECHECK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CacheEntry = {
  found: boolean;
  metadata: BookMetadata | null;
  /** Past its recheck date — worth re-asking, but still better than nothing. */
  stale: boolean;
};

/** Returns null only when there is no usable row at all. */
export async function readLookupCache(db: Db, isbn13: string): Promise<CacheEntry | null> {
  const row = await db
    .select()
    .from(lookupCache)
    .where(eq(lookupCache.isbn13, isbn13))
    .get();

  if (!row) return null;

  const stale = row.expiresAt !== null && Date.parse(row.expiresAt) <= Date.now();

  if (row.found === 0) return { found: false, metadata: null, stale };

  if (!row.payload) return null;
  try {
    return { found: true, metadata: JSON.parse(row.payload) as BookMetadata, stale };
  } catch {
    // A corrupt row is a cache miss, never an error.
    return null;
  }
}

export async function writeLookupCache(
  db: Db,
  isbn13: string,
  metadata: BookMetadata | null,
): Promise<void> {
  const now = new Date();
  const recheck = new Date(now.getTime() + RECHECK_TTL_MS).toISOString();

  // A thin hit gets the same treatment as a miss: worth asking again later.
  const permanent = metadata !== null && !isThin(metadata);

  const row = {
    isbn13,
    payload: metadata ? JSON.stringify(metadata) : null,
    found: metadata ? 1 : 0,
    provider: metadata?.source ?? null,
    fetchedAt: now.toISOString(),
    expiresAt: permanent ? null : recheck,
  };

  await db
    .insert(lookupCache)
    .values(row)
    .onConflictDoUpdate({ target: lookupCache.isbn13, set: row });
}
