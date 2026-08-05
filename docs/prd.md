# Stacks — Product Requirements Document (v1)

**Status:** Draft for build
**Owner:** Suhaib
**Last updated:** 2026-08-05

---

## 1. Summary

Stacks is a single-user personal book catalog. You point your phone at the barcode on a book you own, it looks up the metadata, and one tap later it's in your library. The library is presented cover-first — a wall of book covers you can scan visually the way you'd scan a physical shelf.

It is a PWA so one codebase serves the phone (where cataloging happens) and the laptop (where browsing and editing happen).

## 2. Problem

Physical books live in cabinets, stacked and unsorted. There is no way to answer basic questions without physically digging:

- *Do I already own this?* — asked in a bookstore, offline or on bad signal.
- *What do I own by this author?*
- *What have I not read yet?*
- *Where did I stop in the book I'm currently reading?*

Existing apps (Goodreads, StoryGraph) are social reading networks first and catalogs second. They push discovery, ratings-as-public-signal, and reviews. The requirement here is a private inventory of physically-owned books with reading state attached.

## 3. Goals

| # | Goal | Success measure |
|---|---|---|
| G1 | Cataloging is fast enough to do a whole cabinet in one sitting | ≥ 30 books added in 15 minutes, keyboard untouched except for oddballs |
| G2 | The library is visually browsable | Any owned book findable in < 5 seconds |
| G3 | "Do I own this?" works in a bookstore | Library list answers correctly with no/poor network |
| G4 | Reading state is tracked without ceremony | Updating progress is ≤ 2 taps from home |
| G5 | The data is never trapped | Full CSV export at any time |

## 4. Non-goals (v1)

Explicitly excluded, with rationale — all are backlog candidates, none are rejected forever:

- **Social features** (friends, public reviews, feeds) — this is a private inventory, not a network.
- **Location / cabinet tracking** — needs stable shelving that doesn't exist yet.
- **Lending tracker, wishlist** — low frequency; not worth v1 schema weight.
- **Stats dashboard, streaks, Year in Books** — needs a corpus of reading history first. Build after a year of data.
- **Quotes/highlights OCR, AI recommendations, shelf-photo bulk import** — each is its own project.
- **Series tracking, TBR drag-reorder queue** — v2.
- **Multi-user / sharing** — single user by design; auth exists to keep strangers out, not to model accounts.

## 5. Users

One user. Personal device set: Android phone (primary, does all scanning), laptop (secondary, browsing and bulk edits). Assume the user is technical, tolerant of rough edges in edit flows, and intolerant of friction in the scan loop.

**Design consequence:** optimize ruthlessly for the scan loop and the browse view. Everything else can be plain.

## 6. Core user stories

### Cataloging
- **S1** — As the owner, I can scan a book's barcode with my phone camera and have it added with correct title, author, cover, and page count, in one confirmation tap.
- **S2** — After saving, the camera immediately resumes so I can scan the next book without navigating.
- **S3** — If a scan finds nothing, I can search by title or fill a blank form without losing the ISBN I already scanned.
- **S4** — If a book has no barcode (old or regional editions), I can add it fully manually as a first-class path.
- **S5** — If I scan a book I already own, the app tells me immediately and links to the existing entry instead of creating a duplicate.
- **S6** — I can see a running count of books added this session.

### Browsing
- **S7** — I see my library as a grid of covers, dense enough to scan visually.
- **S8** — I can switch to a compact list when I want to read titles rather than recognize covers.
- **S9** — I can tell a book's read status at a glance from the grid, without opening it.
- **S10** — I can search by title, author, or my own notes.
- **S11** — I can filter by status, genre, and format, and sort by title, author, date added, or rating.
- **S12** — I can select multiple books and set status or add a tag in one action.

### Reading
- **S13** — I can mark a book Unread / Reading / Finished / DNF, and the relevant dates are recorded without me typing them.
- **S14** — When reading, I can bump my current page with quick increments or type an exact page.
- **S15** — Books I'm currently reading appear at the top of home with a progress bar.
- **S16** — I can rate a book 1–5 and keep private notes on it; both autosave.
- **S17** — I can view my finished books ordered by when I finished them.

### Ownership of data
- **S18** — I can install the app to my phone home screen.
- **S19** — I can open the app with no network and still see my library list.
- **S20** — I can export the whole library as CSV.

## 7. Functional requirements

### 7.1 Adding books
- **FR-1** Barcode scanning must recognize EAN-13 (ISBN) from a live camera feed, with torch toggle where the device supports it.
- **FR-2** A manual ISBN text input must be reachable in one tap from the scanner at all times.
- **FR-3** ISBN-10 and ISBN-13 must both be accepted, hyphenated or not, and normalized to ISBN-13 for storage and dedup.
- **FR-4** Metadata lookup queries Open Library first, Google Books second, and returns a merged record. Neither responding must not block the add — the confirm sheet opens with whatever was found, including nothing.
- **FR-5** The confirm sheet must allow editing title, authors, format, and status before save.
- **FR-6** Duplicate detection: exact ISBN-13 match blocks the add with a link to the existing book. A close title+author match shows a non-blocking warning ("You may already own this") with a link, and lets the user proceed.
- **FR-7** Books may be saved with no ISBN.

### 7.2 Library view
- **FR-8** Default view is a responsive cover grid: 3 columns on phone, 6–8 on desktop.
- **FR-9** Books without a cover render a generated tile showing title and author on a color derived from the title, not a broken image.
- **FR-10** Status is encoded visually on grid tiles: Reading = bookmark ribbon, Finished = check badge, Unread = normal, DNF = muted.
- **FR-11** Search, filter, and sort are resolved server-side via query parameters, not client-side over the full set.
- **FR-12** Bulk edit mode supports multi-select → set status, add tag, or delete.

### 7.3 Book detail
- **FR-13** Detail page shows a large cover with a header gradient derived from the cover's dominant color, computed client-side on first view and cached to the record.
- **FR-14** Status control, page progress (when Reading), rating, and notes are all editable inline with autosave.
- **FR-15** Delete requires an explicit confirm.

### 7.4 Reading state
- **FR-16** Setting status to Reading sets `started_at` if unset. Setting Finished sets `finished_at` and prompts for a rating. Both dates remain manually editable.
- **FR-17** Page progress offers +10 / +25 quick actions and direct numeric entry, and renders a progress bar against `page_count` when known.

### 7.5 Platform
- **FR-18** Installable PWA with manifest and icons.
- **FR-19** Service worker caches the app shell and the most recent library list (stale-while-revalidate). Writes require network — no offline write queue in v1.
- **FR-20** Dark mode follows system preference with a manual override.
- **FR-21** CSV export streams the full library with all user-owned fields.
- **FR-22** Access is gated behind a single passphrase; an unauthenticated visitor sees only the login page.

## 8. Non-functional requirements

- **NFR-1 — Scan latency.** Barcode detected → confirm sheet visible in under 1.5 s on a normal connection. Lookup timeout is 4 s per provider; on timeout the sheet opens with the ISBN prefilled rather than hanging.
- **NFR-2 — Repeat lookups are free.** ISBN lookups are cached in the database; a re-scan never re-hits an external API.
- **NFR-3 — Library load.** Grid first paint under 1 s for a 300-book library; pagination or virtualization beyond that.
- **NFR-4 — Cost.** Must run entirely within Cloudflare free tiers.
- **NFR-5 — Durability.** No data loss on deploy. Schema changes go through versioned migrations.
- **NFR-6 — Camera security.** Scanner requires HTTPS; satisfied by the hosting platform.

## 9. Key risks

| Risk | Impact | Mitigation |
|---|---|---|
| Regional/older Indian-market editions missing from both APIs | Cataloging stalls on a meaningful fraction of the shelf | Manual entry is a first-class path, one tap from the scanner, with ISBN prefilled. Never a dead end. |
| iOS Safari lacks `BarcodeDetector`; JS fallback is inconsistent | Scanner unusable on iPhone | Primary device is Android. `html5-qrcode` fallback plus always-visible manual ISBN entry. |
| Google Books quota throttling | Lookups fail intermittently | Open Library is primary for ISBN; Google Books is enrichment only. All lookups cached by ISBN. |
| Cover URLs rot over time | Grid degrades into placeholders | Store ISBN alongside cover URL so covers can be re-derived; add a "re-fetch cover" action; CSV export as the backstop. |
| Scanner misreads a digit | Wrong book saved | ISBN checksum validation rejects invalid codes before lookup; confirm sheet shows the cover, which makes a wrong match obvious. |

## 10. Release criteria for v1

1. Deployed, passphrase-gated, reachable from phone and laptop.
2. One full cabinet cataloged end-to-end via camera scanning in a single sitting.
3. Duplicate scan blocked with a working link to the existing entry.
4. A no-ISBN book added via the manual path.
5. Grid and list views usable on phone; search returns correct results.
6. An active read visible on home with a live progress bar.
7. Installed to phone home screen; library list renders with the network off.
8. CSV export opens cleanly in Sheets/Excel with all books.

## 11. Related documents

- [Technical Requirements](trd.md)
- [App Flow](app-flow.md)
- [UI/UX Spec](uiux.md)
- [Backend Schema](backend-schema.md)
- [Implementation Plan](implementation-plan.md)
