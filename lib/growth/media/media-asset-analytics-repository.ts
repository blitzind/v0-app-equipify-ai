import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
  type GrowthMediaAssetEventRollup,
  type GrowthMediaAssetEventRow,
  type GrowthMediaPlaybackAnalyticsEventType,
} from "@/lib/growth/media/media-asset-analytics-types"

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("media_asset_events")
}

function rollupsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("media_asset_event_rollups")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function mapEvent(row: Record<string, unknown>): GrowthMediaAssetEventRow {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    assetId: asString(row.asset_id),
    relationshipId: asString(row.relationship_id) || null,
    eventType: asString(row.event_type) as GrowthMediaPlaybackAnalyticsEventType,
    leadId: asString(row.lead_id) || null,
    sharePageId: asString(row.share_page_id) || null,
    templateId: asString(row.template_id) || null,
    sequenceId: asString(row.sequence_id) || null,
    sessionId: asString(row.session_id),
    anonymousIdHash: asString(row.anonymous_id_hash) || null,
    eventTimestamp: asString(row.event_timestamp),
    progressSeconds: asNumber(row.progress_seconds),
    progressPercent: asNumber(row.progress_percent),
    durationSeconds: asNumber(row.duration_seconds),
    ctaKey: asString(row.cta_key) || null,
    metadata: asRecord(row.metadata_json),
    createdAt: asString(row.created_at),
  }
}

function mapRollup(row: Record<string, unknown>): GrowthMediaAssetEventRollup {
  return {
    assetId: asString(row.asset_id),
    organizationId: asString(row.organization_id),
    views: asNumber(row.views) ?? 0,
    uniqueViews: asNumber(row.unique_views) ?? 0,
    playStarts: asNumber(row.play_starts) ?? 0,
    completions: asNumber(row.completions) ?? 0,
    completionRate: asNumber(row.completion_rate) ?? 0,
    averageWatchSeconds: asNumber(row.average_watch_seconds) ?? 0,
    ctaClicks: asNumber(row.cta_clicks) ?? 0,
    lastEventAt: asString(row.last_event_at) || null,
    updatedAt: asString(row.updated_at),
  }
}

export type InsertMediaAssetEventInput = {
  organizationId: string
  assetId: string
  eventType: GrowthMediaPlaybackAnalyticsEventType
  sessionId: string
  relationshipId?: string | null
  leadId?: string | null
  sharePageId?: string | null
  templateId?: string | null
  sequenceId?: string | null
  anonymousIdHash?: string | null
  progressSeconds?: number | null
  progressPercent?: number | null
  durationSeconds?: number | null
  ctaKey?: string | null
  metadata?: Record<string, unknown>
  eventTimestamp?: string
}

export function computeMediaAssetEventRollup(events: GrowthMediaAssetEventRow[]): GrowthMediaAssetEventRollup {
  const assetId = events[0]?.assetId ?? ""
  const organizationId = events[0]?.organizationId ?? ""
  const views = events.filter((event) => event.eventType === "video_viewed").length
  const uniqueViewSessions = new Set(
    events.filter((event) => event.eventType === "video_viewed").map((event) => event.sessionId),
  )
  const playStarts = events.filter((event) => event.eventType === "video_play_started").length
  const completions = events.filter((event) => event.eventType === "video_completed").length
  const ctaClicks = events.filter((event) => event.eventType === "video_cta_clicked").length

  const progressBySession = new Map<string, number>()
  for (const event of events) {
    if (event.eventType !== "video_progress" && event.eventType !== "video_completed") continue
    const progress = event.progressSeconds ?? 0
    progressBySession.set(event.sessionId, Math.max(progressBySession.get(event.sessionId) ?? 0, progress))
  }
  const watchValues = [...progressBySession.values()]
  const averageWatchSeconds =
    watchValues.length === 0 ? 0 : watchValues.reduce((sum, value) => sum + value, 0) / watchValues.length

  const completionRate = playStarts > 0 ? completions / playStarts : 0
  const lastEventAt =
    events
      .map((event) => event.eventTimestamp)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null

  return {
    assetId,
    organizationId,
    views,
    uniqueViews: uniqueViewSessions.size,
    playStarts,
    completions,
    completionRate: Math.min(1, Math.max(0, completionRate)),
    averageWatchSeconds,
    ctaClicks,
    lastEventAt,
    updatedAt: new Date().toISOString(),
  }
}

export async function insertMediaAssetEvent(
  admin: SupabaseClient,
  input: InsertMediaAssetEventInput,
): Promise<GrowthMediaAssetEventRow> {
  const { data, error } = await eventsTable(admin)
    .insert({
      organization_id: input.organizationId,
      asset_id: input.assetId,
      relationship_id: input.relationshipId ?? null,
      event_type: input.eventType,
      lead_id: input.leadId ?? null,
      share_page_id: input.sharePageId ?? null,
      template_id: input.templateId ?? null,
      sequence_id: input.sequenceId ?? null,
      session_id: input.sessionId,
      anonymous_id_hash: input.anonymousIdHash ?? null,
      event_timestamp: input.eventTimestamp ?? new Date().toISOString(),
      progress_seconds: input.progressSeconds ?? null,
      progress_percent: input.progressPercent ?? null,
      duration_seconds: input.durationSeconds ?? null,
      cta_key: input.ctaKey ?? null,
      metadata_json: {
        ...(input.metadata ?? {}),
        no_notifications: true,
        no_sequence_execution: true,
      },
      qa_marker: GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
    })
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "analytics_event_insert_failed")
  return mapEvent(data as Record<string, unknown>)
}

export async function listMediaAssetEventsForAsset(
  admin: SupabaseClient,
  input: { organizationId: string; assetId: string; limit?: number },
): Promise<GrowthMediaAssetEventRow[]> {
  const limit = Math.min(Math.max(input.limit ?? 500, 1), 2000)
  const { data, error } = await eventsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("asset_id", input.assetId)
    .order("event_timestamp", { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEvent(row as Record<string, unknown>))
}

export async function recomputeMediaAssetEventRollup(
  admin: SupabaseClient,
  input: { organizationId: string; assetId: string },
): Promise<GrowthMediaAssetEventRollup> {
  const events = await listMediaAssetEventsForAsset(admin, input)
  const rollup = computeMediaAssetEventRollup(events)

  const { data, error } = await rollupsTable(admin)
    .upsert(
      {
        asset_id: input.assetId,
        organization_id: input.organizationId,
        views: rollup.views,
        unique_views: rollup.uniqueViews,
        play_starts: rollup.playStarts,
        completions: rollup.completions,
        completion_rate: rollup.completionRate,
        average_watch_seconds: rollup.averageWatchSeconds,
        cta_clicks: rollup.ctaClicks,
        last_event_at: rollup.lastEventAt,
        qa_marker: GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
      },
      { onConflict: "asset_id" },
    )
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "analytics_rollup_upsert_failed")
  return mapRollup(data as Record<string, unknown>)
}

export async function getMediaAssetEventRollup(
  admin: SupabaseClient,
  input: { organizationId: string; assetId: string },
): Promise<GrowthMediaAssetEventRollup | null> {
  const { data, error } = await rollupsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("asset_id", input.assetId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRollup(data as Record<string, unknown>)
}

export async function listMediaAssetEventRollups(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthMediaAssetEventRollup[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const { data, error } = await rollupsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRollup(row as Record<string, unknown>))
}

export async function deleteMediaAssetEventsForAsset(
  admin: SupabaseClient,
  assetId: string,
): Promise<void> {
  await rollupsTable(admin).delete().eq("asset_id", assetId)
  const { error } = await eventsTable(admin).delete().eq("asset_id", assetId)
  if (error) throw new Error(error.message)
}
