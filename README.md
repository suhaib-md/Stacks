# Stacks

A single-user personal book catalog. Scan a barcode, confirm, and it's on your shelf.

Full documentation lives in [docs/](docs/) — start with [CLAUDE.md](CLAUDE.md).

---

## First-time setup

```bash
npm install

# 1. Generate auth secrets. This PRINTS your passphrase once — save it.
node scripts/gen-secrets.mjs

# 2. Copy the .dev.vars block it printed into a new .dev.vars file
cp .dev.vars.example .dev.vars      # then paste the values in

# 3. Create the database and paste the returned id into wrangler.jsonc
npx wrangler d1 create stacks-db

# 4. Generate and apply the first migration
npm run db:generate
npm run db:migrate:local
```

Then:

```bash
npm run dev          # http://localhost:3000
```

Visit `/api/health` — it should report `{ ok: true, database: "connected" }`.

## Deploying

```bash
npm run db:migrate:remote     # deliberate, never part of the build
npm run deploy

npx wrangler secret put SESSION_SECRET
npx wrangler secret put APP_PASSPHRASE_HASH
npm run deploy                # REQUIRED: secrets stay invisible until a redeploy
```

That second `deploy` is not redundant. A secret the running version has never seen
does not reach `getCloudflareContext().env` until the Worker is deployed again —
the symptom is a correct passphrase returning `SERVER_MISCONFIGURED`.

Migrations are applied by hand, locally first. A build never touches the schema.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Next dev server with D1 bound via wrangler |
| `npm run preview` | Build and run the real Worker locally |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate:local` / `:remote` | Apply migrations |
| `npm run db:backup` | Export remote D1 to `backup.sql` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` from bindings |
