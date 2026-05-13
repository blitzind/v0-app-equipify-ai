/**
 * Named hero icon palettes for `PageHeroCard` / `PageHeroIconFramed`.
 *
 * Prefer a named `iconTone` over ad-hoc `featureColor` when the accent would
 * otherwise be expressed as CSS variables (`hsl(var(--primary))`, etc.): those
 * values are not reliably mixable in `color-mix(in srgb, …)` across browsers.
 */

export type PageHeroIconTone = "default" | "primary" | "blue" | "purple" | "green" | "amber" | "slate"

export type PageHeroIconNamedTone = Exclude<PageHeroIconTone, "default">

/** Frame: border + soft wash (light/dark safe). */
export const PAGE_HERO_ICON_TONE_FRAME: Record<PageHeroIconNamedTone, string> = {
  primary: "border-primary/30 bg-primary/10",
  blue: "border-blue-500/30 bg-blue-500/10",
  purple: "border-violet-500/30 bg-violet-500/10",
  green: "border-emerald-500/30 bg-emerald-500/10",
  amber: "border-amber-500/30 bg-amber-500/10",
  slate: "border-slate-500/30 bg-slate-500/10",
}

/** Glyph color (pairs with frame). */
export const PAGE_HERO_ICON_TONE_GLYPH: Record<PageHeroIconNamedTone, string> = {
  primary: "text-primary",
  blue: "text-blue-600 dark:text-blue-400",
  purple: "text-violet-600 dark:text-violet-400",
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  slate: "text-slate-600 dark:text-slate-400",
}
