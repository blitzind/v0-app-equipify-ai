# Accessibility & responsive validation (Phase 62.3)

Targeted **polish pass** (not a redesign). Reuses existing Radix / shadcn / Equipify drawer patterns; no new navigation system.

## Audited areas (high level)

| Area | Notes |
| --- | --- |
| Dashboard / page shell | Main scroll region, skip link, sticky top bar offset |
| Mobile primary nav | App sidebar overlay, hamburger ↔ drawer wiring |
| Mobile bottom nav | Quick Add / More bottom sheets, touch targets |
| Toasts | Radix Toast region label for assistive tech |
| Work order offline bar | Live region for sync status changes |
| Detail drawer | Already: `role="dialog"`, `aria-modal`, `aria-label` from title, `max-h-dvh`, mobile close touch targets (prior work) |
| Portal / admin | **Deferred** full pass — focus on staff shell; portal login already responsive; no layout regressions in this phase |

## Fixes implemented

1. **Skip to main content** — first focusable control in `PageShell`; target `#main-content` on `<main>` with `tabIndex={-1}` and `scroll-mt-*` to clear sticky header.
2. **Mobile menu button** — `type="button"`, **44px min** touch target, `touch-manipulation`, `aria-expanded` / `aria-controls` tied to `mobileOpen` and `id="mobile-sidebar-nav"`.
3. **Mobile sidebar drawer** — `id="mobile-sidebar-nav"`, `role="navigation"`, `aria-label="Primary navigation"`, `max-w-[85vw]`, larger close control (min 44px).
4. **Quick Add / More sheets** — `role="dialog"`, `aria-modal`, `aria-labelledby` → `h2` title; **Escape** closes; **max-height** `85dvh` with inner scroll; close buttons enlarged; quick-add action tiles `touch-manipulation` + minimum height.
5. **Toasts** — `ToastProvider label="Notifications"` (screen reader name for the toast region).
6. **Offline sync bar** — `aria-live="polite"` + `aria-relevant` on the existing `role="status"` container.

## Intentionally deferred

- **Focus trap** inside custom mobile sidebar and bottom sheets (Radix Dialog would provide; migration is larger). Escape + scrim close cover common cases.
- **Body scroll lock** when bottom sheets open — follow-up if background scroll is reported as an issue.
- **Full route-by-route** table overflow audit (invoices, work orders list) — use `overflow-x-auto` patterns where missing in a future pass.
- **WCAG color contrast** token audit — no token changes in this phase.

## Standards reused

- [Radix Toast](https://www.radix-ui.com/primitives/docs/components/toast) — `ToastProvider` `label`, viewport in `components/ui/toast.tsx`.
- [WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — bottom sheets use `dialog` + labelled heading.
- Existing **DetailDrawer** / **DrawerViewport** — unchanged baseline.

## Mobile / technician assumptions

- Technicians use **Today**, **Work Orders**, **bottom nav**, and **offline sync bar**; improvements concentrate on those shared primitives (nav, sheets, live region).
- **Offline / sync semantics** unchanged; only announced more reliably when the bar is visible.
