/**
 * Phase 56.6 — AIden occupies the bottom-right on dashboard (`z-[95]`, see `aiden-chat-launcher.tsx`).
 * Fixed toasts and secondary banners use `.br-stack-clear-aiden` (see `app/globals.css`) so they sit above
 * the launcher. CSS variables `--aiden-launcher-*` must stay aligned with the launcher’s Tailwind offsets.
 *
 * Part 9 — Growth workspace builders/wizards may opt into `GrowthWorkspaceSafeArea` locally so primary
 * actions stay above the fixed AIden chip. Do not apply safe-area padding on `GrowthWorkspaceShell` main.
 * Keep chip width in sync with `aiden-chat-launcher.tsx` and `aiden-ask-launcher.tsx`.
 */
export const BR_STACK_CLEAR_AIDEN = "br-stack-clear-aiden"

export const GROWTH_FLOATING_INSET_QA_MARKER = "growth-floating-inset-v1" as const

export const GROWTH_WORKSPACE_PAGE_CONTENT_QA_MARKER = "growth-workspace-page-content-v1" as const

export const GROWTH_AIDEN_SAFE_AREA_PR = "growth-aiden-safe-area-pr"
export const GROWTH_AIDEN_SAFE_AREA_PB_SCROLL = "growth-aiden-safe-area-pb-scroll"
export const GROWTH_WORKSPACE_SAFE_AREA = "growth-workspace-safe-area"
export const GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER = "growth-workspace-safe-area-sticky-footer"
export const GROWTH_STICKY_ACTION_BAR = "growth-sticky-action-bar"
export const GROWTH_STICKY_ACTION_BAR_INNER = "growth-sticky-action-bar__inner"
export const GROWTH_WIZARD_ACTION_ROW = "growth-wizard-action-row"

/** Fixed sticky footer shell — pair with `GrowthStickyActionBar`. */
export const GROWTH_STICKY_ACTION_BAR_SURFACE =
  `${GROWTH_STICKY_ACTION_BAR} border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80` as const

/** Inner row for builder footers (Publish / Save / Continue). */
export const GROWTH_STICKY_ACTION_BAR_INNER_LAYOUT =
  `${GROWTH_STICKY_ACTION_BAR_INNER} mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6` as const

export const AIDEN_CSS_VARS = {
  launcherBottom: "--aiden-launcher-bottom",
  launcherBtnHeight: "--aiden-launcher-btn-height",
  launcherClearanceGap: "--aiden-launcher-clearance-gap",
  launcherRight: "--aiden-launcher-right",
  launcherChipWidth: "--aiden-launcher-chip-width",
  safeAreaRight: "--aiden-safe-area-right",
  safeAreaBottom: "--aiden-safe-area-bottom",
  stickyActionBarHeight: "--growth-sticky-action-bar-height",
} as const
