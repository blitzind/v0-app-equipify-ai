/** Client-safe defaults for legacy booking pages missing horizon/timezone fields. */

import type { GrowthBookingTimezoneMode, GrowthBookingPublicThemeMode } from "@/lib/growth/booking/booking-page-types"

export const GROWTH_BOOKING_AVAILABILITY_RENDER_FIX_QA_MARKER = "booking-availability-render-fix-v1" as const
export const GROWTH_BOOKING_PUBLIC_THEME_QA_MARKER = "booking-public-theme-mode-v1" as const

export const DEFAULT_BOOKING_SCHEDULING_HORIZON_DAYS = 90
export const DEFAULT_BOOKING_MINIMUM_NOTICE_HOURS = 0
export const DEFAULT_BOOKING_TIMEZONE_MODE: GrowthBookingTimezoneMode = "visitor_local"

export function normalizeSchedulingHorizonDays(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 1) return DEFAULT_BOOKING_SCHEDULING_HORIZON_DAYS
  return Math.min(730, Math.round(value))
}

export function normalizeMinimumNoticeHours(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 0) return DEFAULT_BOOKING_MINIMUM_NOTICE_HOURS
  return Math.min(168, Math.round(value))
}

export function normalizeBufferMinutes(value: number | null | undefined, legacyFallback = 0): number {
  if (value == null || !Number.isFinite(value) || value < 0) return Math.max(0, legacyFallback)
  return Math.min(240, Math.round(value))
}

export function normalizeMaxMeetingsPerDay(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.min(50, Math.round(value))
}

export function normalizeTimezoneMode(value: string | null | undefined): GrowthBookingTimezoneMode {
  if (value === "fixed_host" || value === "visitor_override") return value
  return DEFAULT_BOOKING_TIMEZONE_MODE
}

export function normalizePublicThemeMode(value: string | null | undefined): GrowthBookingPublicThemeMode {
  if (value === "light" || value === "dark") return value
  return "system"
}
