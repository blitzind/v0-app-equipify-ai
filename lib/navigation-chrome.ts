/**
 * Shared hover + motion tokens for primary app navigation (left sidebar) and
 * surfaces that should match it: account/settings hub, /settings subnav, etc.
 */

/** Layout + motion baseline for primary nav rows. */
export const NAV_PRIMARY_ROW_MOTION =
  "rounded-lg text-sm transition-all duration-150"

/** Inactive row on dark sidebar canvas (AppSidebar). */
export const NAV_ROW_INACTIVE_HOVER_SIDEBAR =
  "text-sidebar-foreground/75 hover:bg-blue-500/[0.10] hover:text-sidebar-foreground"

/**
 * Active row on dark sidebar — blue wash background, white label; hover stays a
 * soft blue lift only (no orange fills).
 */
export const NAV_ROW_ACTIVE_SIDEBAR =
  "bg-blue-500/[0.18] hover:bg-blue-500/[0.22] text-white font-medium"

/** Inactive icon on sidebar nav row. */
export const NAV_ICON_INACTIVE_SIDEBAR =
  "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80"

/** Active icon: light blue on dark blue active row (orange is rail-only in app-sidebar). */
export const NAV_ICON_ACTIVE_SIDEBAR = "text-blue-300"

/**
 * Equipify brand orange — reserved for the active nav rail accent only
 * (left indicator / collapsed dot), not icons or row fills.
 */
export const NAV_SIDEBAR_ACTIVE_INDICATOR = "#F59F1B"

/**
 * Inactive row on card / popover (account hub, settings layout) —
 * same blue hover wash as sidebar nav.
 */
export const NAV_ROW_INACTIVE_HOVER_CARD =
  "text-foreground/75 hover:bg-blue-500/[0.10] hover:text-foreground"

/** Inactive icon on card — mirrors sidebar icon brightness step. */
export const NAV_ICON_INACTIVE_CARD =
  "text-foreground/45 group-hover:text-foreground/80"

/** Account hub grid rows (spacing tuned for 2-col launcher). */
export const NAV_LAUNCHER_ROW_LAYOUT =
  "group flex items-center gap-2 px-3 py-2 rounded-lg"

/** Account menu trigger when open — subtle blue wash (matches nav “active” family). */
export const NAV_HUB_TRIGGER_OPEN = "bg-blue-500/[0.15]"
