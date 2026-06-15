import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildDefaultSharePageExpirationIso,
  generateSharePagePreviewTokenBundle,
  generateSharePageTokenBundle,
  hashSharePageToken,
  resolveSharePageExpirationIso,
  verifySharePageToken,
} from "@/lib/growth/share-pages/share-page-token"
import {
  DEFAULT_GROWTH_SHARE_PAGE_THEME,
  EMPTY_GROWTH_SHARE_PAGE_ENGAGEMENT_SUMMARY,
  GROWTH_SHARE_PAGES_QA_MARKER,
  type GrowthSharePage,
  type GrowthSharePageAnalyticsSummary,
  type GrowthSharePageCreateInput,
  type GrowthSharePageCreateResult,
  type GrowthSharePageCTA,
  type GrowthSharePageEngagementSummary,
  type GrowthSharePageEvent,
  type GrowthSharePageEventType,
  type GrowthSharePageHeroMediaType,
  type GrowthSharePageResource,
  type GrowthSharePageSourceChannel,
  type GrowthSharePageStatus,
  type GrowthSharePageTheme,
  type GrowthSharePageUpdateInput,
  type GrowthSharePageView,
  type GrowthSharePagePublicAccessResult,
} from "@/lib/growth/share-pages/share-page-types"

const PAGE_SELECT =
  "id, organization_id, lead_id, company_id, campaign_id, enrollment_id, sequence_step_id, sequence_execution_job_id, source_channel, status, token_prefix, published_at, expires_at, revoked_at, archived_at, first_viewed_at, last_viewed_at, max_views, engagement_summary, personalization_snapshot, personalization_context_version, sources_used, evidence_coverage_score, theme, headline, subheadline, hero_message, why_reaching_out, company_observations, cta_config, resources, booking_page_id, hero_media_type, hero_media_url, hero_media_thumbnail_url, voice_asset_id, video_asset_id, created_by, approved_by, approved_at, requires_human_review, created_at, updated_at"

const VIEW_SELECT =
  "id, share_page_id, lead_id, session_key, visitor_fingerprint_hash, started_at, last_activity_at, ended_at, duration_ms, max_scroll_depth_pct, page_url, referrer, utm, device_metadata, created_at, updated_at"

const EVENT_SELECT =
  "id, share_page_id, share_page_view_id, lead_id, event_type, event_label, metadata, occurred_at, created_at"

type SharePageRow = {
  id: string
  organization_id: string
  lead_id: string
  company_id: string | null
  campaign_id: string | null
  enrollment_id: string | null
  sequence_step_id: string | null
  sequence_execution_job_id: string | null
  source_channel: string
  status: string
  token_prefix: string
  published_at: string | null
  expires_at: string | null
  revoked_at: string | null
  archived_at: string | null
  first_viewed_at: string | null
  last_viewed_at: string | null
  max_views: number | null
  engagement_summary: Record<string, unknown> | null
  personalization_snapshot: Record<string, unknown> | null
  personalization_context_version: number
  sources_used: string[] | null
  evidence_coverage_score: number | null
  theme: Record<string, unknown> | null
  headline: string
  subheadline: string | null
  hero_message: string
  why_reaching_out: string | null
  company_observations: unknown
  cta_config: unknown
  resources: unknown
  booking_page_id: string | null
  hero_media_type: string
  hero_media_url: string | null
  hero_media_thumbnail_url: string | null
  voice_asset_id: string | null
  video_asset_id: string | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  requires_human_review: boolean
  created_at: string
  updated_at: string
}

type SharePageViewRow = {
  id: string
  share_page_id: string
  lead_id: string
  session_key: string
  visitor_fingerprint_hash: string | null
  started_at: string
  last_activity_at: string
  ended_at: string | null
  duration_ms: number
  max_scroll_depth_pct: number
  page_url: string
  referrer: string | null
  utm: Record<string, unknown> | null
  device_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type SharePageEventRow = {
  id: string
  share_page_id: string
  share_page_view_id: string | null
  lead_id: string
  event_type: string
  event_label: string
  metadata: Record<string, unknown> | null
  occurred_at: string
  created_at: string
}

function pagesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_pages")
}

function viewsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_views")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_events")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => asString(entry)).filter(Boolean)
}

function asObjectArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry) => entry && typeof entry === "object") as T[]
}

function mapTheme(value: Record<string, unknown> | null | undefined): GrowthSharePageTheme {
  const theme = value ?? {}
  return {
    brandColor: asString(theme.brandColor) || DEFAULT_GROWTH_SHARE_PAGE_THEME.brandColor,
    accentColor: asString(theme.accentColor) || DEFAULT_GROWTH_SHARE_PAGE_THEME.accentColor,
    logoUrl: asString(theme.logoUrl) || null,
    heroImageUrl: asString(theme.heroImageUrl) || null,
    publicThemeMode:
      theme.publicThemeMode === "light" || theme.publicThemeMode === "dark" || theme.publicThemeMode === "system"
        ? theme.publicThemeMode
        : DEFAULT_GROWTH_SHARE_PAGE_THEME.publicThemeMode,
    footerNote: asString(theme.footerNote) || null,
  }
}

function mapEngagementSummary(value: Record<string, unknown> | null | undefined): GrowthSharePageEngagementSummary {
  const summary = value ?? {}
  return {
    viewCount: typeof summary.viewCount === "number" ? summary.viewCount : 0,
    uniqueSessionCount: typeof summary.uniqueSessionCount === "number" ? summary.uniqueSessionCount : 0,
    ctaClickCount: typeof summary.ctaClickCount === "number" ? summary.ctaClickCount : 0,
    bookingStartedCount: typeof summary.bookingStartedCount === "number" ? summary.bookingStartedCount : 0,
    bookingCompletedCount: typeof summary.bookingCompletedCount === "number" ? summary.bookingCompletedCount : 0,
    resourceOpenCount: typeof summary.resourceOpenCount === "number" ? summary.resourceOpenCount : 0,
    maxScrollDepthPct: typeof summary.maxScrollDepthPct === "number" ? summary.maxScrollDepthPct : 0,
    avgDurationMs: typeof summary.avgDurationMs === "number" ? summary.avgDurationMs : 0,
    lastActivityAt: asString(summary.lastActivityAt) || null,
  }
}

function mapPage(row: SharePageRow): GrowthSharePage {
  return {
    id: row.id,
    organizationId: row.organization_id,
    leadId: row.lead_id,
    companyId: row.company_id,
    campaignId: row.campaign_id,
    enrollmentId: row.enrollment_id,
    sequenceStepId: row.sequence_step_id,
    sequenceExecutionJobId: row.sequence_execution_job_id,
    sourceChannel: row.source_channel as GrowthSharePageSourceChannel,
    status: row.status as GrowthSharePageStatus,
    tokenPrefix: row.token_prefix,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    archivedAt: row.archived_at,
    firstViewedAt: row.first_viewed_at,
    lastViewedAt: row.last_viewed_at,
    maxViews: row.max_views,
    engagementSummary: mapEngagementSummary(row.engagement_summary),
    personalizationSnapshot: row.personalization_snapshot ?? {},
    personalizationContextVersion: row.personalization_context_version,
    sourcesUsed: row.sources_used ?? [],
    evidenceCoverageScore: row.evidence_coverage_score,
    theme: mapTheme(row.theme),
    headline: row.headline,
    subheadline: row.subheadline,
    heroMessage: row.hero_message,
    whyReachingOut: row.why_reaching_out,
    companyObservations: asStringArray(row.company_observations),
    ctaConfig: asObjectArray<GrowthSharePageCTA>(row.cta_config),
    resources: asObjectArray<GrowthSharePageResource>(row.resources),
    bookingPageId: row.booking_page_id,
    heroMediaType: row.hero_media_type as GrowthSharePageHeroMediaType,
    heroMediaUrl: row.hero_media_url,
    heroMediaThumbnailUrl: row.hero_media_thumbnail_url,
    voiceAssetId: row.voice_asset_id,
    videoAssetId: row.video_asset_id,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    requiresHumanReview: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapView(row: SharePageViewRow): GrowthSharePageView {
  const utmEntries = row.utm ?? {}
  const utm: Record<string, string> = {}
  for (const [key, value] of Object.entries(utmEntries)) {
    if (typeof value === "string") utm[key] = value
  }

  return {
    id: row.id,
    sharePageId: row.share_page_id,
    leadId: row.lead_id,
    sessionKey: row.session_key,
    visitorFingerprintHash: row.visitor_fingerprint_hash,
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    maxScrollDepthPct: row.max_scroll_depth_pct,
    pageUrl: row.page_url,
    referrer: row.referrer,
    utm,
    deviceMetadata: row.device_metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEvent(row: SharePageEventRow): GrowthSharePageEvent {
  return {
    id: row.id,
    sharePageId: row.share_page_id,
    sharePageViewId: row.share_page_view_id,
    leadId: row.lead_id,
    eventType: row.event_type as GrowthSharePageEventType,
    eventLabel: row.event_label,
    metadata: row.metadata ?? {},
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }
}

function resolveEditableStatus(status: GrowthSharePageStatus): boolean {
  return status === "draft" || status === "pending_review"
}

function resolvePublicResolvableStatus(page: GrowthSharePage, now = new Date()): boolean {
  if (page.status !== "published") return false
  if (page.revokedAt) return false
  if (page.archivedAt) return false
  if (resolveSharePageExpirationIso(page.expiresAt, now)) return false
  return true
}

function resolvePreviewResolvableStatus(page: GrowthSharePage): boolean {
  if (page.revokedAt || page.archivedAt) return false
  return page.status === "draft" || page.status === "pending_review" || page.status === "published"
}

export async function fetchGrowthSharePageById(
  admin: SupabaseClient,
  sharePageId: string,
): Promise<GrowthSharePage | null> {
  const { data, error } = await pagesTable(admin).select(PAGE_SELECT).eq("id", sharePageId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapPage(data as SharePageRow) : null
}

export async function createSharePage(
  admin: SupabaseClient,
  input: GrowthSharePageCreateInput,
): Promise<GrowthSharePageCreateResult> {
  const publicTokenBundle = generateSharePageTokenBundle()
  const previewTokenBundle = generateSharePagePreviewTokenBundle()
  const theme = {
    ...DEFAULT_GROWTH_SHARE_PAGE_THEME,
    ...(input.theme ?? {}),
  }

  const { data, error } = await pagesTable(admin)
    .insert({
      organization_id: input.organizationId,
      lead_id: input.leadId,
      company_id: input.companyId ?? null,
      campaign_id: input.campaignId ?? null,
      enrollment_id: input.enrollmentId ?? null,
      sequence_step_id: input.sequenceStepId ?? null,
      sequence_execution_job_id: input.sequenceExecutionJobId ?? null,
      source_channel: input.sourceChannel ?? "manual",
      status: input.status ?? "draft",
      token_hash: publicTokenBundle.tokenHash,
      token_prefix: publicTokenBundle.tokenPrefix,
      preview_token_hash: previewTokenBundle.tokenHash,
      expires_at: input.expiresAt ?? buildDefaultSharePageExpirationIso(),
      max_views: input.maxViews ?? null,
      engagement_summary: EMPTY_GROWTH_SHARE_PAGE_ENGAGEMENT_SUMMARY,
      personalization_snapshot: input.personalizationSnapshot ?? {},
      personalization_context_version: input.personalizationContextVersion ?? 1,
      sources_used: input.sourcesUsed ?? [],
      evidence_coverage_score: input.evidenceCoverageScore ?? null,
      theme,
      headline: input.headline ?? "",
      subheadline: input.subheadline ?? null,
      hero_message: input.heroMessage ?? "",
      why_reaching_out: input.whyReachingOut ?? null,
      company_observations: input.companyObservations ?? [],
      cta_config: input.ctaConfig ?? [],
      resources: input.resources ?? [],
      booking_page_id: input.bookingPageId ?? null,
      hero_media_type: input.heroMediaType ?? "none",
      hero_media_url: input.heroMediaUrl ?? null,
      hero_media_thumbnail_url: input.heroMediaThumbnailUrl ?? null,
      voice_asset_id: input.voiceAssetId ?? null,
      video_asset_id: input.videoAssetId ?? null,
      created_by: input.createdBy ?? null,
      requires_human_review: true,
      qa_marker: GROWTH_SHARE_PAGES_QA_MARKER,
    })
    .select(PAGE_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return {
    page: mapPage(data as SharePageRow),
    publicToken: publicTokenBundle.rawToken,
    previewToken: previewTokenBundle.rawToken,
  }
}

export async function updateSharePage(
  admin: SupabaseClient,
  sharePageId: string,
  input: GrowthSharePageUpdateInput,
): Promise<GrowthSharePage> {
  const existing = await fetchGrowthSharePageById(admin, sharePageId)
  if (!existing) throw new Error("share_page_not_found")
  if (!resolveEditableStatus(existing.status)) {
    throw new Error("share_page_not_editable")
  }

  const patch: Record<string, unknown> = {}
  if (input.status !== undefined) patch.status = input.status
  if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt
  if (input.maxViews !== undefined) patch.max_views = input.maxViews
  if (input.personalizationSnapshot !== undefined) {
    patch.personalization_snapshot = input.personalizationSnapshot
  }
  if (input.personalizationContextVersion !== undefined) {
    patch.personalization_context_version = input.personalizationContextVersion
  }
  if (input.sourcesUsed !== undefined) patch.sources_used = input.sourcesUsed
  if (input.evidenceCoverageScore !== undefined) {
    patch.evidence_coverage_score = input.evidenceCoverageScore
  }
  if (input.theme !== undefined) patch.theme = { ...existing.theme, ...input.theme }
  if (input.headline !== undefined) patch.headline = input.headline
  if (input.subheadline !== undefined) patch.subheadline = input.subheadline
  if (input.heroMessage !== undefined) patch.hero_message = input.heroMessage
  if (input.whyReachingOut !== undefined) patch.why_reaching_out = input.whyReachingOut
  if (input.companyObservations !== undefined) patch.company_observations = input.companyObservations
  if (input.ctaConfig !== undefined) patch.cta_config = input.ctaConfig
  if (input.resources !== undefined) patch.resources = input.resources
  if (input.bookingPageId !== undefined) patch.booking_page_id = input.bookingPageId
  if (input.heroMediaType !== undefined) patch.hero_media_type = input.heroMediaType
  if (input.heroMediaUrl !== undefined) patch.hero_media_url = input.heroMediaUrl
  if (input.heroMediaThumbnailUrl !== undefined) {
    patch.hero_media_thumbnail_url = input.heroMediaThumbnailUrl
  }
  if (input.voiceAssetId !== undefined) patch.voice_asset_id = input.voiceAssetId
  if (input.videoAssetId !== undefined) patch.video_asset_id = input.videoAssetId

  const { data, error } = await pagesTable(admin)
    .update(patch)
    .eq("id", sharePageId)
    .select(PAGE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapPage(data as SharePageRow)
}

export async function approveSharePage(
  admin: SupabaseClient,
  sharePageId: string,
  input: { approvedBy: string; approvedAt?: string },
): Promise<GrowthSharePage> {
  const existing = await fetchGrowthSharePageById(admin, sharePageId)
  if (!existing) throw new Error("share_page_not_found")
  if (existing.status !== "draft" && existing.status !== "pending_review") {
    throw new Error("share_page_not_approvable")
  }

  const approvedAt = input.approvedAt ?? new Date().toISOString()
  const { data, error } = await pagesTable(admin)
    .update({
      status: "published",
      published_at: approvedAt,
      approved_by: input.approvedBy,
      approved_at: approvedAt,
      requires_human_review: true,
    })
    .eq("id", sharePageId)
    .select(PAGE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapPage(data as SharePageRow)
}

export async function revokeSharePage(
  admin: SupabaseClient,
  sharePageId: string,
  input?: { revokedAt?: string },
): Promise<GrowthSharePage> {
  const revokedAt = input?.revokedAt ?? new Date().toISOString()
  const { data, error } = await pagesTable(admin)
    .update({
      status: "revoked",
      revoked_at: revokedAt,
    })
    .eq("id", sharePageId)
    .select(PAGE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapPage(data as SharePageRow)
}

export async function archiveSharePage(
  admin: SupabaseClient,
  sharePageId: string,
  input?: { archivedAt?: string },
): Promise<GrowthSharePage> {
  const archivedAt = input?.archivedAt ?? new Date().toISOString()
  const { data, error } = await pagesTable(admin)
    .update({
      status: "archived",
      archived_at: archivedAt,
    })
    .eq("id", sharePageId)
    .select(PAGE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapPage(data as SharePageRow)
}

async function fetchSharePageRowByTokenHash(
  admin: SupabaseClient,
  tokenHash: string,
  column: "token_hash" | "preview_token_hash",
): Promise<SharePageRow | null> {
  const { data, error } = await pagesTable(admin).select(PAGE_SELECT).eq(column, tokenHash).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? (data as SharePageRow) : null
}

export async function resolveSharePageByToken(
  admin: SupabaseClient,
  rawToken: string,
): Promise<GrowthSharePage | null> {
  const lookup = await lookupSharePageByPublicToken(admin, rawToken)
  return lookup.access === "granted" ? lookup.page : null
}

export async function resolveSharePageByPreviewToken(
  admin: SupabaseClient,
  rawToken: string,
): Promise<GrowthSharePage | null> {
  const lookup = await lookupSharePageByPreviewToken(admin, rawToken)
  return lookup.access === "granted" ? lookup.page : null
}

export async function lookupSharePageByPublicToken(
  admin: SupabaseClient,
  rawToken: string,
): Promise<GrowthSharePagePublicAccessResult> {
  const normalized = rawToken.trim()
  if (!normalized) return { access: "not_found", page: null }

  const tokenHash = hashSharePageToken(normalized)
  const row = await fetchSharePageRowByTokenHash(admin, tokenHash, "token_hash")
  if (!row) return { access: "not_found", page: null }
  if (!verifySharePageToken(normalized, tokenHash)) return { access: "not_found", page: null }

  const page = mapPage(row)
  if (page.archivedAt || page.status === "archived") return { access: "archived", page }
  if (page.revokedAt || page.status === "revoked") return { access: "revoked", page }
  if (resolveSharePageExpirationIso(page.expiresAt)) return { access: "expired", page }
  if (page.status !== "published") return { access: "unpublished", page }
  return { access: "granted", page }
}

export async function lookupSharePageByPreviewToken(
  admin: SupabaseClient,
  rawToken: string,
): Promise<GrowthSharePagePublicAccessResult> {
  const normalized = rawToken.trim()
  if (!normalized) return { access: "not_found", page: null }

  const tokenHash = hashSharePageToken(normalized)
  const row = await fetchSharePageRowByTokenHash(admin, tokenHash, "preview_token_hash")
  if (!row) return { access: "not_found", page: null }
  if (!verifySharePageToken(normalized, tokenHash)) return { access: "not_found", page: null }

  const page = mapPage(row)
  if (page.archivedAt || page.status === "archived") return { access: "archived", page }
  if (page.revokedAt || page.status === "revoked") return { access: "revoked", page }
  if (!resolvePreviewResolvableStatus(page)) return { access: "unpublished", page }
  return { access: "granted", page }
}

export async function createSharePageViewSession(
  admin: SupabaseClient,
  input: {
    sharePageId: string
    leadId: string
    sessionKey: string
    visitorFingerprintHash?: string | null
    pageUrl?: string
    referrer?: string | null
    utm?: Record<string, string>
    deviceMetadata?: Record<string, unknown>
    startedAt?: string
  },
): Promise<GrowthSharePageView> {
  const startedAt = input.startedAt ?? new Date().toISOString()
  const { data, error } = await viewsTable(admin)
    .insert({
      share_page_id: input.sharePageId,
      lead_id: input.leadId,
      session_key: input.sessionKey,
      visitor_fingerprint_hash: input.visitorFingerprintHash ?? null,
      started_at: startedAt,
      last_activity_at: startedAt,
      page_url: input.pageUrl ?? "",
      referrer: input.referrer ?? null,
      utm: input.utm ?? {},
      device_metadata: input.deviceMetadata ?? {},
    })
    .select(VIEW_SELECT)
    .single()

  if (error) throw new Error(error.message)

  await pagesTable(admin)
    .update({
      first_viewed_at: startedAt,
      last_viewed_at: startedAt,
    })
    .eq("id", input.sharePageId)
    .is("first_viewed_at", null)

  await pagesTable(admin).update({ last_viewed_at: startedAt }).eq("id", input.sharePageId)

  return mapView(data as SharePageViewRow)
}

export async function updateSharePageViewSession(
  admin: SupabaseClient,
  viewId: string,
  input: {
    durationMs?: number
    maxScrollDepthPct?: number
    endedAt?: string | null
    lastActivityAt?: string
    pageUrl?: string
    referrer?: string | null
    deviceMetadata?: Record<string, unknown>
  },
): Promise<GrowthSharePageView> {
  const patch: Record<string, unknown> = {}
  if (input.durationMs !== undefined) patch.duration_ms = input.durationMs
  if (input.maxScrollDepthPct !== undefined) patch.max_scroll_depth_pct = input.maxScrollDepthPct
  if (input.endedAt !== undefined) patch.ended_at = input.endedAt
  if (input.lastActivityAt !== undefined) patch.last_activity_at = input.lastActivityAt
  if (input.pageUrl !== undefined) patch.page_url = input.pageUrl
  if (input.referrer !== undefined) patch.referrer = input.referrer
  if (input.deviceMetadata !== undefined) patch.device_metadata = input.deviceMetadata

  const { data, error } = await viewsTable(admin).update(patch).eq("id", viewId).select(VIEW_SELECT).single()

  if (error) throw new Error(error.message)
  return mapView(data as SharePageViewRow)
}

export async function appendSharePageEvent(
  admin: SupabaseClient,
  input: {
    sharePageId: string
    leadId: string
    eventType: GrowthSharePageEventType
    sharePageViewId?: string | null
    eventLabel?: string
    metadata?: Record<string, unknown>
    occurredAt?: string
  },
): Promise<GrowthSharePageEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      share_page_id: input.sharePageId,
      share_page_view_id: input.sharePageViewId ?? null,
      lead_id: input.leadId,
      event_type: input.eventType,
      event_label: input.eventLabel ?? "",
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select(EVENT_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapEvent(data as SharePageEventRow)
}

export async function getSharePageAnalyticsSummary(
  admin: SupabaseClient,
  sharePageId: string,
): Promise<GrowthSharePageAnalyticsSummary | null> {
  const page = await fetchGrowthSharePageById(admin, sharePageId)
  if (!page) return null

  const [{ data: views, error: viewsError }, { data: events, error: eventsError }] = await Promise.all([
    viewsTable(admin).select("id, duration_ms, max_scroll_depth_pct, started_at").eq("share_page_id", sharePageId),
    eventsTable(admin).select("event_type, occurred_at").eq("share_page_id", sharePageId),
  ])

  if (viewsError) throw new Error(viewsError.message)
  if (eventsError) throw new Error(eventsError.message)

  const viewRows = (views ?? []) as Array<{
    id: string
    duration_ms: number
    max_scroll_depth_pct: number
    started_at: string
  }>
  const eventRows = (events ?? []) as Array<{ event_type: string; occurred_at: string }>

  const eventCounts: Partial<Record<GrowthSharePageEventType, number>> = {}
  let lastEventAt: string | null = null

  for (const event of eventRows) {
    const eventType = event.event_type as GrowthSharePageEventType
    eventCounts[eventType] = (eventCounts[eventType] ?? 0) + 1
    if (!lastEventAt || event.occurred_at > lastEventAt) lastEventAt = event.occurred_at
  }

  const viewCount = eventCounts.SHARE_PAGE_VIEWED ?? viewRows.length
  const uniqueSessionCount = viewRows.length
  const maxScrollDepthPct = viewRows.reduce((max, row) => Math.max(max, row.max_scroll_depth_pct), 0)
  const totalDurationMs = viewRows.reduce((sum, row) => sum + (row.duration_ms ?? 0), 0)
  const avgDurationMs = uniqueSessionCount > 0 ? Math.round(totalDurationMs / uniqueSessionCount) : 0

  const engagementSummary: GrowthSharePageEngagementSummary = {
    viewCount,
    uniqueSessionCount,
    ctaClickCount: eventCounts.SHARE_PAGE_CTA_CLICKED ?? 0,
    bookingStartedCount: eventCounts.SHARE_PAGE_BOOKING_STARTED ?? 0,
    bookingCompletedCount: eventCounts.SHARE_PAGE_BOOKING_COMPLETED ?? 0,
    resourceOpenCount: eventCounts.SHARE_PAGE_RESOURCE_OPENED ?? 0,
    maxScrollDepthPct,
    avgDurationMs,
    lastActivityAt: lastEventAt ?? page.lastViewedAt,
  }

  return {
    sharePageId: page.id,
    leadId: page.leadId,
    status: page.status,
    viewCount,
    uniqueSessionCount,
    eventCounts,
    engagementSummary,
    firstViewedAt: page.firstViewedAt,
    lastViewedAt: page.lastViewedAt,
    lastEventAt,
  }
}

export type GrowthSharePageListFilters = {
  organizationId: string
  status?: GrowthSharePageStatus
  sourceChannel?: GrowthSharePageSourceChannel
  leadIds?: string[] | null
  limit?: number
  offset?: number
}

export async function listGrowthSharePagesForOrganization(
  admin: SupabaseClient,
  filters: GrowthSharePageListFilters,
): Promise<{ pages: GrowthSharePage[]; total: number }> {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  let query = pagesTable(admin)
    .select(PAGE_SELECT, { count: "exact" })
    .eq("organization_id", filters.organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.sourceChannel) query = query.eq("source_channel", filters.sourceChannel)
  if (filters.leadIds?.length) query = query.in("lead_id", filters.leadIds)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return {
    pages: (data ?? []).map((row) => mapPage(row as SharePageRow)),
    total: count ?? (data ?? []).length,
  }
}

export async function searchSharePageLeadIds(
  admin: SupabaseClient,
  search: string,
  limit = 200,
): Promise<string[]> {
  const term = search.trim()
  if (!term) return []

  const pattern = `%${term.replace(/[%_]/g, "")}%`
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .or(`company_name.ilike.${pattern},contact_name.ilike.${pattern},contact_email.ilike.${pattern}`)
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => asString(row.id)).filter(Boolean)
}

export async function regenerateSharePagePreviewToken(
  admin: SupabaseClient,
  sharePageId: string,
): Promise<{ page: GrowthSharePage; previewToken: string }> {
  const existing = await fetchGrowthSharePageById(admin, sharePageId)
  if (!existing) throw new Error("share_page_not_found")
  if (existing.archivedAt || existing.status === "archived") {
    throw new Error("share_page_archived")
  }

  const previewTokenBundle = generateSharePagePreviewTokenBundle()
  const { data, error } = await pagesTable(admin)
    .update({ preview_token_hash: previewTokenBundle.tokenHash })
    .eq("id", sharePageId)
    .select(PAGE_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return {
    page: mapPage(data as SharePageRow),
    previewToken: previewTokenBundle.rawToken,
  }
}

export async function listSharePageEventsForPage(
  admin: SupabaseClient,
  sharePageId: string,
  limit = 50,
): Promise<GrowthSharePageEvent[]> {
  const { data, error } = await eventsTable(admin)
    .select(EVENT_SELECT)
    .eq("share_page_id", sharePageId)
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEvent(row as SharePageEventRow))
}
