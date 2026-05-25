"use client"

import { useEffect } from "react"
import type { GrowthBookingPublicThemeMode } from "@/lib/growth/booking/booking-page-types"
import {
  applyPublicBookingDocumentTheme,
  GROWTH_BOOKING_PUBLIC_THEME_QA_MARKER,
  publicBookingColorScheme,
} from "@/lib/growth/booking/public-booking-theme"

export function PublicBookingThemeShell({
  mode,
  children,
}: {
  mode: GrowthBookingPublicThemeMode
  children: React.ReactNode
}) {
  useEffect(() => applyPublicBookingDocumentTheme(mode), [mode])

  return (
    <div
      className="min-h-screen"
      data-public-theme-mode={mode}
      data-qa-marker={GROWTH_BOOKING_PUBLIC_THEME_QA_MARKER}
      style={publicBookingColorScheme(mode) ? { colorScheme: publicBookingColorScheme(mode) } : undefined}
    >
      {children}
    </div>
  )
}
