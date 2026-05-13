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

/** BlitzPay Financial Command Center — vertical rhythm + tool strip (Tailwind class strings). */
export const FCC_OVERVIEW_PAGE_STACK = "flex flex-col min-w-0 gap-5 md:gap-6"
export const FCC_EXEC_OVERVIEW_STACK = "flex flex-col min-w-0 gap-6 md:gap-7"
export const FCC_BLOCK = "space-y-2.5 md:space-y-3"
export const FCC_BLOCK_HEADER = "flex items-center gap-2 min-h-8"
export const FCC_BLOCK_TITLE = "text-sm font-semibold text-foreground tracking-tight"
export const FCC_HEALTH_STRIP_GRID = "grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
export const FCC_DUAL_COL_GRID = "grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6 items-stretch"
export const FCC_BRIEFING_TRI_GRID = "grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4"
export const FCC_CARD_SHELL = "border-border/80 shadow-sm"
export const FCC_CARD_BODY = "p-4 sm:p-5"
export const FCC_META_FOOTNOTE = "text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed"
export const FCC_TOOL_STRIP =
  "flex flex-wrap items-start sm:items-center justify-between gap-x-4 gap-y-2 min-w-0 border-b border-border/60 pb-3 mb-1"
