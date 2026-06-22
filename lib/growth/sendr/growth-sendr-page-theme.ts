/** GS-SENDR-7B — Personalized Videos page theme (client-safe). */

export const GROWTH_SENDR_PAGE_THEME_QA_MARKER = "growth-sendr-page-theme-gs-sendr-7b-v1" as const

export type GrowthSendrPageTheme = {
  pageBackground?: string
  pageText?: string
  surfaceColor?: string
  accentColor?: string
  buttonBackground?: string
  buttonText?: string
  headerBackground?: string
  headerText?: string
  logoUrl?: string | null
  footerText?: string | null
}

/** Legacy public pages before GS-SENDR-7B — full dark presentation. */
export const GROWTH_SENDR_LEGACY_DARK_PAGE_THEME: Required<
  Pick<
    GrowthSendrPageTheme,
    | "pageBackground"
    | "pageText"
    | "surfaceColor"
    | "accentColor"
    | "buttonBackground"
    | "buttonText"
    | "headerBackground"
    | "headerText"
  >
> = {
  pageBackground: "#020617",
  pageText: "#f8fafc",
  surfaceColor: "#0f172a",
  accentColor: "#2563eb",
  buttonBackground: "#2563eb",
  buttonText: "#ffffff",
  headerBackground: "#020617",
  headerText: "#ffffff",
}

/** Operator-facing defaults when customizing theme in the builder. */
export const GROWTH_SENDR_DEFAULT_PAGE_THEME: Required<
  Pick<
    GrowthSendrPageTheme,
    | "pageBackground"
    | "pageText"
    | "surfaceColor"
    | "accentColor"
    | "buttonBackground"
    | "buttonText"
    | "headerBackground"
    | "headerText"
  >
> = {
  pageBackground: "#f8fafc",
  pageText: "#0f172a",
  surfaceColor: "#ffffff",
  accentColor: "#2563eb",
  buttonBackground: "#f59e0b",
  buttonText: "#111827",
  headerBackground: "#07111f",
  headerText: "#ffffff",
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function normalizeGrowthSendrThemeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (!HEX_COLOR.test(trimmed)) return fallback
  return trimmed.length === 4
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed
}

export function parseGrowthSendrPageTheme(
  source: unknown,
  fallback: GrowthSendrPageTheme = GROWTH_SENDR_DEFAULT_PAGE_THEME,
): GrowthSendrPageTheme {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { ...fallback }
  }
  const row = source as Record<string, unknown>
  return {
    pageBackground: normalizeGrowthSendrThemeColor(row.pageBackground, fallback.pageBackground!),
    pageText: normalizeGrowthSendrThemeColor(row.pageText, fallback.pageText!),
    surfaceColor: normalizeGrowthSendrThemeColor(row.surfaceColor, fallback.surfaceColor!),
    accentColor: normalizeGrowthSendrThemeColor(row.accentColor, fallback.accentColor!),
    buttonBackground: normalizeGrowthSendrThemeColor(row.buttonBackground, fallback.buttonBackground!),
    buttonText: normalizeGrowthSendrThemeColor(row.buttonText, fallback.buttonText!),
    headerBackground: normalizeGrowthSendrThemeColor(row.headerBackground, fallback.headerBackground!),
    headerText: normalizeGrowthSendrThemeColor(row.headerText, fallback.headerText!),
    logoUrl: typeof row.logoUrl === "string" && row.logoUrl.trim() ? row.logoUrl.trim() : null,
    footerText: typeof row.footerText === "string" && row.footerText.trim() ? row.footerText.trim() : null,
  }
}

export function resolveGrowthSendrPageTheme(metadata: Record<string, unknown> | undefined): GrowthSendrPageTheme {
  const raw = metadata?.theme
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...GROWTH_SENDR_LEGACY_DARK_PAGE_THEME }
  }
  return parseGrowthSendrPageTheme(raw, GROWTH_SENDR_DEFAULT_PAGE_THEME)
}

export function growthSendrThemeCssVars(theme: GrowthSendrPageTheme): Record<string, string> {
  const resolved = parseGrowthSendrPageTheme(theme)
  return {
    ["--sendr-page-bg" as string]: resolved.pageBackground,
    ["--sendr-page-text" as string]: resolved.pageText,
    ["--sendr-surface" as string]: resolved.surfaceColor,
    ["--sendr-accent" as string]: resolved.accentColor,
    ["--sendr-button-bg" as string]: resolved.buttonBackground,
    ["--sendr-button-text" as string]: resolved.buttonText,
    ["--sendr-header-bg" as string]: resolved.headerBackground,
    ["--sendr-header-text" as string]: resolved.headerText,
  }
}
