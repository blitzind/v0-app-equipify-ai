"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { PresentationCard } from "@/components/growth/sendr/presentation/presentation-card"
import {
  growthSendrThemeCssVars,
  GROWTH_SENDR_LEGACY_DARK_PAGE_THEME,
  parseGrowthSendrPageTheme,
  type GrowthSendrPageTheme,
} from "@/lib/growth/sendr/growth-sendr-config"
import { cn } from "@/lib/utils"

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

type Props = {
  title?: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  variant?: "default" | "muted" | "elevated"
  unstyled?: boolean
}

export function PresentationSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  variant = "default",
  unstyled = false,
}: Props) {
  const theme = usePresentationTheme()
  const accent = theme.accentColor ?? "#2563eb"

  const body = (
    <>
      {title || description || Icon ? (
        <header className={cn("mb-5 space-y-1.5", Icon && "flex items-start gap-3")}>
          {Icon ? (
            <span
              className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accent}18`, color: accent }}
            >
              <Icon className="size-4" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 className="text-xl font-semibold tracking-tight sm:text-[1.35rem]" style={{ color: "var(--sendr-page-text)" }}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <p
                className="text-sm leading-relaxed sm:text-[0.9375rem]"
                style={{ color: "color-mix(in srgb, var(--sendr-page-text) 70%, transparent)" }}
              >
                {description}
              </p>
            ) : null}
          </div>
        </header>
      ) : null}
      {children}
    </>
  )

  if (unstyled) {
    return <section className={className}>{body}</section>
  }

  return (
    <PresentationCard variant={variant} className={className}>
      {body}
    </PresentationCard>
  )
}
