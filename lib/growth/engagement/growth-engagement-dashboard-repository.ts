import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listBookingHandoffsForOrganization } from "@/lib/growth/media/media-booking-handoff-service"
import { listMediaAssetEventRollups } from "@/lib/growth/media/media-asset-analytics-repository"
import { isGrowthMediaAssetAnalyticsSchemaReady } from "@/lib/growth/media/media-asset-analytics-schema-health"
import { isGrowthMediaAssetsSchemaReady } from "@/lib/growth/media/media-asset-schema-health"
import { listMediaAssets } from "@/lib/growth/media/media-asset-repository"
import { isHighIntentSharePageSignalType } from "@/lib/growth/share-pages/share-page-analytics-signals"
import { isGrowthSharePageTemplatesSchemaReady } from "@/lib/growth/share-pages/share-page-template-schema-health"
import { isGrowthSharePagesSchemaReady } from "@/lib/growth/share-pages/share-pages-schema-health"
import type {
  GrowthEngagementDashboardFilters,
  GrowthEngagementDashboardHighIntentSignal,
  GrowthEngagementDashboardMediaPerformanceRow,
  GrowthEngagementDashboardResolvedDateRange,
  GrowthEngagementDashboardSourceAvailability,
  GrowthEngagementDashboardTemplatePerformanceRow,
  SharePageEngagementSnapshot,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"

const MAX_SHARE_PAGE_IDS = 500
const MAX_EVENTS = 5000
const MAX_SIGNALS = 100

function viewsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_views")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_events")
}

function pagesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_pages")
}

function templatesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_templates")
}

function templateVersionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_template_versions")
}

function signalsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("signals")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

type SharePageScopeRow = {
  id: string
  share_page_template_id: string | null
  lead_id: string
}

type SharePageViewRow = {
  id: string
  share_page_id: string
  session_key: string
  started_at: string
}

type SharePageEventRow = {
  share_page_id: string
  event_type: string
  occurred_at: string
  metadata: Record<string, unknown> | null
}

export async function probeGrowthEngagementDashboardSourceAvailability(
  admin: SupabaseClient,
): Promise<GrowthEngagementDashboardSourceAvailability> {
  const [
    sharePagesReady,
    mediaAssetsReady,
    mediaAnalyticsReady,
    templatesReady,
    signalsProbe,
  ] = await Promise.all([
    isGrowthSharePagesSchemaReady(admin),
    isGrowthMediaAssetsSchemaReady(admin),
    isGrowthMediaAssetAnalyticsSchemaReady(admin),
    isGrowthSharePageTemplatesSchemaReady(admin),
    signalsTable(admin).select("id, signal_type, occurred_at").limit(1),
  ])

  return {
    share_pages: {
      source_available: sharePagesReady,
      message: sharePagesReady ? null : "growth.share_pages is not queryable.",
    },
    share_page_analytics: {
      source_available: sharePagesReady,
      message: sharePagesReady ? null : "share_page_views/events are not queryable.",
    },
    media_assets: {
      source_available: mediaAssetsReady,
      message: mediaAssetsReady ? null : "growth.media_assets is not queryable.",
    },
    media_asset_events: {
      source_available: mediaAnalyticsReady,
      message: mediaAnalyticsReady ? null : "growth.media_asset_events is not queryable.",
    },
    media_asset_event_rollups: {
      source_available: mediaAnalyticsReady,
      message: mediaAnalyticsReady ? null : "growth.media_asset_event_rollups is not queryable.",
    },
    share_page_templates: {
      source_available: templatesReady,
      message: templatesReady ? null : "growth.share_page_templates is not queryable.",
    },
    booking_handoff_foundation: {
      source_available: true,
      message: "In-memory booking handoff foundation metadata (no calendar execution).",
    },
    high_intent_signals: {
      source_available: !signalsProbe.error,
      message: signalsProbe.error?.message ?? null,
    },
  }
}

async function resolveSharePageScope(
  admin: SupabaseClient,
  filters: GrowthEngagementDashboardFilters,
): Promise<SharePageScopeRow[]> {
  let query = pagesTable(admin)
    .select("id, share_page_template_id, lead_id")
    .eq("organization_id", filters.organizationId)
    .limit(MAX_SHARE_PAGE_IDS)

  if (filters.templateId) query = query.eq("share_page_template_id", filters.templateId)
  if (filters.leadId) query = query.eq("lead_id", filters.leadId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as SharePageScopeRow[]
}

async function loadSharePageViews(
  admin: SupabaseClient,
  sharePageIds: string[],
  dateRange: GrowthEngagementDashboardResolvedDateRange,
): Promise<SharePageViewRow[]> {
  if (sharePageIds.length === 0) return []

  const { data, error } = await viewsTable(admin)
    .select("id, share_page_id, session_key, started_at")
    .in("share_page_id", sharePageIds)
    .gte("started_at", dateRange.startIso)
    .lte("started_at", dateRange.endIso)
    .limit(MAX_EVENTS)

  if (error) throw new Error(error.message)
  return (data ?? []) as SharePageViewRow[]
}

async function loadSharePageEvents(
  admin: SupabaseClient,
  sharePageIds: string[],
  dateRange: GrowthEngagementDashboardResolvedDateRange,
): Promise<SharePageEventRow[]> {
  if (sharePageIds.length === 0) return []

  const { data, error } = await eventsTable(admin)
    .select("share_page_id, event_type, occurred_at, metadata")
    .in("share_page_id", sharePageIds)
    .gte("occurred_at", dateRange.startIso)
    .lte("occurred_at", dateRange.endIso)
    .limit(MAX_EVENTS)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    share_page_id: asString((row as Record<string, unknown>).share_page_id),
    event_type: asString((row as Record<string, unknown>).event_type),
    occurred_at: asString((row as Record<string, unknown>).occurred_at),
    metadata: asRecord((row as Record<string, unknown>).metadata),
  }))
}

function countEventType(events: SharePageEventRow[], eventType: string): number {
  return events.filter((event) => event.event_type === eventType).length
}

export async function fetchSharePageEngagementSnapshot(
  admin: SupabaseClient,
  filters: GrowthEngagementDashboardFilters,
  dateRange: GrowthEngagementDashboardResolvedDateRange,
): Promise<SharePageEngagementSnapshot | null> {
  if (!(await isGrowthSharePagesSchemaReady(admin))) return null

  const scope = await resolveSharePageScope(admin, filters)
  const sharePageIds = scope.map((row) => row.id)
  const [views, events] = await Promise.all([
    loadSharePageViews(admin, sharePageIds, dateRange),
    loadSharePageEvents(admin, sharePageIds, dateRange),
  ])

  const uniqueSessions = new Set(views.map((view) => `${view.share_page_id}:${view.session_key}`))
  const templateIds = new Set(
    scope
      .filter((row) => row.share_page_template_id)
      .map((row) => row.share_page_template_id as string),
  )

  return {
    sharePageIds,
    views,
    events: events.map((event) => ({
      share_page_id: event.share_page_id,
      event_type: event.event_type,
      occurred_at: event.occurred_at,
      metadata: event.metadata ?? {},
    })),
    totalSharePageViews: Math.max(countEventType(events, "SHARE_PAGE_VIEWED"), views.length),
    uniqueSharePageVisitors: uniqueSessions.size,
    ctaClicks: countEventType(events, "SHARE_PAGE_CTA_CLICKED"),
    bookingStarts: countEventType(events, "SHARE_PAGE_BOOKING_STARTED"),
    bookingCompletions: countEventType(events, "SHARE_PAGE_BOOKING_COMPLETED"),
    templateUsageCount: templateIds.size,
  }
}

export async function fetchTemplatePerformanceRows(
  admin: SupabaseClient,
  filters: GrowthEngagementDashboardFilters,
  dateRange: GrowthEngagementDashboardResolvedDateRange,
): Promise<GrowthEngagementDashboardTemplatePerformanceRow[] | null> {
  if (!(await isGrowthSharePagesSchemaReady(admin))) return null
  if (!(await isGrowthSharePageTemplatesSchemaReady(admin))) return null

  const scope = await resolveSharePageScope(admin, filters)
  const events = await loadSharePageEvents(
    admin,
    scope.map((row) => row.id),
    dateRange,
  )

  const usageByTemplate = new Map<string, { pageIds: Set<string>; events: SharePageEventRow[] }>()
  for (const page of scope) {
    if (!page.share_page_template_id) continue
    const bucket = usageByTemplate.get(page.share_page_template_id) ?? {
      pageIds: new Set<string>(),
      events: [],
    }
    bucket.pageIds.add(page.id)
    usageByTemplate.set(page.share_page_template_id, bucket)
  }

  for (const event of events) {
    const page = scope.find((row) => row.id === event.share_page_id)
    if (!page?.share_page_template_id) continue
    const bucket = usageByTemplate.get(page.share_page_template_id)
    if (!bucket) continue
    bucket.events.push(event)
  }

  const templateIds = [...usageByTemplate.keys()]
  if (templateIds.length === 0) return []

  const { data: templateRows, error } = await templatesTable(admin)
    .select("id, name")
    .eq("organization_id", filters.organizationId)
    .in("id", templateIds)

  if (error) throw new Error(error.message)

  const nameById = new Map(
    (templateRows ?? []).map((row) => [asString((row as Record<string, unknown>).id), asString((row as Record<string, unknown>).name)]),
  )

  return templateIds
    .map((templateId) => {
      const bucket = usageByTemplate.get(templateId)
      if (!bucket) return null
      const lastActivityAt =
        bucket.events
          .map((event) => event.occurred_at)
          .sort()
          .at(-1) ?? null

      return {
        templateId,
        templateName: nameById.get(templateId) || "Untitled template",
        usageCount: bucket.pageIds.size,
        sharePageViews: countEventType(bucket.events, "SHARE_PAGE_VIEWED"),
        ctaClicks: countEventType(bucket.events, "SHARE_PAGE_CTA_CLICKED"),
        bookingStarts: countEventType(bucket.events, "SHARE_PAGE_BOOKING_STARTED"),
        bookingCompletions: countEventType(bucket.events, "SHARE_PAGE_BOOKING_COMPLETED"),
        lastActivityAt,
      }
    })
    .filter((row): row is GrowthEngagementDashboardTemplatePerformanceRow => row != null)
    .sort((a, b) => b.sharePageViews - a.sharePageViews || b.usageCount - a.usageCount)
}

export async function fetchMediaPerformanceRows(
  admin: SupabaseClient,
  filters: GrowthEngagementDashboardFilters,
): Promise<GrowthEngagementDashboardMediaPerformanceRow[] | null> {
  if (!(await isGrowthMediaAssetsSchemaReady(admin))) return null
  if (!(await isGrowthMediaAssetAnalyticsSchemaReady(admin))) return null

  const rollups = await listMediaAssetEventRollups(admin, {
    organizationId: filters.organizationId,
    limit: 200,
  })

  const filteredRollups = filters.mediaAssetId
    ? rollups.filter((rollup) => rollup.assetId === filters.mediaAssetId)
    : rollups

  const { items: assets } = await listMediaAssets(admin, {
    organizationId: filters.organizationId,
    limit: 200,
  })

  const labelByAssetId = new Map(
    assets.map((asset) => [asset.id, asset.title || asset.originalFilename || asset.id]),
  )

  return filteredRollups
    .map((rollup) => ({
      assetId: rollup.assetId,
      assetLabel: labelByAssetId.get(rollup.assetId) ?? rollup.assetId,
      views: rollup.views,
      uniqueViews: rollup.uniqueViews,
      playStarts: rollup.playStarts,
      completions: rollup.completions,
      ctaClicks: rollup.ctaClicks,
      averageWatchSeconds: rollup.averageWatchSeconds,
      completionRate: rollup.completionRate,
      lastEventAt: rollup.lastEventAt,
    }))
    .sort((a, b) => b.views - a.views || b.playStarts - a.playStarts)
}

export async function fetchHighIntentSignals(
  admin: SupabaseClient,
  filters: GrowthEngagementDashboardFilters,
  dateRange: GrowthEngagementDashboardResolvedDateRange,
): Promise<GrowthEngagementDashboardHighIntentSignal[] | null> {
  const items: GrowthEngagementDashboardHighIntentSignal[] = []

  const signalsProbe = await signalsTable(admin).select("id").limit(1)
  if (!signalsProbe.error) {
    let query = signalsTable(admin)
      .select("id, signal_type, company_name, occurred_at, signal_score, metadata")
      .eq("organization_id", filters.organizationId)
      .gte("occurred_at", dateRange.startIso)
      .lte("occurred_at", dateRange.endIso)
      .order("occurred_at", { ascending: false })
      .limit(MAX_SIGNALS)

    if (filters.leadId) query = query.contains("metadata", { lead_id: filters.leadId })

    const { data, error } = await query

    if (error) throw new Error(error.message)

    for (const row of data ?? []) {
      const record = row as Record<string, unknown>
      const signalType = asString(record.signal_type)
      if (!isHighIntentSharePageSignalType(signalType)) continue

      const metadata = asRecord(record.metadata)
      if (filters.leadId && asString(metadata.lead_id) !== filters.leadId) continue

      items.push({
        id: asString(record.id),
        signalType,
        companyName: asString(record.company_name) || "Unknown company",
        leadId: asString(metadata.lead_id) || null,
        sharePageId: asString(metadata.share_page_id) || null,
        assetId: null,
        occurredAt: asString(record.occurred_at),
        score: asNumber(record.signal_score, NaN) || null,
        excerpt: typeof metadata.excerpt === "string" ? metadata.excerpt : null,
        source: "signal",
      })
    }
  }

  if (await isGrowthSharePagesSchemaReady(admin)) {
    const snapshot = await fetchSharePageEngagementSnapshot(admin, filters, dateRange)
    if (snapshot) {
      for (const event of snapshot.events) {
        if (
          event.event_type !== "SHARE_PAGE_CTA_CLICKED" &&
          event.event_type !== "SHARE_PAGE_BOOKING_STARTED" &&
          event.event_type !== "SHARE_PAGE_BOOKING_COMPLETED"
        ) {
          continue
        }

        items.push({
          id: `${event.share_page_id}:${event.event_type}:${event.occurred_at}`,
          signalType: event.event_type.toLowerCase(),
          companyName: "Share page engagement",
          leadId: filters.leadId ?? null,
          sharePageId: event.share_page_id,
          assetId: null,
          occurredAt: event.occurred_at,
          score: null,
          excerpt: event.event_type.replaceAll("_", " ").toLowerCase(),
          source: "share_page_event",
        })
      }
    }
  }

  return items
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, MAX_SIGNALS)
}

export async function countTemplatesWithBookingHandoffEnabled(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number | null> {
  if (!(await isGrowthSharePageTemplatesSchemaReady(admin))) return null

  const { data: templates, error } = await templatesTable(admin)
    .select("id, current_version_id, published_version_id")
    .eq("organization_id", organizationId)
    .limit(200)

  if (error) throw new Error(error.message)
  if (!templates?.length) return 0

  const versionIds = [
    ...new Set(
      (templates as Array<Record<string, unknown>>)
        .flatMap((row) => [asString(row.current_version_id), asString(row.published_version_id)])
        .filter(Boolean),
    ),
  ]

  if (versionIds.length === 0) return 0

  const { data: versions, error: versionError } = await templateVersionsTable(admin)
    .select("id, blocks_json")
    .in("id", versionIds)

  if (versionError) throw new Error(versionError.message)

  let enabledCount = 0
  for (const version of versions ?? []) {
    const blocks = (version as Record<string, unknown>).blocks_json
    if (!Array.isArray(blocks)) continue
    const enabled = blocks.some((block) => {
      if (!block || typeof block !== "object") return false
      const settings = asRecord((block as Record<string, unknown>).settings)
      const aiVideo = asRecord(settings.aiVideo)
      const conversationalAgent = asRecord(aiVideo.conversationalAgent)
      const bookingHandoff = asRecord(conversationalAgent.bookingHandoff)
      return bookingHandoff.enabled === true || settings.bookingHandoffEnabled === true
    })
    if (enabled) enabledCount += 1
  }

  return enabledCount
}

export function fetchBookingHandoffFoundationCounts(organizationId: string): {
  foundationHandoffRecords: number
  readyTierCount: number
  highIntentTierCount: number
} {
  const records = listBookingHandoffsForOrganization(organizationId)
  return {
    foundationHandoffRecords: records.length,
    readyTierCount: records.filter((record) => record.readinessTier === "meeting_ready").length,
    highIntentTierCount: records.filter((record) => record.readinessTier === "high_intent").length,
  }
}
