import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_GOOGLE_CALENDAR_QA_MARKER,
  type GrowthCalendarAccountType,
  type GrowthCalendarConnectionStatus,
  type GrowthCalendarSyncHealth,
} from "@/lib/growth/calendar/google-calendar-types"

const CONNECTION_SELECT =
  "id, user_id, provider, account_email, account_type, status, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, scopes, sync_health, last_sync_at, last_sync_error, connected_at, disconnected_at, created_at, updated_at"

type ConnectionRow = {
  id: string
  user_id: string
  provider: string
  account_email: string | null
  account_type: string
  status: string
  access_token: string
  refresh_token: string
  access_token_expires_at: string
  refresh_token_expires_at: string | null
  scopes: string[] | null
  sync_health: string
  last_sync_at: string | null
  last_sync_error: string | null
  connected_at: string
  disconnected_at: string | null
  created_at: string
  updated_at: string
}

export type GrowthCalendarProviderConnection = {
  id: string
  userId: string
  provider: "google_calendar"
  accountEmail: string | null
  accountType: GrowthCalendarAccountType
  status: GrowthCalendarConnectionStatus
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string | null
  scopes: string[]
  syncHealth: GrowthCalendarSyncHealth
  lastSyncAt: string | null
  lastSyncError: string | null
  connectedAt: string
  disconnectedAt: string | null
}

function connectionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("calendar_provider_connections")
}

function mapConnectionRow(row: ConnectionRow): GrowthCalendarProviderConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: "google_calendar",
    accountEmail: row.account_email,
    accountType: row.account_type as GrowthCalendarAccountType,
    status: row.status as GrowthCalendarConnectionStatus,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    accessTokenExpiresAt: row.access_token_expires_at,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    scopes: row.scopes ?? [],
    syncHealth: row.sync_health as GrowthCalendarSyncHealth,
    lastSyncAt: row.last_sync_at,
    lastSyncError: row.last_sync_error,
    connectedAt: row.connected_at,
    disconnectedAt: row.disconnected_at,
  }
}

export async function fetchGrowthCalendarConnectionForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthCalendarProviderConnection | null> {
  const { data, error } = await connectionsTable(admin)
    .select(CONNECTION_SELECT)
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .eq("status", "connected")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapConnectionRow(data as ConnectionRow) : null
}

export async function upsertGrowthCalendarConnection(
  admin: SupabaseClient,
  input: {
    userId: string
    accountEmail: string | null
    accountType: GrowthCalendarAccountType
    accessToken: string
    refreshToken: string
    accessTokenExpiresAt: string
    scopes: string[]
  },
): Promise<GrowthCalendarProviderConnection> {
  const now = new Date().toISOString()
  const { data: existing } = await connectionsTable(admin)
    .select("id")
    .eq("user_id", input.userId)
    .eq("provider", "google_calendar")
    .maybeSingle()

  const row = {
    user_id: input.userId,
    provider: "google_calendar",
    account_email: input.accountEmail,
    account_type: input.accountType,
    status: "connected",
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    access_token_expires_at: input.accessTokenExpiresAt,
    scopes: input.scopes,
    sync_health: "healthy",
    last_sync_error: null,
    connected_at: now,
    disconnected_at: null,
    qa_marker: GROWTH_GOOGLE_CALENDAR_QA_MARKER,
    updated_at: now,
  }

  if (existing?.id) {
    const { data, error } = await connectionsTable(admin)
      .update(row)
      .eq("id", existing.id)
      .select(CONNECTION_SELECT)
      .single()
    if (error) throw new Error(error.message)
    return mapConnectionRow(data as ConnectionRow)
  }

  const { data, error } = await connectionsTable(admin).insert(row).select(CONNECTION_SELECT).single()
  if (error) throw new Error(error.message)
  return mapConnectionRow(data as ConnectionRow)
}

export async function updateGrowthCalendarConnectionTokens(
  admin: SupabaseClient,
  connectionId: string,
  input: { accessToken: string; refreshToken?: string; accessTokenExpiresAt: string },
): Promise<void> {
  const patch: Record<string, unknown> = {
    access_token: input.accessToken,
    access_token_expires_at: input.accessTokenExpiresAt,
    updated_at: new Date().toISOString(),
  }
  if (input.refreshToken) patch.refresh_token = input.refreshToken
  const { error } = await connectionsTable(admin).update(patch).eq("id", connectionId)
  if (error) throw new Error(error.message)
}

export async function markGrowthCalendarConnectionSyncResult(
  admin: SupabaseClient,
  connectionId: string,
  input: { syncHealth: GrowthCalendarSyncHealth; lastSyncError?: string | null },
): Promise<void> {
  const { error } = await connectionsTable(admin)
    .update({
      sync_health: input.syncHealth,
      last_sync_at: new Date().toISOString(),
      last_sync_error: input.lastSyncError ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
  if (error) throw new Error(error.message)
}

export async function disconnectGrowthCalendarConnection(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await connectionsTable(admin)
    .update({
      status: "disconnected",
      disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .eq("status", "connected")
  if (error) throw new Error(error.message)
}

export function sanitizeGrowthCalendarConnectionForApi(
  connection: GrowthCalendarProviderConnection | null,
): {
  accountEmail: string | null
  accountType: GrowthCalendarAccountType | null
  status: GrowthCalendarConnectionStatus | null
  syncHealth: GrowthCalendarSyncHealth | null
  lastSyncAt: string | null
  lastSyncError: string | null
  connectedAt: string | null
} | null {
  if (!connection) return null
  return {
    accountEmail: connection.accountEmail,
    accountType: connection.accountType,
    status: connection.status,
    syncHealth: connection.syncHealth,
    lastSyncAt: connection.lastSyncAt,
    lastSyncError: connection.lastSyncError,
    connectedAt: connection.connectedAt,
  }
}
