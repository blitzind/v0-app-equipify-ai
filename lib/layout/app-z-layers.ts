/**
 * Deterministic application stacking layers.
 * Prefer these tokens over ad-hoc z-index values in navigation and overlays.
 */

/** Default page content, sections, tables, charts. */
export const APP_Z_PAGE_CONTENT = "z-0" as const

/** Sticky page headers, in-section sticky widgets. */
export const APP_Z_STICKY_WIDGET = "z-10" as const

/** Elevated cards and dashboard tiles within page content. */
export const APP_Z_CARD = "z-20" as const

/** Slide-out drawers — see also DRAWER_* in detail-drawer.tsx (z-[100]+). */
export const APP_Z_DRAWER = "z-[100]" as const

/** Growth sidebar section flyout navigation (desktop hover menus). */
export const APP_Z_GROWTH_NAV_FLYOUT = "z-[120]" as const

/** Prospect Search filter autocomplete / suggestion panels (portaled above filter rail scroll). */
export const APP_Z_FILTER_SUGGESTION = "z-[115]" as const

/** Modal dialogs and Radix overlays above flyouts. */
export const APP_Z_DIALOG = "z-[150]" as const

/** Emergency / billing / system-critical overlays. */
export const APP_Z_EMERGENCY = "z-[200]" as const
