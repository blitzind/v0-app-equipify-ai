import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listBookingHandoffsForOrganization } from "@/lib/growth/media/media-booking-handoff-service"
import { isGrowthMediaAssetAnalyticsSchemaReady } from "@/lib/growth/media/media-asset-analytics-schema-health"
import { getMediaAsset } from "@/lib/growth/media/media-asset-repository"
import { isGrowthMediaAssetsSchemaReady } from "@/lib/growth/media/media-asset-schema-health"
import { fetchGrowthSharePageById } from "@/lib/growth/share-pages/share-page-repository"
import { isHighIntentSharePageSignalType } from "@/lib/growth/share-pages/share-page-analytics-signals"
import { isGrowthSharePageTemplatesSchemaReady } from "@/lib/growth/share-pages/share-page-template-schema-health"
import { isGrowthSharePagesSchemaReady } from "@/lib/growth/share-pages/share-pages-schema-health"
import { probeGrowthEngagementDashboardSourceAvailability } from "@/lib/growth/engagement/growth-engagement-dashboard-repository"
import type { GrowthEngagementTimelineEvent } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import type { GrowthEngagementTimelineFilters } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import {
  buildTimelineEventTitle,
  mapMediaEventType,
  mapSharePageEventType,
  resolveEngagementTimelineDateRange,
} from "@/lib/growth/engagement/growth-engagement-timeline-utils"

const MAX_SHARE_PAGE_ROWS = 500
const MAX_EVENT_ROWS = 5000

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_events")
}

function pagesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_pages")
}

function mediaEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("media_asset_events")
}

function templatesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_templates")
}

function signalsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("signals")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

type SharePageMeta = {
  id: string
  lead_id: string
  share_page_template_id: string | null
  status: string | null
  created_at: string
  first_viewed_at: string | null
  last_viewed_at: string | null
}

export async function probeGrowthEngagementTimelineSourceAvailability(admin: SupabaseClient) {
  const availability = await probeGrowthEngagementDashboardSourceAvailability(admin)
  return {
    share_pages: availability.share_pages,
    share_page_analytics: availability.share_page_analytics,
    media_asset_events: availability.media_asset_events,
    share_page_templates: availability.share_page_templates,
    booking_handoff_foundation: availability.booking_handoff_foundation,
    high_intent_signals: availability.high_intent_signals,
  }
}

async function loadSharePageMeta(
  admin: SupabaseClient,
  organizationId: string,
  filters: GrowthEngagementTimelineFilters,
): Promise<Map<string, SharePageMeta>> {
  let query = pagesTable(admin)
    .select("id, lead_id, share_page_template_id, status, created_at, first_viewed_at, last_viewed_at")
    .eq("organization_id", organizationId)
    .limit(MAX_SHARE_PAGE_ROWS)

  if (filters.leadId) query = query.eq("lead_id", filters.leadId)
  if (filters.templateId) query = query.eq("share_page_template_id", filters.templateId)
  if (filters.sharePageId) query = query.eq("id", filters.sharePageId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return new Map(
    (data ?? []).map((row) => {
      const record = row as Record<string, unknown>
      return [
        asString(record.id),
        {
          id: asString(record.id),
          lead_id: asString(record.lead_id),
          share_page_template_id: asString(record.share_page_template_id) || null,
          status: asString(record.status) || null,
          created_at: asString(record.created_at),
          first_viewed_at: asString(record.first_viewed_at) || null,
          last_viewed_at: asString(record.last_viewed_at) || null,
        },
      ]
    }),
  )
}

async function loadSharePageTimelineEvents(
  admin: SupabaseClient,
  pageMeta: Map<string, SharePageMeta>,
  dateRange: ReturnType<typeof resolveEngagementTimelineDateRange>,
): Promise<GrowthEngagementTimelineEvent[]> {
  const sharePageIds = [...pageMeta.keys()]
  if (sharePageIds.length === 0) return []

  const { data, error } = await eventsTable(admin)
    .select("id, share_page_id, lead_id, event_type, event_label, occurred_at, metadata")
    .in("share_page_id", sharePageIds)
    .gte("occurred_at", dateRange.startIso)
    .lte("occurred_at", dateRange.endIso)
    .order("occurred_at", { ascending: false })
    .limit(MAX_EVENT_ROWS)

  if (error) throw new Error(error.message)

  const events: GrowthEngagementTimelineEvent[] = []
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>
    const rawType = asString(record.event_type)
    const mapped = mapSharePageEventType(rawType)
    if (!mapped) continue

    const sharePageId = asString(record.share_page_id)
    const page = pageMeta.get(sharePageId)
    const metadata = asRecord(record.metadata)
    const ctaKey = asString(metadata.tracking_key) || asString(record.event_label) || null

    events.push({
      eventId: asString(record.id) || `${sharePageId}:${rawType}:${asString(record.occurred_at)}`,
      eventType: mapped,
      occurredAt: asString(record.occurred_at),
      leadId: asString(record.lead_id) || page?.lead_id || null,
      sharePageId,
      templateId: page?.share_page_template_id ?? null,
      mediaAssetId: null,
      ctaKey,
      sessionId: asString(metadata.session_key) || null,
      title: buildTimelineEventTitle(mapped),
      description: asString(record.event_label) || buildTimelineEventTitle(mapped),
      metadata,
      source: "share_page_event",
    })
  }

  return events
}

async function loadMediaTimelineEvents(
  admin: SupabaseClient,
  organizationId: string,
  filters: GrowthEngagementTimelineFilters,
  dateRange: ReturnType<typeof resolveEngagementTimelineDateRange>,
): Promise<GrowthEngagementTimelineEvent[]> {
  let query = mediaEventsTable(admin)
    .select(
      "id, organization_id, asset_id, lead_id, share_page_id, template_id, session_id, event_type, event_timestamp, cta_key, metadata_json, progress_seconds, progress_percent",
    )
    .eq("organization_id", organizationId)
    .gte("event_timestamp", dateRange.startIso)
    .lte("event_timestamp", dateRange.endIso)
    .order("event_timestamp", { ascending: false })
    .limit(MAX_EVENT_ROWS)

  if (filters.leadId) query = query.eq("lead_id", filters.leadId)
  if (filters.templateId) query = query.eq("template_id", filters.templateId)
  if (filters.mediaAssetId) query = query.eq("asset_id", filters.mediaAssetId)
  if (filters.sharePageId) query = query.eq("share_page_id", filters.sharePageId)
  if (filters.sessionId) query = query.eq("session_id", filters.sessionId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const events: GrowthEngagementTimelineEvent[] = []
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>
    const rawType = asString(record.event_type)
    const mapped = mapMediaEventType(rawType)
    if (!mapped) continue

    const metadata = asRecord(record.metadata_json)
    events.push({
      eventId: asString(record.id) || `${asString(record.asset_id)}:${rawType}:${asString(record.event_timestamp)}`,
      eventType: mapped,
      occurredAt: asString(record.event_timestamp),
      leadId: asString(record.lead_id) || null,
      sharePageId: asString(record.share_page_id) || null,
      templateId: asString(record.template_id) || null,
      mediaAssetId: asString(record.asset_id) || null,
      ctaKey: asString(record.cta_key) || null,
      sessionId: asString(record.session_id) || null,
      title: buildTimelineEventTitle(mapped),
      description: buildTimelineEventTitle(mapped),
      metadata: {
        ...metadata,
        progress_seconds: record.progress_seconds ?? null,
        progress_percent: record.progress_percent ?? null,
      },
      source: "media_asset_event",
    })
  }

  return events
}

function loadTemplateInstantiationEvents(
  pageMeta: Map<string, SharePageMeta>,
  dateRange: ReturnType<typeof resolveEngagementTimelineDateRange>,
): GrowthEngagementTimelineEvent[] {
  const events: GrowthEngagementTimelineEvent[] = []
  for (const page of pageMeta.values()) {
    if (!page.share_page_template_id) continue
    if (page.created_at < dateRange.startIso || page.created_at > dateRange.endIso) continue

    events.push({
      eventId: `template_instantiated:${page.id}`,
      eventType: "template_instantiated",
      occurredAt: page.created_at,
      leadId: page.lead_id,
      sharePageId: page.id,
      templateId: page.share_page_template_id,
      mediaAssetId: null,
      ctaKey: null,
      sessionId: null,
      title: buildTimelineEventTitle("template_instantiated"),
      description: "Share page created from template lineage.",
      metadata: { share_page_status: page.status },
      source: "share_page_record",
    })
  }
  return events
}

async function loadHighIntentTimelineEvents(
  admin: SupabaseClient,
  organizationId: string,
  filters: GrowthEngagementTimelineFilters,
  dateRange: ReturnType<typeof resolveEngagementTimelineDateRange>,
): Promise<GrowthEngagementTimelineEvent[]> {
  let query = signalsTable(admin)
    .select("id, signal_type, company_name, lead_id, occurred_at, signal_score, metadata")
    .eq("organization_id", organizationId)
    .gte("occurred_at", dateRange.startIso)
    .lte("occurred_at", dateRange.endIso)
    .order("occurred_at", { ascending: false })
    .limit(500)

  if (filters.leadId) query = query.eq("lead_id", filters.leadId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const events: GrowthEngagementTimelineEvent[] = []
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>
    const signalType = asString(record.signal_type)
    if (!isHighIntentSharePageSignalType(signalType)) continue

    const metadata = asRecord(record.metadata)
    events.push({
      eventId: asString(record.id),
      eventType: "high_intent_detected",
      occurredAt: asString(record.occurred_at),
      leadId: asString(record.lead_id) || null,
      sharePageId: asString(metadata.share_page_id) || null,
      templateId: null,
      mediaAssetId: null,
      ctaKey: null,
      sessionId: asString(metadata.share_page_view_id) || null,
      title: buildTimelineEventTitle("high_intent_detected"),
      description: asString(record.company_name) || signalType.replaceAll("_", " "),
      metadata: { signal_type: signalType, signal_score: record.signal_score ?? null, ...metadata },
      source: "signal",
    })
  }

  return events
}

function loadBookingHandoffTimelineEvents(
  organizationId: string,
  filters: GrowthEngagementTimelineFilters,
  dateRange: ReturnType<typeof resolveEngagementTimelineDateRange>,
): GrowthEngagementTimelineEvent[] {
  return listBookingHandoffsForOrganization(organizationId)
    .filter((record) => {
      if (filters.leadId) return false
      if (record.createdAt < dateRange.startIso || record.createdAt > dateRange.endIso) return false
      return record.readinessTier === "meeting_ready" || record.readinessTier === "high_intent"
    })
    .map((record) => ({
      eventId: `booking_handoff:${record.handoffId}`,
      eventType: "booking_handoff_ready" as const,
      occurredAt: record.createdAt,
      leadId: null,
      sharePageId: null,
      templateId: null,
      mediaAssetId: null,
      ctaKey: null,
      sessionId: null,
      title: buildTimelineEventTitle("booking_handoff_ready"),
      description: record.bookingRecommendation,
      metadata: {
        handoff_id: record.handoffId,
        readiness_tier: record.readinessTier,
        readiness_score: record.readinessScore,
        recommended_meeting_type: record.recommendedMeetingType,
      },
      source: "booking_handoff_foundation" as const,
    }))
}

export async function fetchEngagementTimelineEvents(
  admin: SupabaseClient,
  filters: GrowthEngagementTimelineFilters,
): Promise<{ events: GrowthEngagementTimelineEvent[]; sourcesUsed: string[] }> {
  const dateRange = resolveEngagementTimelineDateRange(filters)
  const events: GrowthEngagementTimelineEvent[] = []
  const sourcesUsed: string[] = []

  if (await isGrowthSharePagesSchemaReady(admin)) {
    const pageMeta = await loadSharePageMeta(admin, filters.organizationId, filters)
    events.push(...(await loadSharePageTimelineEvents(admin, pageMeta, dateRange)))
    events.push(...loadTemplateInstantiationEvents(pageMeta, dateRange))
    sourcesUsed.push("share_page_analytics", "share_page_record")
  }

  if (await isGrowthMediaAssetAnalyticsSchemaReady(admin)) {
    events.push(...(await loadMediaTimelineEvents(admin, filters.organizationId, filters, dateRange)))
    sourcesUsed.push("media_asset_events")
  }

  const signalsProbe = await signalsTable(admin).select("id").limit(1)
  if (!signalsProbe.error) {
    events.push(...(await loadHighIntentTimelineEvents(admin, filters.organizationId, filters, dateRange)))
    sourcesUsed.push("high_intent_signals")
  }

  events.push(...loadBookingHandoffTimelineEvents(filters.organizationId, filters, dateRange))
  sourcesUsed.push("booking_handoff_foundation")

  return { events, sourcesUsed }
}

export async function fetchSharePageDrilldownMeta(admin: SupabaseClient, sharePageId: string, organizationId: string) {
  const page = await fetchGrowthSharePageById(admin, sharePageId)
  if (!page || page.organizationId !== organizationId) return null
  return page
}

export async function fetchTemplateDrilldownMeta(
  admin: SupabaseClient,
  templateId: string,
  organizationId: string,
): Promise<{ templateId: string; templateName: string } | null> {
  if (!(await isGrowthSharePageTemplatesSchemaReady(admin))) return null

  const { data, error } = await templatesTable(admin)
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("id", templateId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    templateId: asString((data as Record<string, unknown>).id),
    templateName: asString((data as Record<string, unknown>).name) || "Untitled template",
  }
}

export async function fetchMediaDrilldownMeta(
  admin: SupabaseClient,
  mediaAssetId: string,
  organizationId: string,
): Promise<{ mediaAssetId: string; assetLabel: string } | null> {
  if (!(await isGrowthMediaAssetsSchemaReady(admin))) return null

  const asset = await getMediaAsset(admin, mediaAssetId)
  if (!asset || asset.organizationId !== organizationId) return null

  return {
    mediaAssetId: asset.id,
    assetLabel: asset.title || asset.originalFilename || asset.id,
  }
}
