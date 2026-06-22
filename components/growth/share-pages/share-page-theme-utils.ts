import type { CSSProperties } from "react"
import type { GrowthSharePageTheme } from "@/lib/growth/share-pages/share-page-types"
import {
  hasSharePageExtendedTheme,
  sharePageExtendedThemeCssVars,
} from "@/lib/growth/share-pages/share-page-types"

export function sharePageThemeStyle(theme: GrowthSharePageTheme): CSSProperties {
  if (hasSharePageExtendedTheme(theme)) {
    return sharePageExtendedThemeCssVars(theme) as CSSProperties
  }
  return {
    ["--share-brand-color" as string]: theme.brandColor,
    ["--share-accent-color" as string]: theme.accentColor,
    ["--share-button-bg" as string]: theme.brandColor,
    ["--share-button-text" as string]: "#ffffff",
  }
}

export function sharePageBrandClasses(): string {
  return "text-[var(--share-brand-color)] bg-[var(--share-brand-color)] border-[var(--share-brand-color)]"
}
