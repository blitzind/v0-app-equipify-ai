# Dispatch + Scheduling Workflow Refinement — Phase 3

Date: 2026-05-07

Phase 3 focuses on **density and hierarchy**. Phases 1 and 2 added a lot of
operational intelligence to the dispatch board (status filters, conflict
warnings, KPI tiles, week overview). At higher data volumes the page started
feeling like a wall of chips and tiles. Phase 3 collapses everything that
isn't part of the most common scheduling decision into opt-in panels while
keeping every signal one click away.

## Goals

- Dispatch board feels like a **command center**, not a control panel.
- Default view shows **fewer tiles, fewer chips**, more whitespace.
- Hierarchy: **date → status → board**. Everything else is optional.
- Operational intelligence (cert pending, invoice aging, etc.) is **preserved
  in full** — just not all visible at once.

## What changed

### 1. Operational snapshot — compact + collapsible

`app/(dashboard)/dispatch/page.tsx`

- Default tile set reduced from 11 → **5**: Due today, Overdue, Unassigned
  48h+, Ready to bill, Cert pending. Each tile is a horizontal row, not a
  vertical stack — about half the previous height.
- Remaining 7 tiles (Tomorrow, Next 7 days, Unbilled / CNI, Overdue invoice,
  PM overdue, Cal overdue, Priority / urgent) live behind **"View all
  signals"**. State is per-org-persisted (`localStorage`).
- Clicking the same tile twice now **toggles** the focus filter back to
  "All jobs" — no more dead-ends after drilling into a metric.
- Added `billing_ready` to the page's KPI count so "Ready to bill" works.

### 2. Filter row — primary chips + "More filters" panel

- The 21-option focus chip strip used to render inline below the snapshot.
  It now lives behind a **More filters** button that:
  - Shows an active count badge when a focus filter is set.
  - Persists open/closed state per org.
  - Opens a panel with all `DISPATCH_FOCUS_OPTIONS` chips at h-7, less
    visual weight.
- A separate **active focus chip** (e.g. `Cert pending ✕`) renders inline so
  dispatchers always see what's filtering the view, even when the panel is
  closed.
- Status chips (`DispatchStatusFilter`) and the "Include invoiced" toggle
  remain visible at all times.

### 3. Week overview — opt-in

- The week overview table is now **collapsed by default** behind a
  **Show week overview / Hide week overview** button (also persisted per
  org).
- The page is no longer dominated by a tall density grid before the dispatch
  grid loads.

### 4. Section hierarchy on the board

`components/dispatch/dispatch-board.tsx`

- Renamed the left rail from `Unassigned` → **Unassigned work** with a
  pill-style count chip that reads better at a glance.
- Added a **Technician schedule** header above the time grid with a
  matching pill chip showing the technician count.
- Made the unassigned column `lg:sticky lg:top-2` with `max-h-calc` and
  `overflow-y-auto` so it stays in reach while the grid scrolls vertically.
- Min column width raised from `140px` → `160px` to reduce the cramped feel
  on busy days.
- Technician lane headers now use **two rows**:
  - Row 1: avatar + truncated name + quick-add button.
  - Row 2: a colored workload pill (`0 jobs` muted, `1–2` sky, `3–5`
    violet, `6+` rose) that mirrors the week-overview density palette.
- Removed the awkward `(N)` parenthesis count after the name — the pill
  replaces it.

### 5. Mobile list parity

`components/dispatch/dispatch-mobile-list.tsx`

- Section heading rebranded to **Unassigned work** and now uses the same
  pill-count style as the desktop board.
- Per-technician sections gained the same pill-count treatment, with a
  truncating name to avoid horizontal overflow on long technician names.
- No layout changes to the cards themselves — only header polish.

### 6. Card density — top 3 badges + accessible overflow

`components/dispatch/operational-badge-row.tsx`

- Default badge cap lowered from **4 → 3**.
- The overflow indicator changed from `+2` to `+2 more` and now exposes the
  hidden labels via the `title` attribute and an `aria-label` so the
  signal-rich badges are still readable on hover / via screen reader.
- Surfaces that need every badge (like the work-order drawer) can override
  with `cap={Infinity}` and behavior is unchanged.

### 7. Persistence

`lib/dispatch/persisted-prefs.ts`

- Extended `DispatchPrefKey` with `week-overview-visible`,
  `more-filters-expanded`, and `all-signals-expanded`.
- All three default to **false** so the dispatch board opens compact for
  first-time users; existing users' preferences are preserved.

## What didn't change

- `enrichDispatchWorkOrders`, `OpsFlags`, the badge derivation matrix, and
  every operational signal still computed end-to-end.
- Drag/drop assignment, the conflict toast from Phase 2, and the schedule
  patch logic are untouched.
- Service-schedule page is unaffected (it doesn't use the focus chips or
  KPI snapshot — only the status chips, which were not changed).
- Quick-add appointment dialog and work-order drawer behavior are unchanged.
- No DB migrations.
- No API route changes.

## Files changed

- `app/(dashboard)/dispatch/page.tsx`
- `components/dispatch/dispatch-board.tsx`
- `components/dispatch/dispatch-mobile-list.tsx`
- `components/dispatch/operational-badge-row.tsx`
- `lib/dispatch/persisted-prefs.ts`
- `docs/DISPATCH_SCHEDULING_PHASE3.md` (this file)

## How to verify

1. Open `/dispatch` on a workspace with a few hundred work orders. Confirm:
   - Snapshot shows **only 5 tiles** by default.
   - **More filters** button is collapsed and the 21-option chip strip is
     hidden.
   - **Week overview** is hidden until you click **Show week overview**.
   - Section headers read **Unassigned work** and **Technician schedule**.
2. Click **View all signals** — the remaining 7 KPI tiles should appear in
   a second compact row. Reload the page; the open state should persist.
3. Click **More filters**, pick `Cert pending`. The panel collapses and an
   inline `Cert pending ✕` chip appears. Click the ✕ to clear; the chip and
   the focus filter should reset to "All jobs".
4. Click any KPI tile twice — it should turn the filter on, then off.
5. On a wide tab, scroll the technician grid vertically. The unassigned
   column should stay visible (sticky) until it runs out of natural height.
6. Open a busy work-order card — at most 3 badges visible plus a `+N more`
   chip. Hover to confirm the hidden labels appear in the tooltip.
7. Resize to mobile (`< md`). Confirm the unassigned section says
   **Unassigned work**, technician sections show truncated names with a
   pill count, and there is no horizontal overflow on the section bar.
8. Pick a technician and drag a job onto a slot occupied by another job —
   the conflict toast (Phase 2) should still fire.
