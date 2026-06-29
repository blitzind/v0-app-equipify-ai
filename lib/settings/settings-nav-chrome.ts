/**
 * SETTINGS-NAV-STYLE-ALIGNMENT-1A — Shared settings sidebar nav chrome for Core + Growth.
 */

import { cn } from "@/lib/utils"
import {
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_INACTIVE_HOVER_CARD,
  NAV_SIDEBAR_ACTIVE_INDICATOR,
} from "@/lib/navigation-chrome"

export { NAV_PRIMARY_ROW_MOTION, NAV_ROW_INACTIVE_HOVER_CARD, NAV_SIDEBAR_ACTIVE_INDICATOR }

/** White/light card container for settings section nav (Growth + Core). */
export const SETTINGS_NAV_SIDEBAR_CONTAINER =
  "w-full shrink-0 rounded-xl border border-border bg-card p-3 shadow-sm md:sticky md:top-4 md:w-56 md:self-start" as const

export const SETTINGS_NAV_GROUP_LABEL =
  "px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" as const

export const SETTINGS_NAV_SUBGROUP_LABEL =
  "px-2 pt-1 text-[11px] font-medium text-muted-foreground/80" as const

export const SETTINGS_NAV_LIST = "mt-1 space-y-0.5" as const

export const SETTINGS_NAV_GROUPS = "space-y-4" as const

export const SETTINGS_NAV_ROW_LAYOUT =
  "relative flex items-center gap-2 rounded-lg px-2 py-2 pl-3 text-sm" as const

export const SETTINGS_NAV_ACTIVE_ROW =
  "border border-primary/40 bg-muted/90 font-semibold text-foreground shadow-sm dark:border-primary/55 dark:bg-muted/70" as const

export const SETTINGS_NAV_ACTIVE_ICON = "text-primary dark:text-primary" as const

export const SETTINGS_NAV_INACTIVE_ICON = "text-muted-foreground" as const

export const SETTINGS_NAV_ACTIVE_RAIL = "absolute inset-y-1.5 left-0 w-1 rounded-full" as const

export function settingsNavRowClassName(active: boolean, extra?: string): string {
  return cn(
    SETTINGS_NAV_ROW_LAYOUT,
    NAV_PRIMARY_ROW_MOTION,
    active
      ? SETTINGS_NAV_ACTIVE_ROW
      : cn("text-muted-foreground", NAV_ROW_INACTIVE_HOVER_CARD),
    extra,
  )
}

export function settingsNavIconClassName(active: boolean, sizeClass = "size-4"): string {
  return cn("shrink-0", sizeClass, active ? SETTINGS_NAV_ACTIVE_ICON : SETTINGS_NAV_INACTIVE_ICON)
}
