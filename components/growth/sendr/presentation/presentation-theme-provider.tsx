"use client"

import { createContext, useContext, type ReactNode } from "react"
import {
  growthSendrThemeCssVars,
  parseGrowthSendrPageTheme,
  type GrowthSendrPageTheme,
} from "@/lib/growth/sendr/growth-sendr-config"

import { GROWTH_SENDR_LEGACY_DARK_PAGE_THEME } from "@/lib/growth/sendr/growth-sendr-config"

const PresentationThemeContext = createContext<GrowthSendrPageTheme>(GROWTH_SENDR_LEGACY_DARK_PAGE_THEME)

export function PresentationThemeProvider({
  theme,
  children,
}: {
  theme?: GrowthSendrPageTheme | null
  children: ReactNode
}) {
  const resolved = parseGrowthSendrPageTheme(theme)
  return (
    <PresentationThemeContext.Provider value={resolved}>
      <div style={growthSendrThemeCssVars(resolved)} className="sendr-themed-root contents">
        {children}
      </div>
    </PresentationThemeContext.Provider>
  )
}

export function usePresentationTheme(): GrowthSendrPageTheme {
  return useContext(PresentationThemeContext)
}
