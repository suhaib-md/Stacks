# Stacks — UI/UX Specification (v1)

**Companion to:** [App Flow](app-flow.md)
**Last updated:** 2026-08-05

---

## 1. Design principle

**The covers are the interface.**

A physical shelf is browsable because covers are recognizable. Stacks reproduces that: the UI is a quiet, paper-toned frame around a wall of covers. Chrome recedes; book art carries the visual weight. Every decision below follows from that — neutral surfaces, restrained accents, typography that reads as print rather than dashboard.

Two moods, one system:
- **Light** — paper and ink. Warm off-white, near-black text, thin rules.
- **Dark** — reading lamp. Warm charcoal, amber accent, nothing pure black or pure white.

---

## 2. Color tokens

Defined as CSS custom properties on `:root`, overridden under `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`. Tailwind consumes them via theme extension, so utilities stay semantic (`bg-surface`, `text-ink`).

### Light — paper & ink

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FAF7F2` | Page background |
| `--surface` | `#FFFFFF` | Cards, sheets |
| `--surface-sunk` | `#F1ECE4` | Inputs, skeletons, chip rests |
| `--ink` | `#1C1917` | Primary text |
| `--ink-muted` | `#6B625A` | Secondary text, metadata |
| `--ink-faint` | `#A39A90` | Placeholders, disabled |
| `--rule` | `#E4DDD3` | Borders, dividers |
| `--accent` | `#8A5A2B` | Primary action, active state (warm leather brown) |
| `--accent-soft` | `#F0E4D6` | Accent-tinted fills |
| `--success` | `#3F6B4A` | Finished badge |
| `--danger` | `#9B3B2E` | Destructive actions |

### Dark — reading lamp

| Token | Value | Use |
|---|---|---|
| `--paper` | `#16130F` | Page background (warm charcoal, never `#000`) |
| `--surface` | `#211C17` | Cards, sheets |
| `--surface-sunk` | `#2C251E` | Inputs, skeletons |
| `--ink` | `#F2EBE1` | Primary text (warm off-white, never `#FFF`) |
| `--ink-muted` | `#A99C8C` | Secondary text |
| `--ink-faint` | `#75695B` | Placeholders, disabled |
| `--rule` | `#332B23` | Borders |
| `--accent` | `#E0A458` | Primary action (warm amber) |
| `--accent-soft` | `#3A2C1C` | Accent-tinted fills |
| `--success` | `#7FA98A` | Finished badge |
| `--danger` | `#D97A66` | Destructive actions |

### Per-book accent
`cover_color` (dominant hex from the cover) drives only the detail-page header gradient and nothing else. It is clamped into a legible lightness band before use. It never colors text or interactive controls — a book's cover shouldn't be able to make a button unreadable.

---

## 3. Typography

| Role | Family | Weight / size |
|---|---|---|
| Display — book titles on detail, screen headings | **Fraunces** (fallback Lora, then Georgia) | 600 · 24–36 px, `-0.01em` tracking |
| Title — titles in list rows and cards | Fraunces | 500 · 16–18 px |
| Body — descriptions, notes, metadata | System sans stack | 400 · 14–16 px, 1.6 line height |
| Meta — labels, chips, counts | System sans | 500 · 12–13 px, `0.02em`, often uppercase |
| Numeric — page counts, progress | System sans, tabular figures | 400 · 13–14 px |

Fraunces is loaded variable, subset to Latin, `font-display: swap`, and self-hosted. The body stack is native — no download, no layout shift, correct on every OS.

Descriptions cap at ~68 characters per line for readability.

---

## 4. Spacing, shape, elevation

- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 px. Nothing off-scale.
- **Radius:** 4 px on covers (books have sharp corners), 8 px on cards and inputs, 16 px on bottom sheets, full on chips and the FAB.
- **Elevation:** used sparingly. Bottom sheets and the FAB get a soft shadow; grid tiles get a 1 px `--rule` border instead — shadows on a dense cover grid create visual noise.
- **Touch targets:** 44 × 44 px minimum on anything tappable.

---

## 5. Components

### 5.1 Cover tile (grid)

```
┌───────────────┐
│▎              │  ← ribbon (Reading only), top-left, --accent
│               │
│    COVER      │   aspect-ratio 2:3, object-fit: cover
│               │
│            ✓  │  ← check badge (Finished only), bottom-right
└───────────────┘
  Title             Fraunces 500, 2 lines max, ellipsis
  Author            sans, --ink-muted, 1 line
```

- Aspect ratio is locked at 2:3 so the grid never reflows as images load.
- `loading="lazy"` with explicit width/height.
- **Status treatment:** Reading → accent ribbon top-left. Finished → small check badge bottom-right. Unread → no adornment (the default state deserves no decoration). DNF → cover at 55% opacity with a subtle grayscale filter.
- **No cover:** generated tile — title and author in Fraunces on a background color derived deterministically from a hash of the title, kept in a muted band so it reads as a book spine, not an error.
- **Press:** scale to 0.97 with a 120 ms ease-out.

### 5.2 Grid

| Breakpoint | Columns | Gutter |
|---|---|---|
| < 480 px | 3 | 12 px |
| 480–768 px | 4 | 16 px |
| 768–1024 px | 5 | 16 px |
| 1024–1440 px | 6 | 20 px |
| > 1440 px | 8 | 20 px |

CSS Grid with `repeat(auto-fill, minmax(...))` so it degrades gracefully at any width.

### 5.3 List row (compact)

```
┌──────────────────────────────────────────────┐
│ ▯  Title of the Book                    ★★★★ │
│    Author Name          ·  Reading  ·  p.142 │
└──────────────────────────────────────────────┘
```
56 px tall, 36 × 54 px cover thumbnail, status as a text chip, rating as filled stars only (no empty stars in list density).

### 5.4 Currently Reading strip

Horizontally scrolling cards, 140 px wide, snap-aligned. Each card: cover, title (1 line), progress bar, `142 / 320` in tabular figures. Tapping the bar opens the progress sheet without leaving home. The whole strip is absent — not empty — when nothing is Reading.

### 5.5 Confirm bottom sheet

The single most-used component in the app.

```
        ╭─────────────────────────╮
        │           ▬▬            │  grab handle
        │  ┌────┐                 │
        │  │cover│ Title           │
        │  └────┘ Author           │
        │         Publisher · 2019 │
        │         320 pages        │
        │  ⚠ You may already own   │  ← only when fuzzy match
        │    this · View           │
        │                          │
        │  Format  [Paperback ▾]   │
        │  Status  [Unread    ▾]   │
        │                          │
        │  [   Skip   ] [  Save  ] │
        ╰─────────────────────────╯
```

- Rises from the bottom in 220 ms with a spring ease; dismisses on swipe-down, back gesture, or Skip.
- Save is the full-width-weighted primary action, thumb-reachable at the bottom right.
- Title and authors are tap-to-edit inline — no separate edit screen inside the loop.
- Identical component on the scan path and the search path. One component, one set of behaviors, one place to fix bugs.

### 5.6 Scanner screen

Full-bleed camera. Overlay: a rounded rectangle viewfinder with the surrounding area dimmed to 55% and a horizontal accent scan line, dropping to 30% opacity after 3 s to avoid becoming a distraction.

Chrome: back (top-left), torch toggle (top-right, only when `ImageCapture` reports torch support), session counter pill (top-center, "12 added"), and two links at the bottom — "Enter ISBN" and "Search by title". Both are always visible. The escape hatch is never hidden behind a menu.

### 5.7 Chips, buttons, inputs

- **Filter chip:** pill, `--surface-sunk` at rest, `--accent-soft` background with `--accent` text and a 1 px accent border when active. Active filters also show a count.
- **Primary button:** `--accent` fill, `--paper` text, 8 px radius, 44 px tall.
- **Secondary:** transparent with a `--rule` border.
- **Destructive:** `--danger` text on transparent; solid fill only inside a confirm dialog.
- **Input:** `--surface-sunk` fill, no border at rest, 2 px `--accent` ring on focus.
- **FAB:** 56 px, `--accent`, book-with-scan-line icon, bottom-right, 16 px above the tab bar.

### 5.8 Progress control

`[ −10 ]  [ 142 ]  [ +10 ]  [ +25 ]` — a segmented row with a tabular-figure editable center. The bar beneath is 4 px tall, `--accent` on `--surface-sunk`, with the percentage to the right. Optimistic: the bar moves on tap, before the response.

### 5.9 Rating stars

Five stars, 24 px, `--accent` when filled and `--ink-faint` outline when not. Tapping the currently-set rating clears it. No half stars — the extra precision isn't worth the tap accuracy cost.

---

## 6. Motion

| Interaction | Motion | Duration |
|---|---|---|
| Bottom sheet in/out | Translate Y + fade | 220 ms, spring `(0.32, 0.72, 0, 1)` |
| Tile press | Scale 0.97 | 120 ms ease-out |
| Page transition | Fade | 150 ms |
| Toast | Slide up + fade | 200 ms in, 3 s dwell, 150 ms out |
| Skeleton | Shimmer sweep | 1.4 s loop |
| Cover color header | Background cross-fade once extracted | 400 ms ease |

Everything above collapses to opacity-only or instant under `prefers-reduced-motion: reduce`.

---

## 7. Empty, loading, and error states

| State | Treatment |
|---|---|
| Empty library (first run) | Centered line illustration of a small stack of books · "Your shelves are empty" · "Scan your first book" primary button → `/add` |
| Empty from filters | "No books match these filters" · Clear filters button. Visually distinct from first run — never imply the library is empty when it isn't. |
| Loading grid | Skeleton tiles at exact 2:3 dimensions with shimmer. Count matches the current breakpoint's columns × 3 rows. |
| Loading detail | Skeleton header block, no spinner. |
| Lookup in flight | Inline spinner in the confirm sheet position, not a full-screen blocker — the camera stays live behind it. |
| Offline | Amber banner under the header: "Offline — showing your last synced library." Write actions dimmed with a tooltip. |
| Failed save | Toast with a Retry action. The form is never cleared on failure. |

Spinners are a last resort. Skeletons that match final layout are the default, because they don't cause a shift when content lands.

---

## 8. Responsive behavior

| | Phone (< 768) | Desktop (≥ 768) |
|---|---|---|
| Navigation | Bottom tab bar | Top nav |
| Add action | FAB → full-screen scanner | Header button → ISBN input + search (webcam scanning offered if available) |
| Confirm | Bottom sheet | Centered modal, 420 px wide |
| Detail | Single column, cover above metadata | Two columns — cover and actions left (sticky), metadata and description right |
| Filters | Horizontally scrolling chip row | Full chip row, no scroll |
| Bulk select | Long-press to enter | Hover checkbox, shift-click for ranges |

---

## 9. Accessibility

- Contrast: body text ≥ 4.5:1, large display text ≥ 3:1, in both themes. `--accent` on `--paper` and `--paper` on `--accent` are both verified.
- Status is never conveyed by color alone — the ribbon has a shape, the check badge has an icon, and every status also has a text label in list view and on detail.
- All covers carry `alt="Cover of {title} by {authors}"`.
- Full keyboard operation: grid is arrow-navigable, the sheet traps focus and restores it on close, Escape dismisses.
- Live regions announce save confirmations, scan detections, and errors.
- `prefers-reduced-motion` respected throughout, including the scanner's scan line.
- Scanner offers a non-visual path: the manual ISBN input is a real, focusable, labeled form control at all times.

---

## 10. Iconography and assets

Single line-icon set (Lucide), 20 px default at 1.5 px stroke, inheriting `currentColor`. Custom marks: the app icon (a small stack of books) and the FAB's book-with-scan-line. PWA icons at 192, 512, and 512-maskable.

---

## 11. Related documents

- [PRD](prd.md) · [TRD](trd.md) · [App Flow](app-flow.md) · [Backend Schema](backend-schema.md) · [Implementation Plan](implementation-plan.md)
