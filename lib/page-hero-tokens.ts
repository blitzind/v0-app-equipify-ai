/**
 * Shared page-shell + in-page title card typography and layout tokens.
 * Use for dashboard heroes, BlitzPay/FCC in-page headers, AI surfaces, and
 * other primary route title cards so hierarchy stays consistent.
 */

/** Outer wrapper used only under `PageShell` (below topbar, above main). */
export const PAGE_HERO_SHELL_OUTER = "px-3 sm:px-6 shrink-0 pt-4 sm:pt-5 pb-1"

/** Primary title card (bordered shell card). */
export const PAGE_HERO_CARD =
  "flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] px-4 sm:px-6 py-4 sm:py-5"

/** Icon + title stack inside the card. */
export const PAGE_HERO_CLUSTER = "flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4"

/** Default framed module icon (40px). */
export const PAGE_HERO_ICON_FRAME =
  "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"

export const PAGE_HERO_ICON_GLYPH = "w-5 h-5 shrink-0"

/**
 * Primary page title sizing/weight. Add `text-foreground` in the app shell;
 * portal/admin may rely on parent or inline `color` instead.
 */
export const PAGE_STANDARD_PAGE_TITLE =
  "text-lg sm:text-xl font-semibold tracking-tight leading-tight text-balance"

/** Subtitle under the title: one line on `sm+` with ellipsis; up to two lines on narrow viewports. */
export const PAGE_STANDARD_PAGE_SUBTITLE =
  "text-muted-foreground mt-1 sm:mt-1.5 text-xs sm:text-sm leading-snug sm:leading-normal min-w-0 max-sm:line-clamp-2 max-sm:text-pretty sm:truncate sm:whitespace-nowrap sm:overflow-hidden sm:text-ellipsis"

/** Right column for wordmarks, CTAs, or accessory actions. */
export const PAGE_HERO_TRAILING_ROW =
  "flex shrink-0 w-full flex-wrap items-center justify-start gap-2 pt-1 sm:w-auto sm:justify-end sm:pt-0"

/** Dark gradient marketing heroes (Insights hub, AI Assistants). */
export const PAGE_HERO_MARKETING_ICON_FRAME =
  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0"

export const PAGE_HERO_MARKETING_TITLE =
  "text-lg sm:text-xl font-semibold text-white tracking-tight leading-tight text-balance"

export const PAGE_HERO_MARKETING_SUBTITLE =
  "mt-1 text-xs sm:text-sm leading-snug text-white/55 min-w-0 max-w-2xl max-sm:line-clamp-2 max-sm:text-pretty sm:truncate sm:whitespace-nowrap sm:overflow-hidden sm:text-ellipsis"
