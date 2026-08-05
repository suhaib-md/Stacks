# Stacks

A single-user personal book catalog. Scan the barcode on a book you own, it looks up the metadata, one tap later it's in your library. The library is presented cover-first — a wall of covers you browse the way you'd browse a physical shelf.

Built as a PWA so one codebase serves the phone (where cataloging happens) and the laptop (where browsing and editing happen).

**Status:** v1 feature-complete. Phases 0–5 built and deployed; what remains is your own device QA and a full cabinet catalogued.

**Live:** https://stacks.suhaib-muhammed2002.workers.dev

---

## Documentation

Read these before making changes. They are the source of truth — if code and docs disagree, that's a bug in one of them, and it should be resolved rather than ignored.

| Document | What it settles |
|---|---|
| [docs/prd.md](docs/prd.md) | Scope, goals, non-goals, user stories, functional and non-functional requirements, release criteria |
| [docs/trd.md](docs/trd.md) | Architecture, stack decisions and their rationale, API contract, business rules, external API integration, security, testing |
| [docs/app-flow.md](docs/app-flow.md) | Every screen, every transition, every error path |
| [docs/uiux.md](docs/uiux.md) | Color tokens, typography, components, motion, responsive behavior, accessibility |
| [docs/backend-schema.md](docs/backend-schema.md) | Tables, columns, indexes, Drizzle definitions, query patterns, migrations, CSV format |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Phase-by-phase build order with exit criteria |

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Adapter | `@opennextjs/cloudflare` |
| Hosting | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM + drizzle-kit |
| Styling | Tailwind CSS with CSS-variable design tokens |
| Fonts | Fraunces (display, self-hosted variable subset) + system sans |
| Scanner | Native `BarcodeDetector`, `html5-qrcode` fallback |
| Metadata | Open Library (primary), Google Books (fallback) |
| Auth | Signed session cookie from a single passphrase |
| PWA | Web manifest + Serwist |

---

## Intended project structure

```
src/
  app/
    (auth)/login/           passphrase gate
    (app)/
      page.tsx              library — grid/list, filters, Currently Reading
      book/[id]/            detail, edit
      add/                  scanner, search, manual
      settings/
    api/
      auth/                 login, logout
      lookup/isbn/[isbn]/   ISBN → BookMetadata (cached)
      lookup/search/        title/author search
      books/                list, create, [id], bulk
      export/csv/
  components/
    book/                   cover tile, list row, confirm sheet, progress, rating
    scanner/                camera, viewfinder, torch, detection
    ui/                     primitives — button, chip, sheet, input, toast
  db/
    schema.ts               Drizzle tables
    index.ts                client factory from the D1 binding
  lib/
    isbn.ts                 validation, 10↔13 conversion, normalization
    providers/              openlibrary.ts, googlebooks.ts, merge.ts
    color.ts                dominant-color extraction
    csv.ts                  RFC 4180 export
    auth.ts                 cookie signing/verification
  middleware.ts             session gate
drizzle/                    generated migrations — never edit after applying
docs/                       the documents listed above
```

---

## Commands

```bash
npm run dev                                           # Next dev server
npx wrangler dev                                      # Worker runtime + local D1
npm run build                                         # production build
npx drizzle-kit generate                              # after editing db/schema.ts
npx wrangler d1 migrations apply stacks-db --local    # apply locally FIRST
npx wrangler d1 migrations apply stacks-db --remote   # then production
npx wrangler d1 export stacks-db --remote --output backup.sql
npx wrangler secret put SESSION_SECRET                # also APP_PASSPHRASE, GOOGLE_BOOKS_KEY
```

Deploys happen automatically on push to `main` via Cloudflare Git integration. **Migrations are deliberate and manual** — they are not part of the build.

---

## Conventions

### Data
- IDs are app-generated UUID v4 (`crypto.randomUUID()`), never database-generated.
- Timestamps are ISO-8601 UTC strings in `text` columns. Reading dates (`started_at`, `finished_at`) are `YYYY-MM-DD` — day precision, because that's the real precision.
- `authors` and `tags` are JSON-encoded text arrays. Access them through typed helpers; never `JSON.parse` at a call site.
- Columns are `snake_case`; the Drizzle model is `camelCase`, mapped explicitly.
- ISBNs are normalized to ISBN-13, digits only, before storage or comparison.

### Zod schemas: create and update are written separately, on purpose
`createBookSchema.partial()` is **not** a valid update schema and must never be used as one. Zod applies a field's `.default()` when the key is absent, so a derived partial silently rewrote `readStatus`, `format`, `authors`, and `tags` on every PATCH. The same shape of bug hit text fields: a `.nullish().transform()` that maps `undefined` to `null` blanks the column. For updates, **absent must mean "leave alone"** — hence `patchableText` alongside `nullableText`. Regression tests live in [src/lib/books.test.ts](src/lib/books.test.ts).

### Code
- Server components by default. Client components only where interaction demands it: scanner, confirm sheet, filter controls, progress widget, rating, notes, bulk toolbar, color extraction.
- Filters, sort, and view mode live in URL search params — not in client state. Back button and shareable links work for free.
- Server Actions for form-shaped writes; route handlers for the scan/confirm path and anything callable from outside the app.
- All API errors use `{ error: { code, message, details? } }` with stable string codes.
- Zod validates every request body at the route boundary.

### Business rules belong on the server
Status-transition side effects (`started_at`, `finished_at`, `current_page` reset, page clamping, `updated_at`) are applied in the PATCH handler, never only in the UI. See [docs/trd.md §6](docs/trd.md#6-business-rules-enforced-server-side).

### Styling
- Only semantic tokens (`bg-surface`, `text-ink`, `border-rule`). No raw hex in components.
- Spacing is on the 4/8/12/16/24/32/48 scale. Nothing off-scale.
- Both themes must be handled on every new surface. Dark is warm charcoal and amber — never `#000` or `#FFF`.
- Status is never conveyed by color alone.

---

## Platform gotchas already paid for

These cost real debugging time in Phase 0. Don't undo them.

- **Never add the `global_fetch_strictly_public` compat flag.** OpenNext's router reaches the server function via the Worker's own hostname; that flag forces the request out to the public internet and every dynamic route 404s with Cloudflare error 1042. `wrangler dev` does *not* enforce the flag, so it looks fine locally and breaks only once deployed.
- **Stay on `middleware.ts`, not Next 16's `proxy.ts`.** Proxy is Node-runtime-only ("Proxy does not support Edge runtime") and `@opennextjs/cloudflare` rejects Node middleware outright. The build-time deprecation warning is the price of an app that builds. Revisit when the adapter supports Node proxy.
- **`wrangler secret put` needs a redeploy to take effect.** Setting a secret the running version has never seen leaves it invisible to `getCloudflareContext().env` until the next `wrangler deploy`. The symptom is a correct passphrase returning `SERVER_MISCONFIGURED`.
- **`wrangler types` overwrites `cloudflare-env.d.ts` and derives secret names from `.dev.vars`.** Don't hand-edit that file, and don't run `cf-typegen` without `.dev.vars` present or the secret types vanish.
- **Occasional D1 `7403` on remote commands is transient.** Retry before investigating account permissions.

---

## Things that are easy to get wrong here

- **Camera stream leaks.** Stop the stream on unmount and on route change — including when `getUserMedia` resolves *after* you've navigated away. A camera that stays live drains the phone and is invisible on desktop testing.
- **Never capture a ref at the top of an effect when the element is conditionally rendered.** This cost a full debug cycle: `<video>` was rendered only once `kind === "native"`, but the effect ran after the *first* commit and captured `null`, so the start sequence bailed silently and the UI sat on "Starting camera…" forever. `react-hooks/exhaustive-deps` pushes you toward hoisting the capture; the correct shape is to read the ref at point of use and keep a separate variable for cleanup. Both scanner surfaces are now always mounted so the question can't arise again.
- **Scanner failures only reproduce on a real device.** A silent hang is the least debuggable outcome there is, which is why `/add` surfaces `detector: … · phase: …` after 8 seconds instead of spinning forever. Keep that diagnostic.
- **Pause the scanner, don't stop it.** While the confirm sheet is open the stream stays live and only detection halts. Tearing it down makes every resume pay a fresh permission round-trip, which turns the scan loop into a chore.
- **The same-code cooldown restarts when the confirm sheet closes.** Timing it from first detection means the book you just saved is still in frame after the confirm tap and re-detects into a duplicate warning.
- **The manual path is not a fallback.** Regional and older Indian-market editions are frequently missing from both APIs. Manual entry is a first-class flow, always one tap from the scanner, with any scanned ISBN prefilled. A scan that finds nothing must never be a dead end.
- **`isbn13` uniqueness is a database constraint, not just a pre-check.** The pre-check exists for a good error message; the constraint exists for correctness.
- **Lookup cache TTLs are tiered, not binary.** Complete results never expire; thin results and misses get a 7-day recheck. Caching a thin result forever freezes a provider outage into the record permanently. A stale entry is still served as a fallback when the re-fetch also fails — never discard good data because a provider is down today.
- **Google Books' keyless quota is exhausted in practice** — anonymous requests share one project and return 429. Everything still works via Open Library, but descriptions and search ranking need a `GOOGLE_BOOKS_KEY`. See [docs/implementation-plan.md](docs/implementation-plan.md#google-books-key).
- **Lookup timeouts degrade, never throw.** 4 s per provider, no retries. The confirm sheet opens with whatever was found — including nothing.
- **Cover CORS.** Many cover hosts don't send CORS headers, which breaks canvas color extraction. Fail silently to the neutral accent; don't log on every detail view.
- **CSV escaping.** Notes contain commas, quotes, and newlines. RFC 4180 quoting with doubled inner quotes, UTF-8 BOM for Excel.
- **The service worker must never cache a redirected response.** An unauthenticated request to `/` follows a 307 to `/login`, and `fetch` reports that as a successful 200. Cache it and the login page is served under `/` to a signed-in user, offline, permanently. `isCacheable()` in [public/sw.js](public/sw.js) guards this.
- **Never cache auth, `/add`, or exports.** A cached session decision is a bug, a scanner with no lookup is a false promise, and a stale backup is worse than no backup.
- **The confirm sheet is one component.** Scan, search, and manual paths all use it. Fix bugs in one place.
- **Applied migrations are immutable.** Fix forward with a new migration. Back up before anything destructive.

---

## Out of scope for v1

Location tracking · lending · wishlist · stats dashboard · streaks · Year in Books · quotes/OCR · AI recommendations · shelf-photo bulk import · series tracking · TBR drag-reorder · multi-user · offline writes.

Don't build these without asking. The backlog and its priority order are in [docs/implementation-plan.md](docs/implementation-plan.md#phase-6--backlog-post-v1-rough-priority); none of them require changing the v1 schema.

---

## Current phase

**v1 is feature-complete.** All six phases are built, deployed, and verified in production. 131 unit tests.

What's left is not code:
- Catalogue a full cabinet in one sitting — the real exit criterion, and the thing most likely to surface remaining rough edges
- Install to the phone home screen and confirm the library reads with the network off
- Open an exported CSV in Sheets or Excel

Beyond that, [Phase 6](docs/implementation-plan.md#phase-6--backlog-post-v1-rough-priority) is the backlog: stats, TBR queue, "pick for me", streaks, quotes/OCR, lending, wishlist, series. **None of them need a v1 schema change** — check [backend-schema.md §8](docs/backend-schema.md#8-future-schema-post-v1-not-built) before assuming otherwise.

**Known miss:** eager JS is ~173 KB gzipped on the library route against the TRD's 150 KB budget. Deferred to the Phase 5 performance pass.
