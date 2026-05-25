import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGrowthCalendarConnectionForUser,
  sanitizeGrowthCalendarConnectionForApi,
} from "@/lib/growth/calendar/calendar-connection-repository"
import { growthGoogleCalendarOAuthConfigured } from "@/lib/growth/calendar/google-calendar-env"
import {
  GROWTH_CALENDAR_NOT_CONFIGURED_MESSAGE,
  GROWTH_CALENDAR_NOT_CONNECTED_MESSAGE,
  GROWTH_GOOGLE_CALENDAR_QA_MARKER,
  type GrowthCalendarConnectionSummary,
} from "@/lib/growth/calendar/google-calendar-types"

export async function fetchGrowthCalendarConnectionSummary(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthCalendarConnectionSummary> {
  const configured = growthGoogleCalendarOAuthConfigured()
  if (!configured) {
    return {
      qaMarker: GROWTH_GOOGLE_CALENDAR_QA_MARKER,
      connected: false,
      configured: false,
      accountEmail: null,
      accountType: null,
      status: null,
      syncHealth: null,
      lastSyncAt: null,
      lastSyncError: null,
      setupMessage: GROWTH_CALENDAR_NOT_CONFIGURED_MESSAGE,
    }
  }

  const connection = await fetchGrowthCalendarConnectionForUser(admin, userId)
  const sanitized = sanitizeGrowthCalendarConnectionForApi(connection)

  return {
    qaMarker: GROWTH_GOOGLE_CALENDAR_QA_MARKER,
    connected: Boolean(connection),
    configured: true,
    accountEmail: sanitized?.accountEmail ?? null,
    accountType: sanitized?.accountType ?? null,
    status: sanitized?.status ?? null,
    syncHealth: sanitized?.syncHealth ?? null,
    lastSyncAt: sanitized?.lastSyncAt ?? null,
    lastSyncError: sanitized?.lastSyncError ?? null,
    setupMessage: connection ? null : GROWTH_CALENDAR_NOT_CONNECTED_MESSAGE,
  }
}

export async function resolveGrowthCalendarSyncReadinessForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ready: boolean; provider: "google_calendar" | null; setupMessage: string | null }> {
  const summary = await fetchGrowthCalendarConnectionSummary(admin, userId)
  return {
    ready: summary.connected,
    provider: summary.connected ? "google_calendar" : null,
    setupMessage: summary.setupMessage,
  }
}
