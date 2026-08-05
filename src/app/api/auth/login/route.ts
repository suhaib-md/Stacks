import { z } from "zod";
import { getDb, getEnv } from "@/db";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyPassphrase,
} from "@/lib/auth";
import { apiError, apiOk, clientIp } from "@/lib/http";
import { clearLoginAttempts, recordLoginAttempt } from "@/lib/rate-limit";

const bodySchema = z.object({
  passphrase: z.string().min(1).max(512),
  next: z.string().startsWith("/").max(512).optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Enter your passphrase.");
  }

  const env = await getEnv();
  if (!env.SESSION_SECRET || !env.APP_PASSPHRASE_HASH) {
    // Never fall back to "allow" — an unconfigured deployment is a locked one.
    return apiError(
      "SERVER_MISCONFIGURED",
      "Auth secrets are not configured. Run scripts/gen-secrets.mjs and set them.",
    );
  }

  const db = await getDb();
  const ip = clientIp(req);

  const limit = await recordLoginAttempt(db, ip);
  if (!limit.allowed) {
    return apiError("RATE_LIMITED", "Too many attempts. Try again later.", {
      details: { retryAfterSeconds: limit.retryAfterSeconds },
    });
  }

  const ok = await verifyPassphrase(
    parsed.data.passphrase,
    env.APP_PASSPHRASE_HASH,
    env.SESSION_SECRET,
  );
  if (!ok) {
    return apiError("UNAUTHORIZED", "That passphrase is not correct.");
  }

  await clearLoginAttempts(db, ip);

  const res = apiOk({ ok: true, next: parsed.data.next ?? "/" });
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(env.SESSION_SECRET),
    sessionCookieOptions(),
  );
  return res;
}
