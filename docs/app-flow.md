# Stacks — App Flow (v1)

**Companion to:** [PRD](prd.md) · [UI/UX Spec](uiux.md)
**Last updated:** 2026-08-05

Describes every screen, every transition between them, and what happens on each path — including the ones that fail.

---

## 1. Route map

| Route | Screen | Rendering |
|---|---|---|
| `/login` | Passphrase gate | Server, public |
| `/` | Library (home) | Server |
| `/book/:id` | Book detail | Server |
| `/book/:id/edit` | Edit form | Server + client form |
| `/add` | Scanner | Client |
| `/add/search` | Manual title/author search | Client |
| `/add/manual` | Blank manual entry form | Client |
| `/settings` | Settings | Server |

Filters and view mode are URL search params on `/`: `?q=&status=&genre=&format=&sort=&order=&view=grid|list&page=`.

---

## 2. Entry and auth

```
Open app
   │
   ├─ valid session cookie ──► Library (/)
   │
   └─ no/expired cookie ─────► /login
                                  │
                        enter passphrase
                                  │
                    ┌─────────────┴─────────────┐
                 correct                     wrong
                    │                           │
        set signed cookie (30d)      inline error, stay
                    │                (rate-limited after N tries)
                    ▼
            redirect to originally requested route
```

The requested path is preserved through login so a shared or bookmarked deep link lands where it was meant to.

---

## 3. Library (home) — `/`

### Layout, top to bottom
1. Header: app title, search input, view toggle (grid/list), sort menu.
2. **Currently Reading strip** — horizontal scroller of `read_status = 'reading'` books, each showing cover, title, and a progress bar. Hidden entirely when nothing is being read.
3. Filter chips: status, genre, format. Active chips are visually distinct and reflected in the URL.
4. Cover grid (default) or compact list.
5. FAB → `/add` (mobile). Desktop shows an "Add book" button in the header.
6. Bottom tab bar on mobile: Library · Add · Settings.

### Interactions

| Action | Result |
|---|---|
| Type in search | Debounced 300 ms → updates `?q=` → server re-renders results |
| Tap filter chip | Toggles that value in the URL, resets to page 1 |
| Change sort | Updates `?sort=&order=` |
| Toggle view | Updates `?view=`, persisted to `localStorage` as the default for next visit |
| Tap a cover | → `/book/:id` |
| Long-press a cover (or check a box on desktop) | Enters **bulk edit mode** |
| Tap a Currently Reading card | → `/book/:id` |
| Tap the progress bar on a Currently Reading card | Opens the page-progress sheet inline, without leaving home |
| Tap FAB | → `/add` |
| Scroll to bottom | Loads the next page (60 per page) |

### States
- **First run, empty library** — illustration plus "Scan your first book" leading straight to `/add`.
- **Empty due to filters** — "No books match these filters" plus a Clear filters action. Never confuse this with a genuinely empty library.
- **Loading** — skeleton tiles at grid dimensions, so nothing shifts when real covers land.
- **Offline** — cached list renders with a small "Offline — showing your last synced library" banner. Add actions are disabled with an explanation.

### Bulk edit mode
```
Long-press a cover
   │
   ▼
Selection mode: checkboxes on every tile, action bar replaces header
   │  ("3 selected"  ·  Set status ▾  ·  Add tag  ·  Delete  ·  Cancel)
   │
   ├─ Set status ──► picker ──► PATCH /api/books/bulk ──► exit mode, refresh
   ├─ Add tag ─────► tag input ► PATCH /api/books/bulk ──► exit mode, refresh
   ├─ Delete ──────► confirm dialog naming the count ──► bulk delete
   └─ Cancel ──────► exit mode, clear selection
```

---

## 4. Add via scan — `/add`

The core loop. Every decision here is subordinate to keeping it fast.

```
                        ┌──────────────────────────┐
                        │  /add  — camera opens    │
                        │  viewfinder · torch      │
                        │  session counter         │
                        │  "Enter ISBN" · "Search" │
                        └────────────┬─────────────┘
                                     │
                   ┌─────────────────┼──────────────────┐
          camera denied         barcode detected    tap Enter ISBN
                   │                 │                  │
                   ▼                 ▼                  ▼
        ┌────────────────┐   debounce 2500ms    ┌───────────────┐
        │ Permission     │   validate checksum  │ ISBN keypad   │
        │ explainer +    │           │          │ input         │
        │ ISBN input     │      invalid ──► ignore, keep scanning
        └───────┬────────┘           │                  │
                │              beep + vibrate           │
                │                    │                  │
                └────────────────────┼──────────────────┘
                                     ▼
                    GET /api/lookup/isbn/:isbn  (4s timeout)
                                     │
        ┌────────────────────────────┼─────────────────────────────┐
     found                    not found / timeout            already owned
        │                            │                       (409 on save,
        ▼                            ▼                     or pre-checked)
┌───────────────────┐   ┌─────────────────────────┐            │
│  CONFIRM SHEET    │   │ "Couldn't find that ISBN"│           ▼
│  cover · title    │   │  · Search by title       │  ┌──────────────────┐
│  authors · format │   │  · Add manually (ISBN    │  │ "Already in your │
│  status (Unread)  │   │    prefilled)            │  │  library"        │
│  [Save]  [Skip]   │   │  · Skip                  │  │  [View] [Keep    │
└─────────┬─────────┘   └────────────┬─────────────┘  │   scanning]      │
          │                          │                 └────────┬────────┘
       Save                          │                          │
          │                          │                          │
   POST /api/books                   │                          │
          │                          │                          │
          ▼                          │                          │
  toast "Added · 12 this session" ◄──┴──────────────────────────┘
          │
          ▼
  sheet dismisses, camera resumes automatically
```

### Rules that keep the loop fast
- The camera **never stops** while the confirm sheet is open on a phone that can handle it; on constrained devices it pauses detection but keeps the stream, so resuming is instant.
- Save is a single tap. The sheet's defaults (status Unread, format from the metadata or last-used) are correct often enough that editing is the exception.
- **Skip** is always present. A book that resists cataloging should cost one tap, not a detour.
- The session counter increments on every save and resets when the scanner unmounts. It exists purely as cataloging momentum.
- A "possible duplicate" warning (fuzzy title+author) appears inside the confirm sheet as an inline note with a link — it never blocks Save.

---

## 5. Manual search — `/add/search`

```
Query box (title and/or author)
        │
   submit (or 400ms debounce)
        │
   GET /api/lookup/search?q=
        │
 ┌──────┴───────┐
results       no results
 │              │
 ▼              ▼
Result cards   "Nothing found"
(cover, title,  · Add manually ──► /add/manual (query prefilled into title)
 author, year,  · Edit search
 publisher)
 │
tap a card
 │
 ▼
CONFIRM SHEET (same component as the scan path)
 │
Save ──► POST /api/books ──► toast ──► back to results, list retained
```

The results list is retained after a save so several books from one search — an author's backlist, say — can be added in sequence.

---

## 6. Manual entry — `/add/manual`

Reached from: a failed scan (ISBN prefilled), a failed search (title prefilled), or directly.

Fields: title *(required)*, subtitle, authors (repeatable), publisher, published year, page count, ISBN-13, ISBN-10, genre, tags, format, language, cover URL, description, status, rating, notes.

Only title is required. `source` is recorded as `manual`. On save → `/book/:id` for the new book, since a manual entry usually wants a look-over, unlike a scan.

---

## 7. Book detail — `/book/:id`

```
┌──────────────────────────────────────────┐
│  ← back            [edit]  [⋯ delete]    │
│  ╔══════════════════════════════════════╗│
│  ║  gradient header from cover_color    ║│
│  ║        ┌──────────┐                  ║│
│  ║        │  cover   │   Title          ║│
│  ║        │          │   Subtitle       ║│
│  ║        └──────────┘   Authors        ║│
│  ╚══════════════════════════════════════╝│
│  [ Unread | Reading | Finished | DNF ]   │
│  ─ progress bar + page controls (Reading)│
│  ★ ★ ★ ★ ☆   rating                      │
│  Notes  (textarea, autosaves)            │
│  ── metadata: publisher · year · pages   │
│     format · language · genre · tags     │
│     ISBN · added date                    │
│  Description                             │
└──────────────────────────────────────────┘
```

### On first view
If `cover_color` is null, the client extracts the dominant color from the cover and PATCHes it back. The header renders in the neutral accent until it lands, then transitions. Extraction failure is silent.

### Status transitions

| From → To | Side effects |
|---|---|
| any → Reading | `started_at` set if null; page controls appear; book joins the Currently Reading strip |
| any → Finished | `finished_at` set if null; `current_page` set to `page_count` if known; rating prompt appears if unrated |
| any → Unread | `current_page` reset to 0; dates preserved |
| any → DNF | `finished_at` set if null; tile becomes muted in the grid |

All handled server-side (see [TRD §6](trd.md#6-business-rules-enforced-server-side)) so the rules hold no matter which surface triggers them.

### Page progress
`[ −10 ]  [ current page input ]  [ +10 ]  [ +25 ]` with a progress bar when `page_count` is known. Updates PATCH optimistically — the bar moves immediately and reconciles on response. Clamped to `[0, page_count]`.

### Notes and rating
Both autosave: notes on a 1 s idle debounce and on blur, rating immediately on tap. A small "Saved" indicator confirms; a failure surfaces a retry rather than silently dropping the text.

### Delete
Confirmation dialog naming the book title → DELETE → back to library with an "Deleted *Title*" toast.

---

## 8. Settings — `/settings`

- **Export CSV** — triggers `/api/export/csv` download.
- **Theme** — System / Light / Dark, persisted to `localStorage`.
- **Default view** — Grid / List.
- **Install app** — shown only when the browser fires `beforeinstallprompt` and the app is not already installed.
- **Library stats** — plain counts: total books, by status. Not a dashboard.
- **Sign out** — clears the session cookie.

---

## 9. Error and edge-case handling

| Situation | Behavior |
|---|---|
| Camera permission denied | Explainer with OS-specific re-enable hint; manual ISBN input immediately below. Never a dead end. |
| No camera at all (desktop) | `/add` opens directly in ISBN-input mode with a prominent link to search. |
| Both metadata providers time out | Confirm sheet opens with the ISBN prefilled and every other field blank and editable. The scan is never wasted. |
| Duplicate ISBN on save | 409 → "Already in your library" with View and Keep scanning. |
| Fuzzy title/author match | Inline warning inside the confirm sheet with a link. Non-blocking. |
| Cover URL 404s | Generated fallback tile (title + author on a color derived from the title). Never a broken-image icon. |
| Offline on `/` | Cached list plus offline banner; write actions disabled with the reason shown. |
| Offline on `/add` | Scanner is blocked with "Adding books needs a connection." Detection is not run — a scan that can't be looked up is only a false promise. |
| Session expired mid-action | 401 → redirect to `/login` preserving the current path; in-progress form state is kept in `sessionStorage` where feasible. |
| Invalid ISBN typed manually | Inline validation before any request: "That doesn't look like a valid ISBN." |

---

## 10. Navigation model

**Mobile** — bottom tab bar (Library · Add · Settings), always visible except on the full-screen scanner and inside bulk edit mode. FAB on Library for the scanner.

**Desktop** — top nav with the same three destinations plus an "Add book" button. No FAB.

**Back behavior** — Detail → Library restores scroll position and filters (both live in the URL). Confirm sheet dismisses on back rather than leaving the scanner. The scanner's back exits to Library and releases the camera stream.

---

## 11. Related documents

- [PRD](prd.md) · [TRD](trd.md) · [UI/UX Spec](uiux.md) · [Backend Schema](backend-schema.md) · [Implementation Plan](implementation-plan.md)
