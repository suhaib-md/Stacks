import { z } from "zod";
import { getDb, getEnv } from "@/db";
import { apiError, apiOk, clientIp } from "@/lib/http";
import { checkPassphrase, setPassphrase, validatePassphrase } from "@/lib/passphrase";
import { recordLoginAttempt } from "@/lib/rate-limit";

const bodySchema = z.object({
  current: z.string().min(1).max(512),
  next: z.string().min(1).max(512),
});

/**
 * Change the passphrase.
 *
 * Behind the session gate AND re-verifying the current passphrase: a borrowed
 * unlocked phone shouldn't be able to lock you out of your own library.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Enter your current and new passphrase.");
  }

  const env = await getEnv();
  if (!env.SESSION_SECRET) {
    return apiError("SERVER_MISCONFIGURED", "Auth secrets are not configured.");
  }

  const problem = validatePassphrase(parsed.data.next);
  if (problem) return apiError("VALIDATION_FAILED", problem);

  const db = await getDb();

  // Same throttle as login, so this can't be used to guess the current one.
  const limit = await recordLoginAttempt(db, clientIp(req));
  if (!limit.allowed) {
    return apiError("RATE_LIMITED", "Too many attempts. Try again later.", {
      details: { retryAfterSeconds: limit.retryAfterSeconds },
    });
  }

  const ok = await checkPassphrase(
    db,
    parsed.data.current,
    env.APP_PASSPHRASE_HASH,
    env.SESSION_SECRET,
  );
  if (!ok) {
    return apiError("UNAUTHORIZED", "That current passphrase is not correct.");
  }

  await setPassphrase(db, parsed.data.next, env.SESSION_SECRET);

  // Note: existing sessions stay valid. The cookie is signed by SESSION_SECRET,
  // which hasn't changed, and verifying against the passphrase instead would
  // cost a database read on every single request. To end other sessions,
  // rotate SESSION_SECRET with wrangler and redeploy.
  return apiOk({ ok: true });
}
