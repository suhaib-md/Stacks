# Stacks — Implementation Plan (v1)

**Companion to:** [PRD](prd.md) · [TRD](trd.md)
**Last updated:** 2026-08-05

Six phases. Each has a goal, a task list, and an exit criterion that is a *demonstration*, not a checkbox. The app is genuinely usable for real cataloging from the end of Phase 2 — everything after that is making it pleasant.

---

## Phase 0 — Project setup & deployment skeleton ✅ COMPLETE

**Goal:** "Hello world" deployed on Cloudflare with D1 wired up and login working.

- [x] **0.1** Init Next.js (App Router, TypeScript, Tailwind). Init git repo.
- [x] **0.2** Configure Cloudflare deployment via `@opennextjs/cloudflare`; write `wrangler.jsonc`; confirm a local `wrangler dev` build serves the app.
- [x] **0.3** Create the D1 database (`stacks-db`, APAC), bind as `DB` locally and remotely, and prove the binding works from a route handler (`/api/health`).
- [x] **0.4** Set up Drizzle: `src/db/schema.ts`, `drizzle.config.ts`, first migration (`books`, `lookup_cache`, `settings`, `auth_attempts` + indexes + CHECK constraints), applied locally then remotely.
- [x] **0.5** Minimal auth: `/login` page, `POST /api/auth/login` verifying the passphrase against a keyed hash, signed HMAC session cookie, D1-backed login throttle, middleware gating everything except `/login` and static assets. Requested path preserved through login.
- [x] **0.6** Base layout and design tokens: Fraunces via `next/font`, CSS custom properties for both themes wired into Tailwind v4 `@theme inline`, app shell with mobile bottom tab bar and desktop top nav, pre-paint theme bootstrap.
- [x] **0.7** Deployed to `https://stacks.suhaib-muhammed2002.workers.dev` via `wrangler deploy`.

**Exit — met.** Verified against the live URL: unauthenticated `/` → 307 to `/login`; `/api/health` → 401; wrong passphrase → 401; correct passphrase → 200 + `HttpOnly; Secure; SameSite=lax` cookie; `/api/health` with session → `{"ok":true,"database":"connected","books":0}`; `/` with session → 200 rendering the empty-library state. Tampered and forged cookies rejected; throttle trips on the 9th bad attempt.

**What actually bit us** (all recorded in [CLAUDE.md](../CLAUDE.md#platform-gotchas-already-paid-for)):
- `global_fetch_strictly_public` broke every dynamic route in production with error 1042 while passing locally.
- Next 16's `proxy.ts` is Node-only and the adapter rejects it — stayed on `middleware.ts`.
- Secrets set after a deploy stay invisible until the next `wrangler deploy`.

**Deploys:** Cloudflare Workers Builds is connected to `suhaib-md/Stacks`, production branch `main`. Build command is `npx opennextjs-cloudflare build` and deploy is `npx wrangler deploy` — the default `npm run build` would only produce the Next output and ship no Worker. Runtime secrets live on the Worker, not in the build environment, so CI needs none.

---

## Phase 1 — Metadata lookup & manual add ✅ BUILT

**Goal:** You can add a book by typing an ISBN or searching a title, with metadata auto-filled. This is the data pipeline; the camera is just a faster input method for it.

- [x] **1.1** ISBN utilities in `src/lib/isbn.ts`: validation, 10 ↔ 13 conversion, normalization to bare ISBN-13. Non-Bookland EAN-13s rejected, so a cereal barcode never reaches a lookup.
- [x] **1.2** `GET /api/lookup/isbn/:isbn` — cache → Open Library → Google Books (only when the first result is thin) → merge → cache the outcome. 4 s per provider, no retries, degrades to null rather than throwing.
- [x] **1.3** `GET /api/lookup/search?q=` — Google Books primary, Open Library fallback, 10 results.
- [x] **1.4** `POST /api/books` with dedup: exact `isbn13` → 409 with the existing id; same title+author → 201 with a non-blocking `POSSIBLE_DUPLICATE` warning.
- [x] **1.5** Add flow UI: `/add` ISBN entry, `/add/search`, `/add/manual`.
- [x] **1.6** One `ConfirmSheet` used by every add path, reset per book via `key` rather than an effect.
- [x] **1.7** Library list + a minimal `/book/[id]` so saved data is verifiable.

**Exit — still to do by hand:** add 10 real books from your cabinets by typed ISBN and by search. The paths are all verified end to end; what remains is your actual shelf.

**Verified locally:** real lookups for Roald Dahl, Le Guin, Harari, and an Indian-market Alchemist edition (`9788172234980`); hyphenated re-add caught as a duplicate; same-title-different-author correctly *not* flagged; 78 unit tests over the ISBN maths, mappers, merge, cache policy, and dedup.

### Two things learned building it

- **The Google Books keyless quota is exhausted in practice.** Anonymous requests share one project and it returns 429 all day. The fallback works — lookups degrade to Open Library — but descriptions and good search ranking need a `GOOGLE_BOOKS_KEY`. See [§Google Books key](#google-books-key).
- **Cache TTLs had to become tiered.** Caching a positive result forever meant a provider outage got frozen into the record permanently. Now: complete → never expires; thin or missing → 7-day recheck; and a stale entry is still served as a fallback when the re-fetch also fails.

**Watch for:** Open Library's response shape varies by edition — records lack `number_of_pages`, or return authors in odd shapes. The mappers coerce defensively and `mappers.test.ts` pins the ragged cases.

---

## Google Books key

Optional, but the difference between a sparse catalogue and a good one. Without it, descriptions are usually absent and search falls back to Open Library's weaker ranking.

1. Google Cloud console → create a project → enable the **Books API**.
2. Credentials → create an **API key** → restrict it to the Books API.
3. `npx wrangler secret put GOOGLE_BOOKS_KEY`, then redeploy (secrets stay invisible to the running version until the next deploy).
4. Add it to `.dev.vars` for local work.

Free tier is 1,000 requests/day, and every lookup is cached, so a full cabinet costs well under that.

---

## Phase 2 — Barcode scanner & rapid scan loop

**Goal:** Point the phone at a book, scan, confirm in one tap, scan the next. After this phase the app is usable for its actual purpose.

- [ ] **2.1** Feature-detect `BarcodeDetector` with `EAN-13` support; dynamically import `html5-qrcode` only when absent, so devices with native support never download it.
- [ ] **2.2** Scanner screen: camera permission request and denial handling, viewfinder overlay, torch toggle where `ImageCapture` reports support, always-visible manual-entry and search links.
- [ ] **2.3** Detection handling: 2500 ms same-code debounce, ISBN checksum validation before lookup, silent rejection of non-book EAN-13s, beep + `navigator.vibrate(50)` on an accepted read.
- [ ] **2.4** Wire the scan result into the Phase 1 confirm sheet → save → auto-dismiss → camera resumes without user action.
- [ ] **2.5** Not-found path: offer manual search, or the manual form with the scanned ISBN prefilled. The scan is never wasted.
- [ ] **2.6** Session counter pill ("12 added this session").
- [ ] **2.7** Test on the actual phone and on a laptop webcam. Verify camera stream release on unmount and on route change.

**Exit:** Catalog one full cabinet in a single sitting without touching the keyboard except for oddball books.

**Watch for:** stream leaks. A camera that stays on after navigation is the most likely bug in this phase and the easiest to miss on desktop.

---

## Phase 3 — Library UI: cover grid, search, detail page

**Goal:** The app looks and feels like *your* library. The biggest UI chunk by a wide margin.

- [ ] **3.1** Cover grid: responsive columns per the UI spec, locked 2:3 aspect ratio, lazy loading, skeleton placeholders, generated fallback tile for missing covers (title + author on a hash-derived color).
- [ ] **3.2** List view toggle: compact rows (thumb, title, author, status chip, rating), persisted to `localStorage`.
- [ ] **3.3** Status visual language on tiles: Reading ribbon, Finished check badge, Unread unadorned, DNF muted.
- [ ] **3.4** Search bar (title / author / notes), filter chips (status, genre, format), sort menu — all server-driven through `/api/books` query params and reflected in the URL.
- [ ] **3.5** Book detail page: client-side dominant-color extraction on first view cached to `cover_color`, gradient header, metadata block, description.
- [ ] **3.6** Edit form and delete with confirm.
- [ ] **3.7** Empty states (first-run vs. filtered-empty, visually distinct) and loading states on every route.
- [ ] **3.8** Bulk edit mode: long-press or checkbox multi-select → set status, add tag, delete; applied via a single batched `PATCH /api/books/bulk`.

**Exit:** Browsing feels good on the phone. Any book is findable in under 5 seconds.

**Watch for:** cover hosts that don't send CORS headers will break canvas color extraction — detect and fall back to the neutral accent silently rather than logging errors on every detail view.

---

## Phase 4 — Reading features

**Goal:** Track what you're reading and what you've read.

- [ ] **4.1** Status transitions with automatic dates, enforced server-side in the PATCH handler (Reading → `started_at`; Finished → `finished_at` + rating prompt; Unread → reset `current_page`).
- [ ] **4.2** Page progress: −10 / +10 / +25 quick actions plus direct numeric entry, clamped to `page_count`, optimistic progress bar.
- [ ] **4.3** Currently Reading strip on home: cover, progress bar, tap-to-update without leaving the page.
- [ ] **4.4** Rating stars and notes editor on the detail page, both autosaving (rating on tap, notes on 1 s idle and on blur) with a visible saved indicator and retry on failure.
- [ ] **4.5** Finished filter defaulting to `finished_at DESC` — the reading-history view.

**Exit:** Your active read sits at the top of home with a live progress bar, updatable in two taps.

---

## Phase 5 — PWA, offline, polish, export

**Goal:** Installable, resilient, and safe.

- [ ] **5.1** Web manifest (name, icons at 192/512/512-maskable, theme color, standalone display) and an install affordance driven by `beforeinstallprompt`.
- [ ] **5.2** Serwist service worker: precache the app shell, stale-while-revalidate the library list so "do I own this?" works in a bookstore. No write queue — writes require network, and the UI says so.
- [ ] **5.3** Dark mode: warm amber-on-charcoal palette, system preference with a manual override, no flash of wrong theme on load.
- [ ] **5.4** `GET /api/export/csv` streaming route + Settings button. RFC 4180 escaping, UTF-8 BOM, `; `-joined arrays.
- [ ] **5.5** Performance pass: image sizing, bundle audit against the 150 KB budget, pagination at 60/page, virtualization only if the library exceeds ~300 books.
- [ ] **5.6** Final QA: scanner on Android Chrome, iOS Safari, and desktop; both lookup fallbacks; dedup; auth expiry; offline list; CSV opened in Sheets and Excel.

**Exit:** Installed on the phone home screen. Full cabinet catalog exported as a CSV backup that opens cleanly.

---

## Phase 6 — Backlog (post-v1, rough priority)

1. Stats page — read vs. unread, genre donut, books per year
2. TBR queue with drag-to-reorder
3. "Pick for me" — random unread shuffle with filters
4. Reading-day heatmap / streaks
5. Quotes capture with OCR
6. AI shelf-photo bulk import
7. Lending tracker, wishlist, series tracking, Year in Books

None of these require changing v1's schema — see [backend-schema.md §8](backend-schema.md#8-future-schema-post-v1-not-built).

---

## Effort map

| Phase | Estimate |
|---|---|
| 0 — Setup | One evening |
| 1 — Lookup & manual add | One weekend |
| 2 — Scanner | 2–3 evenings |
| 3 — Library UI | One weekend (largest) |
| 4 — Reading features | 2 evenings |
| 5 — PWA & polish | One weekend |

Roughly 3–4 weekends at side-project pace to a polished v1, with the app usable for real cataloging from the end of Phase 2.

---

## Dependency order

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
              │                        │
              └── the confirm sheet ───┘
                  built in 1.6 is reused
                  by 2.4 and 3.x — build
                  it once, properly
```

Phase 3 could technically run in parallel with Phase 2, but doing Phase 2 first means you start accumulating real books, and real data makes every Phase 3 decision better than lorem-ipsum ever would.

---

## Definition of done (per task)

1. Works on phone and desktop.
2. Loading, empty, and error states handled — not just the happy path.
3. Server-side validation exists for anything the UI validates.
4. No TypeScript errors, no console errors.
5. Deployed and verified on the live URL, not only locally.

---

## Related documents

- [PRD](prd.md) · [TRD](trd.md) · [App Flow](app-flow.md) · [UI/UX Spec](uiux.md) · [Backend Schema](backend-schema.md)
