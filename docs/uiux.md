# Stacks — UI/UX Specification (v2 · the ledger)

**Companion to:** [App Flow](app-flow.md)
**Last updated:** 2026-08-18
**Source:** the `Stacks Redesign.dc.html` design canvas, direction **1b — the ledger**.

> Where a screen disagrees with this sheet, the sheet wins.

---

## 1. Design principle

**The library is a ledger, and the covers are the only colour in it.**

A catalogue is something you read down, not something you decorate. Regions are
divided by ink rules, labels sit flush left, numbers are tabular, and nothing
floats. Everything the app draws is ink, red or acid — which is exactly what
makes a wall of book covers read as the content rather than as more chrome.

Three rules carry the whole system:

- **Red commits.** The accent marks the one action on a screen that adds or
  changes something. Active nav and section labels borrow it; nothing else does.
- **Acid is progress.** `#d6f34a` means reading progress and appears nowhere
  else — not on a stat bar, not on a chip, not on a cover.
- **Rules divide.** 2px between regions, 1px between rows in a table. There are
  no shadows and no rounded corners anywhere.

---

## 2. Colour

Defined as CSS custom properties in [src/app/globals.css](../src/app/globals.css)
and consumed through Tailwind's `@theme inline`, so one class responds to the
theme swap.

### Light

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f3f2f2` | Page ground |
| `--surface` | `#f3f2f2` | Same ground — there is no elevation |
| `--surface-sunk` | `#eae9e9` | Rail, inputs, filled fields |
| `--ink` | `#201e1d` | Text, rules, bar fills |
| `--rule` | `#201e1d` | Major divider (2px) |
| `--rule-minor` | `rgba(32,30,29,.22)` | Row divider inside one table (1px) |
| `--accent` | `#ec3013` | The action that commits, active nav, section labels |
| `--accent-pressed` | `#c1270f` | Pressed state |
| `--on-accent` | `#f3f2f2` | Label on a solid accent fill |
| `--progress` | `#d6f34a` | Reading progress **only** |
| `--progress-track` | `rgba(32,30,29,.15)` | The track behind it |

### Dark — the inversion

Ground goes to `#131211`, sunk to `#1c1b1a`, ink and rules to `#f3f2f2`, minor
rules to `rgba(243,242,242,.16)`, the progress track to 18% paper. **Red, acid
and covers are untouched** — they are the only colour in either theme.

`--success` resolves to ink, not green: status is words and position, never hue.

---

## 3. Type

One family, two voices. **Archivo** is variable on the width axis, so the
expanded display cut is the same font widened rather than a second download.
Loaded via `next/font` with `axes: ["wdth"]`.

| Role | Spec | Class |
|---|---|---|
| Display / screen title | Archivo Expanded 600 · 40px / 1.0 · uppercase | `.disp` |
| Book title, detail | Archivo Expanded 600 · 46px / 1.02 · `-.01em` | `.font-display` |
| Book title, tile & row | Archivo Expanded 600 · 15px / 1.15 | `.font-display` |
| Body | Archivo 400 · 13px / 1.5 | default |
| Label / caption | Archivo 500 · 10px · `.14em` · uppercase | `.lbl` |
| Figure | Archivo Expanded 600 · 54px · tabular | `.disp .tabular` |

`.lbl` and `.tabular` both set `font-variant-numeric: tabular-nums`.

---

## 4. Rules that never bend

| | |
|---|---|
| **Radius** | 0 everywhere. No exceptions, including covers. |
| **Divider, major** | 2px solid ink — between regions, around controls, under headers. |
| **Divider, minor** | 1px at 22% ink — between rows inside one table. |
| **Rule on dark** | 2px `#f3f2f2` major, 1px `rgba(243,242,242,.16)` minor. |
| **Alignment** | Everything flush left, including labels inside wide buttons. |
| **Numbers** | `font-variant-numeric: tabular-nums` on every count, page and date. |
| **Elevation** | None. Sheets sit on a 2px rule, not a shadow. |
| **Hit target** | 44px minimum on mobile, 34px on desktop chrome. |

---

## 5. The six states

Every interactive element takes exactly these:

| State | Treatment |
|---|---|
| Rest | 2px ink border, transparent fill |
| Hover | 8% ink fill, border unchanged |
| Pressed | `--accent-pressed` fill, paper label |
| Focus | 2px accent outline, 2px offset (global, from `:focus-visible`) |
| Disabled | 45% opacity, no other change |
| Selected | Solid accent, paper label |

---

## 6. Layout

**Desktop** — a permanent 248px left rail that never collapses or hides
([AppShell](../src/components/nav/AppShell.tsx)): wordmark, primary nav, a
per-route slot, and the two standing actions (Export CSV, Settings). The Library
fills that slot with search and every filter with its count, via the `@rail`
parallel route.

**Mobile** — the same nav as a bottom tab bar, with a wordmark bar on top. The
toolbar carries search and the status chips, since there is no rail to hold them.

| | Phone (< 768) | Desktop (≥ 768) |
|---|---|---|
| Navigation | Bottom tab bar | Permanent left rail |
| Filters | Toolbar chips + genre disclosure | Rail, all visible with counts |
| Grid | 2–3 columns | 5–8 columns |
| Confirm | Bottom sheet on a 2px top rule | Centred panel with a 2px border |

---

## 7. Status and progress

Status is **never conveyed by colour**. It is words in the caption block, and
position in the segmented control. The one visual treatment:

> A did-not-finish cover drops to **50% opacity** in the grid and the list.
> Nothing else marks it.

Progress is the acid bar on its track: **10px** on a detail page, **6–8px** in a
list, **4px** in the rail. A book with no page count shows no bar at all rather
than a fake one.

---

## 8. Covers

Covers are the only full-colour thing in the app. Real jackets and generated
stub art drop into the same 2:3 box with a 2px ink border and nothing else
marking them apart.

Generated covers are a **flat** field in the book's own colour — no gradient, no
bands — with the title set on it and the label colour chosen by luma
([`readableOn`](../src/lib/cover.ts)). The palette is the one place colour is
allowed to be loud; it deliberately excludes the system red and the acid, since
a cover wearing either would make those readings ambiguous on a shelf.

---

## 9. Voice

| | |
|---|---|
| **Say** | "Your shelves are empty." · "That phrase didn't match." · "No books match these filters." |
| **Don't say** | "Oops!" · "Let's get started!" · "You're all set 🎉" |
| **Counts** | Always exact and always tabular: 142 books, 12,406 pages. |
| **Errors** | State what happened, then the way out. Never a lone red toast. |
| **Dates** | 14 Aug in tables, 14 August 2026 in prose. No relative times. |

An empty library and a filter that matches nothing must never look alike: the
first is a poster with one instruction, the second a quiet line above the
toolbar that stays put, because the library is right there behind it.

---

## 10. Accessibility

- Contrast: body text ≥ 4.5:1 in both themes. Ink on ground and paper on ink
  both clear it comfortably; accent-on-ground is used for labels and active nav.
- Status is never colour alone — see §7.
- Covers carry `alt="Cover of {title} by {authors}"`; generated ones are
  `role="img"` with an equivalent label.
- Focus is a 2px accent outline at 2px offset, set globally so no control can
  forget it.
- `prefers-reduced-motion` collapses every animation.

---

## 11. Related documents

- [PRD](prd.md) · [TRD](trd.md) · [App Flow](app-flow.md) · [Backend Schema](backend-schema.md) · [Implementation Plan](implementation-plan.md)
