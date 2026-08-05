# Stacks

A single-user personal book catalog. Scan the barcode on a book you own, it looks up the metadata, one tap later it's in your library. The library is presented cover-first — a wall of covers you browse the way you'd browse a physical shelf.

Built as a PWA so one codebase serves the phone (where cataloging happens) and the laptop (where browsing and editing happen).

**Status:** Pre-implementation. Documentation complete, Phase 0 not started.

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

## Things that are easy to get wrong here

- **Camera stream leaks.** Stop the stream on unmount and on route change. A camera that stays live after navigation drains the phone and is invisible on desktop testing.
- **The manual path is not a fallback.** Regional and older Indian-market editions are frequently missing from both APIs. Manual entry is a first-class flow, always one tap from the scanner, with any scanned ISBN prefilled. A scan that finds nothing must never be a dead end.
- **`isbn13` uniqueness is a database constraint, not just a pre-check.** The pre-check exists for a good error message; the constraint exists for correctness.
- **Every lookup gets cached**, including "not found" (with a 7-day TTL). This is what keeps Google Books within quota.
- **Lookup timeouts degrade, never throw.** 4 s per provider, no retries. The confirm sheet opens with whatever was found — including nothing.
- **Cover CORS.** Many cover hosts don't send CORS headers, which breaks canvas color extraction. Fail silently to the neutral accent; don't log on every detail view.
- **CSV escaping.** Notes contain commas, quotes, and newlines. RFC 4180 quoting with doubled inner quotes, UTF-8 BOM for Excel.
- **The confirm sheet is one component.** Scan, search, and manual paths all use it. Fix bugs in one place.
- **Applied migrations are immutable.** Fix forward with a new migration. Back up before anything destructive.

---

## Out of scope for v1

Location tracking · lending · wishlist · stats dashboard · streaks · Year in Books · quotes/OCR · AI recommendations · shelf-photo bulk import · series tracking · TBR drag-reorder · multi-user · offline writes.

Don't build these without asking. The backlog and its priority order are in [docs/implementation-plan.md](docs/implementation-plan.md#phase-6--backlog-post-v1-rough-priority); none of them require changing the v1 schema.

---

## Current phase

**Phase 0 — Project setup & deployment skeleton.** See [docs/implementation-plan.md](docs/implementation-plan.md#phase-0--project-setup--deployment-skeleton).

Exit criteria: a deployed URL that asks for a passphrase, accepts it, and renders an empty library page backed by a real remote D1 query.
