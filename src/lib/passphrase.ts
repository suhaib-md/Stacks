import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { settings } from "@/db/schema";
import { hashPassphrase, verifyPassphrase } from "./auth";

/**
 * Where the passphrase hash lives.
 *
 * It starts in the APP_PASSPHRASE_HASH secret, which the Worker can read but
 * cannot write — so changing it from inside the app is impossible while it stays
 * there. Once you change it, the new hash goes to the `settings` table and takes
 * precedence from then on.
 *
 * The env secret remains the fallback, which means:
 *   - a fresh deployment works with no database row
 *   - deleting the row reverts to the original passphrase, which is a usable
 *     recovery path if you forget the new one
 *
 * The stored value is still an HMAC keyed by SESSION_SECRET, so a database copy
 * on its own reveals nothing and cannot be brute-forced offline.
 */
export const PASSPHRASE_KEY = "passphrase_hash";

export async function currentPassphraseHash(
  db: Db,
  envHash: string | undefined,
): Promise<string | null> {
  const row = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, PASSPHRASE_KEY))
    .get();

  if (row?.value) {
    try {
      // Stored JSON-encoded, matching the rest of the settings table.
      const parsed: unknown = JSON.parse(row.value);
      if (typeof parsed === "string" && parsed.length > 0) return parsed;
    } catch {
      // A corrupt row must not lock you out; fall through to the secret.
    }
  }

  return envHash ?? null;
}

export async function setPassphrase(db: Db, passphrase: string, secret: string): Promise<void> {
  const hash = await hashPassphrase(passphrase, secret);
  const row = {
    key: PASSPHRASE_KEY,
    value: JSON.stringify(hash),
    updatedAt: new Date().toISOString(),
  };

  await db.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: row });
}

export async function checkPassphrase(
  db: Db,
  passphrase: string,
  envHash: string | undefined,
  secret: string,
): Promise<boolean> {
  const hash = await currentPassphraseHash(db, envHash);
  if (!hash) return false;
  return verifyPassphrase(passphrase, hash, secret);
}

/**
 * Minimum length only — no character-class rules.
 *
 * Composition requirements push people toward short, predictable passwords;
 * length is what actually resists guessing, and this gate protects a private
 * book list rather than a bank.
 */
export const MIN_PASSPHRASE_LENGTH = 12;

export function validatePassphrase(passphrase: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  }
  return null;
}
