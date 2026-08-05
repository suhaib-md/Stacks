/**
 * Single-user passphrase auth (see docs/trd.md §12).
 *
 * Threat model: keep strangers and crawlers out of a private book catalog. Not
 * financial data, not third-party PII.
 *
 * Passphrase storage: HMAC-SHA256(SESSION_SECRET, passphrase), not PBKDF2/bcrypt.
 * Reasoning, so this doesn't read as an oversight:
 *   - Slow KDFs exist to protect LOW-ENTROPY human passwords from offline cracking.
 *   - `scripts/gen-secrets.mjs` GENERATES the passphrase (160 bits of entropy), so
 *     offline cracking is infeasible regardless of hash speed.
 *   - The HMAC key is itself a secret, so an attacker holding only the stored hash
 *     cannot mount an offline attack at all.
 *   - Workers' free-tier 10ms CPU budget makes a 100k-iteration KDF a real
 *     availability risk on every login.
 * Consequence to remember: rotating SESSION_SECRET invalidates the stored
 * passphrase hash. Regenerate both together.
 */

export const SESSION_COOKIE = "stacks_session";

/** Bump to invalidate every existing session at once ("log me out everywhere"). */
export const SESSION_VERSION = 1;

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const encoder = new TextEncoder();

// --- encoding helpers -------------------------------------------------------

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Length-independent, content-constant-time comparison. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

// --- HMAC -------------------------------------------------------------------

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(secret: string, message: string): Promise<Uint8Array> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(sig);
}

// --- passphrase -------------------------------------------------------------

export async function hashPassphrase(passphrase: string, secret: string): Promise<string> {
  return toBase64Url(await sign(secret, `passphrase:${passphrase}`));
}

export async function verifyPassphrase(
  passphrase: string,
  storedHash: string,
  secret: string,
): Promise<boolean> {
  const computed = await sign(secret, `passphrase:${passphrase}`);
  let expected: Uint8Array;
  try {
    expected = fromBase64Url(storedHash);
  } catch {
    return false;
  }
  return timingSafeEqual(computed, expected);
}

// --- session token ----------------------------------------------------------

/** Token layout: `<version>.<expiresAtUnixSeconds>.<base64url hmac>` */
export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = `${SESSION_VERSION}.${expiresAt}`;
  return `${payload}.${toBase64Url(await sign(secret, payload))}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [versionRaw, expiresRaw, signature] = parts;
  const payload = `${versionRaw}.${expiresRaw}`;

  // Verify the signature BEFORE trusting any field inside the token.
  let provided: Uint8Array;
  try {
    provided = fromBase64Url(signature);
  } catch {
    return false;
  }
  if (!timingSafeEqual(await sign(secret, payload), provided)) return false;

  if (Number(versionRaw) !== SESSION_VERSION) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt * 1000 > now;
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
