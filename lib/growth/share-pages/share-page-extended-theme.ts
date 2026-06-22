/** GS-SHARE-7B — Share page extended theme (client-safe). */

import type { GrowthSharePageTheme } from "@/lib/growth/share-pages/share-page-types"
import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "@/lib/growth/share-pages/share-page-types"

export const GROWTH_SHARE_PAGE_THEME_QA_MARKER = "growth-share-page-theme-gs-share-7b-v1" as const

export const GROWTH_SHARE_PAGE_OPERATOR_DEFAULT_THEME: Required<
  Pick<
    GrowthSharePageTheme,
    | "pageBackground"
    | "pageText"
    | "surfaceColor"
    | "buttonBackground"
    | "buttonText"
    | "headerBackground"
    | "headerText"
    | "brandColor"
    | "accentColor"
  >
> = {
  pageBackground: "#f8fafc",
  pageText: "#0f172a",
  surfaceColor: "#ffffff",
  brandColor: "#2563eb",
  accentColor: "#2563eb",
  buttonBackground: "#f59e0b",
  buttonText: "#111827",
  headerBackground: "#07111f",
  headerText: "#ffffff",
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function normalizeSharePageThemeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (!HEX_COLOR.test(trimmed)) return fallback
  return trimmed.length === 4
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed
}

export function hasSharePageExtendedTheme(theme: GrowthSharePageTheme): boolean {
  return Boolean(
    theme.pageBackground ||
      theme.pageText ||
      theme.surfaceColor ||
      theme.buttonBackground ||
      theme.buttonText ||
      theme.headerBackground ||
      theme.headerText,
  )
}

export function parseSharePageExtendedTheme(
  source: Partial<GrowthSharePageTheme> | null | undefined,
  fallback = GROWTH_SHARE_PAGE_OPERATOR_DEFAULT_THEME,
): GrowthSharePageTheme {
  const base = { ...DEFAULT_GROWTH_SHARE_PAGE_THEME, ...fallback, ...(source ?? {}) }
  return {
    brandColor: normalizeSharePageThemeColor(source?.brandColor, base.brandColor),
    accentColor: normalizeSharePageThemeColor(source?.accentColor, base.accentColor),
    logoUrl: typeof source?.logoUrl === "string" && source.logoUrl.trim() ? source.logoUrl.trim() : null,
    heroImageUrl:
      typeof source?.heroImageUrl === "string" && source.heroImageUrl.trim() ? source.heroImageUrl.trim() : null,
    publicThemeMode:
      source?.publicThemeMode === "light" || source?.publicThemeMode === "dark" || source?.publicThemeMode === "system"
        ? source.publicThemeMode
        : DEFAULT_GROWTH_SHARE_PAGE_THEME.publicThemeMode,
    footerNote: typeof source?.footerNote === "string" && source.footerNote.trim() ? source.footerNote.trim() : null,
    pageBackground: normalizeSharePageThemeColor(source?.pageBackground, base.pageBackground!),
    pageText: normalizeSharePageThemeColor(source?.pageText, base.pageText!),
    surfaceColor: normalizeSharePageThemeColor(source?.surfaceColor, base.surfaceColor!),
    buttonBackground: normalizeSharePageThemeColor(source?.buttonBackground, base.buttonBackground!),
    buttonText: normalizeSharePageThemeColor(source?.buttonText, base.buttonText!),
    headerBackground: normalizeSharePageThemeColor(source?.headerBackground, base.headerBackground!),
    headerText: normalizeSharePageThemeColor(source?.headerText, base.headerText!),
  }
}

export function sharePageExtendedThemeCssVars(theme: GrowthSharePageTheme): Record<string, string> {
  const resolved = parseSharePageExtendedTheme(theme)
  return {
    ["--share-brand-color" as string]: resolved.brandColor,
    ["--share-accent-color" as string]: resolved.accentColor,
    ["--share-page-bg" as string]: resolved.pageBackground ?? resolved.brandColor,
    ["--share-page-text" as string]: resolved.pageText ?? "#0f172a",
    ["--share-surface" as string]: resolved.surfaceColor ?? "#ffffff",
    ["--share-button-bg" as string]: resolved.buttonBackground ?? resolved.brandColor,
    ["--share-button-text" as string]: resolved.buttonText ?? "#ffffff",
    ["--share-header-bg" as string]: resolved.headerBackground ?? resolved.brandColor,
    ["--share-header-text" as string]: resolved.headerText ?? "#ffffff",
  }
}
