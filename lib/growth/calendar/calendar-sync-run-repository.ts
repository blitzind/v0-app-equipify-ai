import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_CALENDAR_SYNC_QA_MARKER,
  type GrowthCalendarSyncRunStatus,
  type GrowthCalendarSyncRunSummary,
  type GrowthCalendarSyncStatusPanel,
  type GrowthCalendarSyncTriggerType,
} from "@/lib/growth/calendar/calendar-sync-types"

type SyncRunRow = {
  id: string
  user_id: string
  connection_id: string | null
  trigger_type: string
  status: string
  started_at: string
  completed_at: string | null
  events_fetched: number
  events_matched: number
  events_created: number
  events_updated: number
  events_synced: number
  conflicts_detected: number
  sync_error: string | null
}

function syncRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("calendar_sync_runs")
}

function mapSyncRun(row: SyncRunRow): GrowthCalendarSyncRunSummary {
  return {
    id: row.id,
    triggerType: row.trigger_type as GrowthCalendarSyncTriggerType,
    status: row.status as GrowthCalendarSyncRunStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    eventsFetched: row.events_fetched,
    eventsMatched: row.events_matched,
    eventsCreated: row.events_created,
    eventsUpdated: row.events_updated,
    eventsSynced: row.events_synced,
    conflictsDetected: row.conflicts_detected,
    syncError: row.sync_error,
  }
}

export async function insertGrowthCalendarSyncRun(
  admin: SupabaseClient,
  input: {
    userId: string
    connectionId: string | null
    triggerType: GrowthCalendarSyncTriggerType
  },
): Promise<GrowthCalendarSyncRunSummary> {
  const { data, error } = await syncRunsTable(admin)
    .insert({
      user_id: input.userId,
      connection_id: input.connectionId,
      trigger_type: input.triggerType,
      status: "running",
      qa_marker: GROWTH_CALENDAR_SYNC_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapSyncRun(data as SyncRunRow)
}

export async function completeGrowthCalendarSyncRun(
  admin: SupabaseClient,
  runId: string,
  input: {
    status: GrowthCalendarSyncRunStatus
    eventsFetched?: number
    eventsMatched?: number
    eventsCreated?: number
    eventsUpdated?: number
    eventsSynced?: number
    conflictsDetected?: number
    syncError?: string | null
  },
): Promise<GrowthCalendarSyncRunSummary> {
  const { data, error } = await syncRunsTable(admin)
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      events_fetched: input.eventsFetched ?? 0,
      events_matched: input.eventsMatched ?? 0,
      events_created: input.eventsCreated ?? 0,
      events_updated: input.eventsUpdated ?? 0,
      events_synced: input.eventsSynced ?? 0,
      conflicts_detected: input.conflictsDetected ?? 0,
      sync_error: input.syncError ?? null,
    })
    .eq("id", runId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapSyncRun(data as SyncRunRow)
}

export async function fetchLatestGrowthCalendarSyncRun(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthCalendarSyncRunSummary | null> {
  const { data, error } = await syncRunsTable(admin)
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapSyncRun(data as SyncRunRow) : null
}

export async function fetchGrowthCalendarSyncStatusPanel(
  admin: SupabaseClient,
  userId: string,
  connectionLastSyncAt: string | null,
  connectionLastSyncError: string | null,
): Promise<GrowthCalendarSyncStatusPanel> {
  const latestRun = await fetchLatestGrowthCalendarSyncRun(admin, userId)
  return {
    qaMarker: GROWTH_CALENDAR_SYNC_QA_MARKER,
    lastSyncAt: latestRun?.completedAt ?? connectionLastSyncAt,
    lastSyncStatus: latestRun?.status ?? null,
    lastSyncError: latestRun?.syncError ?? connectionLastSyncError,
    eventsSynced: latestRun?.eventsSynced ?? 0,
    conflictsDetected: latestRun?.conflictsDetected ?? 0,
    latestRun,
  }
}
