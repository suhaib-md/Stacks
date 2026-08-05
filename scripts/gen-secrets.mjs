#!/usr/bin/env node
/**
 * Generates the auth secrets for Stacks.
 *
 * The passphrase is GENERATED, not chosen. That is what makes a fast keyed hash
 * safe here instead of a slow KDF (see the reasoning in src/lib/auth.ts).
 *
 *   node scripts/gen-secrets.mjs            print everything, write nothing
 *   node scripts/gen-secrets.mjs --write    write .dev.vars, print only the passphrase
 *
 * SESSION_SECRET and APP_PASSPHRASE_HASH are coupled — the hash is an HMAC keyed
 * by the session secret. Rotating one means regenerating both.
 */
import { randomBytes, createHmac } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const toBase64Url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// 160 bits of entropy, rendered as readable groups.
const passphrase = toBase64Url(randomBytes(20)).match(/.{1,6}/g).join("-");
const sessionSecret = toBase64Url(randomBytes(32));
const passphraseHash = toBase64Url(
  createHmac("sha256", sessionSecret).update(`passphrase:${passphrase}`).digest(),
);

const write = process.argv.includes("--write");

if (write) {
  const target = resolve(process.cwd(), ".dev.vars");
  if (existsSync(target) && !process.argv.includes("--force")) {
    console.error(`Refusing to overwrite existing ${target}. Pass --force to replace it.`);
    process.exit(1);
  }
  writeFileSync(
    target,
    `SESSION_SECRET="${sessionSecret}"\nAPP_PASSPHRASE_HASH="${passphraseHash}"\nGOOGLE_BOOKS_KEY=""\n`,
    "utf8",
  );
  console.log(`
  Wrote .dev.vars (local only, gitignored).

  YOUR LOCAL PASSPHRASE — save it in a password manager, it is not recoverable:

      ${passphrase}

  For production, run this again WITHOUT --write and set the printed values via
  \`npx wrangler secret put ...\`. Use a separate passphrase for production.
`);
} else {
  console.log(`
  Stacks — generated secrets
  ==========================

  YOUR PASSPHRASE (save it; it is not recoverable):

      ${passphrase}

  --- .dev.vars (local, gitignored) ---------------------------------------
SESSION_SECRET="${sessionSecret}"
APP_PASSPHRASE_HASH="${passphraseHash}"

  --- production ----------------------------------------------------------
  npx wrangler secret put SESSION_SECRET
      ${sessionSecret}

  npx wrangler secret put APP_PASSPHRASE_HASH
      ${passphraseHash}

  The passphrase itself is never stored anywhere — only the keyed hash is.
`);
}
