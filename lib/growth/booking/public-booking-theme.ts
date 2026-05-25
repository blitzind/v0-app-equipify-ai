/** Client-safe public booking page theme helpers. */

import {
  GROWTH_BOOKING_PUBLIC_THEME_MODES,
  type GrowthBookingPublicThemeMode,
} from "@/lib/growth/booking/booking-page-types"

export { GROWTH_BOOKING_PUBLIC_THEME_QA_MARKER, normalizePublicThemeMode } from "@/lib/growth/booking/booking-page-defaults"

const WORKSPACE_APPEARANCE_STORAGE_KEY = "equipify_workspace_appearance"

export function parsePublicThemePreviewParam(value: string | null | undefined): GrowthBookingPublicThemeMode | null {
  if (!value) return null
  return GROWTH_BOOKING_PUBLIC_THEME_MODES.includes(value as GrowthBookingPublicThemeMode)
    ? (value as GrowthBookingPublicThemeMode)
    : null
}

export function resolveWorkspaceDocumentDark(): boolean {
  if (typeof window === "undefined") return false
  try {
    const pref = window.localStorage.getItem(WORKSPACE_APPEARANCE_STORAGE_KEY)?.trim()
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    if (pref === "dark") return true
    if (pref === "light") return false
    if (pref === "system") return systemDark
  } catch {
    // ignore
  }
  return false
}

/** Force light/dark on the public page only; restores workspace theme on cleanup. */
export function applyPublicBookingDocumentTheme(mode: GrowthBookingPublicThemeMode): () => void {
  if (typeof document === "undefined" || mode === "system") return () => {}

  const html = document.documentElement
  html.classList.toggle("dark", mode === "dark")

  return () => {
    html.classList.toggle("dark", resolveWorkspaceDocumentDark())
  }
}

export function publicBookingColorScheme(
  mode: GrowthBookingPublicThemeMode,
): "light dark" | "light" | "dark" | undefined {
  if (mode === "light") return "light"
  if (mode === "dark") return "dark"
  return undefined
}
