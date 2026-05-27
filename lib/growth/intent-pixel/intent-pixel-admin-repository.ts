import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveTrackingMode } from "@/lib/growth/intent-pixel/consent-gate"
import {
  GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER,
  type GrowthIntentPixelAdminDiagnostics,
  type GrowthIntentPixelAdminRecentEvents,
  type GrowthIntentPixelAdminSite,
  type GrowthIntentPixelAdminStreamEvent,
  type GrowthIntentPixelInstallStatus,
  type GrowthIntentPixelTrackingMode,
} from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import {
  buildIntentPixelScriptSnippet,
  isValidIntentPixelSiteKey,
  normalizeDomainAllowlist,
  siteFlagsFromTrackingMode,
  trackingModeFromSite,
} from "@/lib/growth/intent-pixel/intent-pixel-site-config"
import { fetchIntentPixelSite } from "@/lib/growth/intent-pixel/intent-pixel-repository"
import {
  GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION,
  isGrowthIntentPixelSchemaReady,
} from "@/lib/growth/intent-pixel/intent-pixel-schema-health"
import type {
  GrowthIntentPixelConsentStatus,
  GrowthIntentPixelSite,
} from "@/lib/growth/intent-pixel/intent-pixel-types"
import { GROWTH_INTENT_PIXEL_PRIVACY_NOTE } from "@/lib/growth/intent-pixel/pii-policy"
import { mergeUtmAttribution, hasUtmSignal } from "@/lib/growth/intent-pixel/utm-attribution"
import { TRACKING_VISIBILITY_IMPACTED_THRESHOLD } from "@/lib/growth/intent-pixel/intent-consent-manager-types"
import { normalizeConsentCategories } from "@/lib/growth/intent-pixel/intent-consent-categories"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function mapSiteRecord(row: Record<string, unknown>): GrowthIntentPixelSite {
  return {
    id: asString(row.id),
    site_key: asString(row.site_key),
    site_name: asString(row.site_name),
    domain_allowlist: Array.isArray(row.domain_allowlist)
      ? row.domain_allowlist.filter((e): e is string => typeof e === "string")
      : [],
    tracking_enabled: row.tracking_enabled === true,
    consent_required: row.consent_required !== false,
    allow_anonymous_pageviews: row.allow_anonymous_pageviews === true,
  }
}

function sessionStreamTrackingMode(
  site: GrowthIntentPixelSite,
  consentStatus: GrowthIntentPixelConsentStatus,
): GrowthIntentPixelAdminStreamEvent["tracking_mode"] {
  return resolveTrackingMode(site, consentStatus, "pageview").mode
}

const PII_METADATA_KEY = /email|phone|full_name|linkedin|company_name/i

function buildConsentDiagnostics(input: {
  session_count_24h: number
  consent_denied_sessions_24h: number
  consent_unknown_sessions_24h: number
  consent_granted_sessions_24h: number
  high_intent_sessions_blocked_by_consent_24h: number
  consent_required: boolean
}): Pick<
  GrowthIntentPixelAdminDiagnostics,
  | "consent_acceptance_pct"
  | "tracking_coverage_pct"
  | "anonymous_sessions_blocked_24h"
  | "high_intent_sessions_blocked_by_consent_24h"
  | "consent_breakdown"
  | "tracking_visibility_impacted"
> {
  const {
    session_count_24h,
    consent_denied_sessions_24h,
    consent_unknown_sessions_24h,
    consent_granted_sessions_24h,
    high_intent_sessions_blocked_by_consent_24h,
    consent_required,
  } = input

  const consentTotal =
    consent_granted_sessions_24h + consent_denied_sessions_24h + consent_unknown_sessions_24h

  const consent_acceptance_pct =
    consentTotal > 0 ? Math.round((consent_granted_sessions_24h / consentTotal) * 100) : null

  const tracking_coverage_pct =
    session_count_24h > 0 ? Math.round((consent_granted_sessions_24h / session_count_24h) * 100) : null

  const blockedRatio =
    consentTotal > 0
      ? (consent_denied_sessions_24h + consent_unknown_sessions_24h) / consentTotal
      : 0

  return {
    consent_acceptance_pct,
    tracking_coverage_pct,
    anonymous_sessions_blocked_24h: consent_denied_sessions_24h + consent_unknown_sessions_24h,
    high_intent_sessions_blocked_by_consent_24h,
    consent_breakdown: {
      granted: consent_granted_sessions_24h,
      denied: consent_denied_sessions_24h,
      unknown: consent_unknown_sessions_24h,
    },
    tracking_visibility_impacted:
      consent_required && consentTotal >= 3 && blockedRatio > TRACKING_VISIBILITY_IMPACTED_THRESHOLD,
  }
}

function buildCategoryCoverageDiagnostics(input: {
  session_count_24h: number
  personalization_sessions_24h: number
  marketing_sessions_24h: number
  segmented_sessions_24h: number
  campaign_attributed_sessions_24h: number
}): Pick<
  GrowthIntentPixelAdminDiagnostics,
  | "personalization_coverage_pct"
  | "marketing_attribution_coverage_pct"
  | "segmented_visitors_pct"
  | "campaign_attributed_sessions_pct"
> {
  const {
    session_count_24h,
    personalization_sessions_24h,
    marketing_sessions_24h,
    segmented_sessions_24h,
    campaign_attributed_sessions_24h,
  } = input

  const pct = (count: number) =>
    session_count_24h > 0 ? Math.round((count / session_count_24h) * 100) : null

  return {
    personalization_coverage_pct: pct(personalization_sessions_24h),
    marketing_attribution_coverage_pct: pct(marketing_sessions_24h),
    segmented_visitors_pct: pct(segmented_sessions_24h),
    campaign_attributed_sessions_pct: pct(campaign_attributed_sessions_24h),
  }
}

function readSessionConsentCategories(row: Record<string, unknown>): {
  analytics: boolean
  personalization: boolean
  marketing: boolean
} {
  const browser = row.browser_metadata
  if (!browser || typeof browser !== "object") {
    return normalizeConsentCategories(null)
  }
  const categories = (browser as Record<string, unknown>).consent_categories
  return normalizeConsentCategories(categories)
}

function hasPersonalizationSegment(row: Record<string, unknown>): boolean {
  const browser = row.browser_metadata
  if (!browser || typeof browser !== "object") return false
  const segment = (browser as Record<string, unknown>).personalization_segment
  return segment != null && typeof segment === "object"
}

function sanitizeEventMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (PII_METADATA_KEY.test(key)) continue
    out[key] = value
  }
  return out
}

export function toAdminSiteView(
  site: GrowthIntentPixelSite,
  origin: string,
  row?: { created_at?: string; updated_at?: string },
): GrowthIntentPixelAdminSite {
  const { pixel_script_url, script_snippet } = buildIntentPixelScriptSnippet(origin, site.site_key)
  return {
    id: site.id,
    site_key: site.site_key,
    site_name: site.site_name,
    domain_allowlist: site.domain_allowlist,
    tracking_mode: trackingModeFromSite(site),
    tracking_enabled: site.tracking_enabled,
    consent_required: site.consent_required,
    allow_anonymous_pageviews: site.allow_anonymous_pageviews,
    script_snippet,
    pixel_script_url,
    created_at: asString(row?.created_at) || new Date(0).toISOString(),
    updated_at: asString(row?.updated_at) || new Date(0).toISOString(),
  }
}

export async function listIntentPixelSites(
  admin: SupabaseClient,
  origin: string,
): Promise<GrowthIntentPixelAdminSite[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("intent_pixel_sites")
    .select("*")
    .order("site_key", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const site = mapSiteRecord(row as Record<string, unknown>)
    return toAdminSiteView(site, origin, row as Record<string, unknown>)
  })
}

export async function createIntentPixelSite(
  admin: SupabaseClient,
  origin: string,
  input: {
    site_key: string
    site_name: string
    domain_allowlist: string[]
    tracking_mode: GrowthIntentPixelTrackingMode
  },
): Promise<GrowthIntentPixelAdminSite> {
  const siteKey = input.site_key.trim().toLowerCase()
  if (!isValidIntentPixelSiteKey(siteKey)) {
    throw new Error("site_key must be 2–63 lowercase letters, numbers, hyphens, or underscores.")
  }

  const flags = siteFlagsFromTrackingMode(input.tracking_mode)
  const { data, error } = await admin
    .schema("growth")
    .from("intent_pixel_sites")
    .insert({
      site_key: siteKey,
      site_name: input.site_name.trim() || siteKey,
      domain_allowlist: normalizeDomainAllowlist(input.domain_allowlist),
      tracking_enabled: flags.tracking_enabled,
      consent_required: flags.consent_required,
      allow_anonymous_pageviews: flags.allow_anonymous_pageviews,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const site = mapSiteRecord(data as Record<string, unknown>)
  return toAdminSiteView(site, origin, data as Record<string, unknown>)
}

export async function updateIntentPixelSite(
  admin: SupabaseClient,
  origin: string,
  siteKey: string,
  patch: {
    site_name?: string
    domain_allowlist?: string[]
    tracking_mode?: GrowthIntentPixelTrackingMode
  },
): Promise<GrowthIntentPixelAdminSite | null> {
  const existing = await fetchIntentPixelSite(admin, siteKey)
  if (!existing) return null

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.site_name != null) update.site_name = patch.site_name.trim() || existing.site_name
  if (patch.domain_allowlist != null) {
    update.domain_allowlist = normalizeDomainAllowlist(patch.domain_allowlist)
  }
  if (patch.tracking_mode != null) {
    const flags = siteFlagsFromTrackingMode(patch.tracking_mode)
    update.tracking_enabled = flags.tracking_enabled
    update.consent_required = flags.consent_required
    update.allow_anonymous_pageviews = flags.allow_anonymous_pageviews
  }

  const { data, error } = await admin
    .schema("growth")
    .from("intent_pixel_sites")
    .update(update)
    .eq("id", existing.id)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const site = mapSiteRecord(data as Record<string, unknown>)
  return toAdminSiteView(site, origin, data as Record<string, unknown>)
}

export async function fetchIntentPixelAdminDiagnostics(
  admin: SupabaseClient,
  siteKey: string,
): Promise<GrowthIntentPixelAdminDiagnostics> {
  const schema_ready = await isGrowthIntentPixelSchemaReady(admin)
  if (!schema_ready) {
    const emptyConsent = buildConsentDiagnostics({
      session_count_24h: 0,
      consent_denied_sessions_24h: 0,
      consent_unknown_sessions_24h: 0,
      consent_granted_sessions_24h: 0,
      high_intent_sessions_blocked_by_consent_24h: 0,
      consent_required: true,
    })
    const emptyCategoryCoverage = buildCategoryCoverageDiagnostics({
      session_count_24h: 0,
      personalization_sessions_24h: 0,
      marketing_sessions_24h: 0,
      segmented_sessions_24h: 0,
      campaign_attributed_sessions_24h: 0,
    })
    return {
      qa_marker: GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER,
      schema_ready: false,
      schema_migration: GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION,
      site_key: siteKey,
      session_count_24h: 0,
      pageview_count_24h: 0,
      conversion_count_24h: 0,
      identified_contact_count_24h: 0,
      consent_denied_sessions_24h: 0,
      consent_unknown_sessions_24h: 0,
      consent_granted_sessions_24h: 0,
      ...emptyConsent,
      ...emptyCategoryCoverage,
      install_status: "schema_missing",
      last_event_at: null,
      privacy_note: GROWTH_INTENT_PIXEL_PRIVACY_NOTE,
    }
  }

  const site = await fetchIntentPixelSite(admin, siteKey)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const siteId = site?.id ?? null

  let session_count_24h = 0
  let pageview_count_24h = 0
  let conversion_count_24h = 0
  let identified_contact_count_24h = 0
  let consent_denied_sessions_24h = 0
  let consent_unknown_sessions_24h = 0
  let consent_granted_sessions_24h = 0
  let high_intent_sessions_blocked_by_consent_24h = 0
  let personalization_sessions_24h = 0
  let marketing_sessions_24h = 0
  let segmented_sessions_24h = 0
  let campaign_attributed_sessions_24h = 0

  if (siteId) {
    const [sessions, pageviews, conversions, identified, denied, unknown, granted, highIntentBlocked] =
      await Promise.all([
        admin
          .schema("growth")
          .from("intent_visitor_sessions")
          .select("id", { count: "exact", head: true })
          .eq("site_id", siteId)
          .gte("started_at", since),
        admin
          .schema("growth")
          .from("intent_pageview_events")
          .select("id", { count: "exact", head: true })
          .eq("site_id", siteId)
          .gte("captured_at", since),
        admin
          .schema("growth")
          .from("intent_conversion_events")
          .select("id", { count: "exact", head: true })
          .eq("site_id", siteId)
          .gte("captured_at", since),
        admin
          .schema("growth")
          .from("intent_identified_contacts")
          .select("id", { count: "exact", head: true })
          .eq("site_id", siteId)
          .gte("captured_at", since),
        admin
          .schema("growth")
          .from("intent_visitor_sessions")
          .select("id", { count: "exact", head: true })
          .eq("site_id", siteId)
          .gte("started_at", since)
          .eq("consent_status", "denied"),
        admin
          .schema("growth")
          .from("intent_visitor_sessions")
          .select("id", { count: "exact", head: true })
          .eq("site_id", siteId)
          .gte("started_at", since)
          .eq("consent_status", "unknown"),
        admin
          .schema("growth")
          .from("intent_visitor_sessions")
          .select("id", { count: "exact", head: true })
          .eq("site_id", siteId)
          .gte("started_at", since)
          .in("consent_status", ["granted", "not_required"]),
        admin
          .schema("growth")
          .from("intent_visitor_sessions")
          .select("id", { count: "exact", head: true })
          .eq("site_id", siteId)
          .gte("started_at", since)
          .in("consent_status", ["denied", "unknown"])
          .gte("pageview_count", 3),
      ])

    session_count_24h = sessions.count ?? 0
    pageview_count_24h = pageviews.count ?? 0
    conversion_count_24h = conversions.count ?? 0
    identified_contact_count_24h = identified.count ?? 0
    consent_denied_sessions_24h = denied.count ?? 0
    consent_unknown_sessions_24h = unknown.count ?? 0
    consent_granted_sessions_24h = granted.count ?? 0
    high_intent_sessions_blocked_by_consent_24h = highIntentBlocked.count ?? 0

    const { data: sessionCoverageRows } = await admin
      .schema("growth")
      .from("intent_visitor_sessions")
      .select("browser_metadata, first_touch_utm, last_touch_utm")
      .eq("site_id", siteId)
      .gte("started_at", since)
      .limit(1000)

    for (const row of sessionCoverageRows ?? []) {
      const record = row as Record<string, unknown>
      const categories = readSessionConsentCategories(record)
      if (categories.personalization) personalization_sessions_24h += 1
      if (categories.marketing) marketing_sessions_24h += 1
      if (hasPersonalizationSegment(record)) segmented_sessions_24h += 1
      if (categories.marketing) {
        const utm = mergeUtmAttribution(
          record.first_touch_utm && typeof record.first_touch_utm === "object"
            ? (record.first_touch_utm as Record<string, string>)
            : {},
        )
        if (hasUtmSignal(utm)) campaign_attributed_sessions_24h += 1
      }
    }
  }

  let last_event_at: string | null = null
  if (siteId) {
    const [lastPv, lastCv] = await Promise.all([
      admin
        .schema("growth")
        .from("intent_pageview_events")
        .select("captured_at")
        .eq("site_id", siteId)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .schema("growth")
        .from("intent_conversion_events")
        .select("captured_at")
        .eq("site_id", siteId)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    const pvAt = asString((lastPv.data as Record<string, unknown> | null)?.captured_at)
    const cvAt = asString((lastCv.data as Record<string, unknown> | null)?.captured_at)
    if (pvAt && cvAt) last_event_at = pvAt > cvAt ? pvAt : cvAt
    else last_event_at = pvAt || cvAt || null
  }

  let install_status: GrowthIntentPixelInstallStatus = "idle"
  if (!site?.tracking_enabled) install_status = "offline"
  else if (pageview_count_24h + conversion_count_24h > 0) install_status = "receiving"
  else if (!site) install_status = "idle"

  const consentMetrics = buildConsentDiagnostics({
    session_count_24h,
    consent_denied_sessions_24h,
    consent_unknown_sessions_24h,
    consent_granted_sessions_24h,
    high_intent_sessions_blocked_by_consent_24h,
    consent_required: site?.consent_required !== false,
  })

  const categoryMetrics = buildCategoryCoverageDiagnostics({
    session_count_24h,
    personalization_sessions_24h,
    marketing_sessions_24h,
    segmented_sessions_24h,
    campaign_attributed_sessions_24h,
  })

  return {
    qa_marker: GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER,
    schema_ready: true,
    schema_migration: GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION,
    site_key: siteKey,
    session_count_24h,
    pageview_count_24h,
    conversion_count_24h,
    identified_contact_count_24h,
    consent_denied_sessions_24h,
    consent_unknown_sessions_24h,
    consent_granted_sessions_24h,
    ...consentMetrics,
    ...categoryMetrics,
    install_status,
    last_event_at,
    privacy_note: GROWTH_INTENT_PIXEL_PRIVACY_NOTE,
  }
}

export async function fetchIntentPixelRecentEvents(
  admin: SupabaseClient,
  siteKey: string,
  limit = 40,
): Promise<GrowthIntentPixelAdminRecentEvents> {
  const site = await fetchIntentPixelSite(admin, siteKey)
  if (!site) {
    return { qa_marker: GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER, site_key: siteKey, events: [] }
  }

  const sessionById = new Map<string, GrowthIntentPixelSite & {
    visitor_key: string
    session_key: string
    consent_status: GrowthIntentPixelConsentStatus
    is_identified: boolean
  }>()

  async function loadSessionsForIds(ids: string[]) {
    const missing = ids.filter((id) => !sessionById.has(id))
    if (missing.length === 0) return
    const { data } = await admin
      .schema("growth")
      .from("intent_visitor_sessions")
      .select("id, visitor_key, session_key, consent_status, is_identified, site_id")
      .in("id", missing)
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const sid = asString(r.id)
      sessionById.set(sid, {
        ...site,
        visitor_key: asString(r.visitor_key),
        session_key: asString(r.session_key),
        consent_status: asString(r.consent_status) as GrowthIntentPixelConsentStatus,
        is_identified: r.is_identified === true,
      })
    }
  }

  const [{ data: pageviews }, { data: conversions }] = await Promise.all([
    admin
      .schema("growth")
      .from("intent_pageview_events")
      .select("id, session_id, page_url, page_path, referrer, utm, captured_at")
      .eq("site_id", site.id)
      .order("captured_at", { ascending: false })
      .limit(limit),
    admin
      .schema("growth")
      .from("intent_conversion_events")
      .select("id, session_id, conversion_type, conversion_label, page_url, metadata, captured_at")
      .eq("site_id", site.id)
      .order("captured_at", { ascending: false })
      .limit(limit),
  ])

  const sessionIds = [
    ...new Set(
      [...(pageviews ?? []), ...(conversions ?? [])].map((row) =>
        asString((row as Record<string, unknown>).session_id),
      ),
    ),
  ].filter(Boolean)
  await loadSessionsForIds(sessionIds)

  const events: GrowthIntentPixelAdminStreamEvent[] = []

  for (const row of pageviews ?? []) {
    const r = row as Record<string, unknown>
    const sessionId = asString(r.session_id)
    const session = sessionById.get(sessionId)
    if (!session) continue
    const utm = mergeUtmAttribution(
      r.utm && typeof r.utm === "object" ? (r.utm as Record<string, string>) : {},
    )
    events.push({
      kind: "pageview",
      id: asString(r.id),
      captured_at: asString(r.captured_at),
      visitor_key: session.visitor_key,
      session_key: session.session_key,
      session_id: sessionId,
      consent_status: session.consent_status,
      tracking_mode: sessionStreamTrackingMode(site, session.consent_status),
      visitor_type: session.is_identified ? "identified" : "anonymous",
      page_path: asString(r.page_path),
      page_url: asString(r.page_url),
      referrer: asString(r.referrer) || null,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
    })
  }

  for (const row of conversions ?? []) {
    const r = row as Record<string, unknown>
    const sessionId = asString(r.session_id)
    const session = sessionById.get(sessionId)
    if (!session) continue
    const meta =
      r.metadata && typeof r.metadata === "object"
        ? sanitizeEventMetadata(r.metadata as Record<string, unknown>)
        : {}
    void meta
    events.push({
      kind: "conversion",
      id: asString(r.id),
      captured_at: asString(r.captured_at),
      visitor_key: session.visitor_key,
      session_key: session.session_key,
      session_id: sessionId,
      consent_status: session.consent_status,
      tracking_mode: sessionStreamTrackingMode(site, session.consent_status),
      visitor_type: session.is_identified ? "identified" : "anonymous",
      page_path: "",
      page_url: asString(r.page_url),
      referrer: null,
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      conversion_type: asString(r.conversion_type),
      conversion_label: asString(r.conversion_label),
    })
  }

  events.sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1))
  return {
    qa_marker: GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER,
    site_key: siteKey,
    events: events.slice(0, limit),
  }
}
