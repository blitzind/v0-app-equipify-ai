import type { CSSProperties } from "react"
import type { GrowthSharePageTheme } from "@/lib/growth/share-pages/share-page-types"

export function sharePageThemeStyle(theme: GrowthSharePageTheme): CSSProperties {
  return {
    ["--share-brand-color" as string]: theme.brandColor,
    ["--share-accent-color" as string]: theme.accentColor,
  }
}

export function sharePageBrandClasses(): string {
  return "text-[var(--share-brand-color)] bg-[var(--share-brand-color)] border-[var(--share-brand-color)]"
}
