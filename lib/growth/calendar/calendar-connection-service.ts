import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGrowthCalendarConnectionForUser,
  markGrowthCalendarConnectionSyncResult,
  updateGrowthCalendarConnectionTokens,
  type GrowthCalendarProviderConnection,
} from "@/lib/growth/calendar/calendar-connection-repository"
import { refreshGrowthGoogleCalendarAccessToken } from "@/lib/growth/calendar/google-calendar-oauth"

const EXPIRY_BUFFER_MS = 120_000

export async function getGrowthCalendarConnectionWithFreshAccessToken(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthCalendarProviderConnection | null> {
  const connection = await fetchGrowthCalendarConnectionForUser(admin, userId)
  if (!connection) return null

  const expiresMs = Date.parse(connection.accessTokenExpiresAt)
  if (Date.now() + EXPIRY_BUFFER_MS < expiresMs) return connection

  try {
    const refreshed = await refreshGrowthGoogleCalendarAccessToken(connection.refreshToken)
    const accessTokenExpiresAt = new Date(Date.now() + Math.max(60, refreshed.expires_in) * 1000).toISOString()
    await updateGrowthCalendarConnectionTokens(admin, connection.id, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      accessTokenExpiresAt,
    })
    await markGrowthCalendarConnectionSyncResult(admin, connection.id, { syncHealth: "healthy", lastSyncError: null })
    return {
      ...connection,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? connection.refreshToken,
      accessTokenExpiresAt: accessTokenExpiresAt,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token refresh failed."
    await markGrowthCalendarConnectionSyncResult(admin, connection.id, { syncHealth: "failed", lastSyncError: message })
    throw e
  }
}
