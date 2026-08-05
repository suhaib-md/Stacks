import { eq, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { authAttempts } from "@/db/schema";

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 8;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * D1-backed login throttle. Deliberately not a Durable Object — one user, one
 * login a month, and a table row is the whole feature.
 */
export async function recordLoginAttempt(db: Db, ip: string): Promise<RateLimitResult> {
  const now = Date.now();
  const cutoff = new Date(now - WINDOW_SECONDS * 1000).toISOString();

  // Sweep expired windows so the table can't grow without bound.
  await db.delete(authAttempts).where(lt(authAttempts.windowStart, cutoff));

  const existing = await db
    .select()
    .from(authAttempts)
    .where(eq(authAttempts.ip, ip))
    .get();

  if (!existing) {
    await db
      .insert(authAttempts)
      .values({ ip, count: 1, windowStart: new Date(now).toISOString() });
    return { allowed: true };
  }

  const windowStartMs = Date.parse(existing.windowStart);
  const windowAgeSeconds = (now - windowStartMs) / 1000;

  if (windowAgeSeconds >= WINDOW_SECONDS) {
    await db
      .update(authAttempts)
      .set({ count: 1, windowStart: new Date(now).toISOString() })
      .where(eq(authAttempts.ip, ip));
    return { allowed: true };
  }

  if (existing.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(WINDOW_SECONDS - windowAgeSeconds),
    };
  }

  await db
    .update(authAttempts)
    .set({ count: existing.count + 1 })
    .where(eq(authAttempts.ip, ip));
  return { allowed: true };
}

/** Called after a successful login so a correct passphrase resets the budget. */
export async function clearLoginAttempts(db: Db, ip: string): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.ip, ip));
}
