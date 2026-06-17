/**
 * Shared Equipify workspace shell layout tokens — Core dashboard rhythm.
 */

export const WORKSPACE_SHELL_QA_MARKER = "workspace-shell-v1" as const

/** Horizontal padding aligned with PageShell / PageHero. */
export const WORKSPACE_SHELL_HORIZONTAL_PADDING = "px-3 sm:px-6" as const

/** Main content container — matches `PageShell` inner wrapper. */
export const WORKSPACE_SHELL_MAIN_INNER =
  "max-w-[1440px] mx-auto p-3 sm:p-6 pb-24 lg:pb-6" as const

/** Topbar height + padding — matches `AppTopbar`. */
export const WORKSPACE_SHELL_TOPBAR =
  "flex items-center h-14 md:h-16 px-3 md:px-6 bg-sidebar md:bg-card border-b border-sidebar-border md:border-border gap-3 shrink-0 relative z-30 sticky top-0" as const

/** Desktop sidebar widths — matches `AppSidebar`. */
export const WORKSPACE_SIDEBAR_WIDTH_EXPANDED = "w-[248px]" as const
export const WORKSPACE_SIDEBAR_WIDTH_COLLAPSED = "w-14" as const

export const WORKSPACE_SIDEBAR_SURFACE =
  "flex flex-col h-full min-h-0 overflow-hidden border-r border-sidebar-border bg-[#0F172A] transition-all duration-200 shrink-0" as const

/** Root shell layout — matches Core dashboard `app/(dashboard)/layout.tsx`. */
export const WORKSPACE_SHELL_VIEWPORT_ROOT =
  "flex flex-col h-dvh overflow-hidden bg-background text-foreground" as const

export const WORKSPACE_SHELL_VIEWPORT_BODY = "flex flex-1 min-h-0 overflow-hidden" as const

/** Skip link — matches `PageShell` main-content bypass. */
export const WORKSPACE_SHELL_SKIP_LINK =
  "sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:left-3 focus:top-3 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background" as const

export const WORKSPACE_SHELL_MAIN_CONTENT_ID = "main-content" as const

/** Shared sidebar nav geometry — matches Core `AppSidebar` rows. */
export const WORKSPACE_SIDEBAR_NAV_ROW = "h-10 px-3" as const
export const WORKSPACE_SIDEBAR_NAV_ICON = "w-[17px] h-[17px]" as const
export const WORKSPACE_SIDEBAR_GROUP_HEADER =
  "text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40" as const

export const WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY = "equipify:nav:sidebar-collapsed/v1" as const
