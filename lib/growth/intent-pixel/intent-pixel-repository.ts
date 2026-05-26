import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isGrowthIntentPixelSchemaReady } from "@/lib/growth/intent-pixel/intent-pixel-schema-health"
import type {
  GrowthIntentPixelCollectPayload,
  GrowthIntentPixelConsentStatus,
  GrowthIntentPixelConversionEvent,
  GrowthIntentPixelIdentifiedContact,
  GrowthIntentPixelPageviewEvent,
  GrowthIntentPixelSite,
  GrowthIntentPixelUtmAttribution,
  GrowthIntentPixelVisitHistory,
  GrowthIntentPixelVisitorSession,
} from "@/lib/growth/intent-pixel/intent-pixel-types"
import { extractPagePath, normalizeBrowserMetadata, normalizeDeviceMetadata } from "@/lib/growth/intent-pixel/device-metadata"
import { mergeUtmAttribution } from "@/lib/growth/intent-pixel/utm-attribution"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function mapSite(row: Record<string, unknown>): GrowthIntentPixelSite {
  return {
    id: asString(row.id),
    site_key: asString(row.site_key),
    site_name: asString(row.site_name),
    domain_allowlist: Array.isArray(row.domain_allowlist)
      ? row.domain_allowlist.filter((e): e is string => typeof e === "string")
      : [],
    tracking_enabled: row.tracking_enabled === true,
    consent_required: row.consent_required !== false,
  }
}

function mapUtm(value: unknown): GrowthIntentPixelUtmAttribution {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return mergeUtmAttribution({
    utm_source: asString(row.utm_source),
    utm_medium: asString(row.utm_medium),
    utm_campaign: asString(row.utm_campaign),
    utm_term: asString(row.utm_term),
    utm_content: asString(row.utm_content),
  })
}

function mapSession(row: Record<string, unknown>): GrowthIntentPixelVisitorSession {
  return {
    id: asString(row.id),
    site_id: asString(row.site_id),
    visitor_key: asString(row.visitor_key),
    session_key: asString(row.session_key),
    is_identified: row.is_identified === true,
    consent_status: asString(row.consent_status) as GrowthIntentPixelConsentStatus,
    first_touch_utm: mapUtm(row.first_touch_utm),
    last_touch_utm: mapUtm(row.last_touch_utm),
    first_referrer: asString(row.first_referrer) || null,
    last_referrer: asString(row.last_referrer) || null,
    first_landing_url: asString(row.first_landing_url) || null,
    last_page_url: asString(row.last_page_url) || null,
    device_metadata: normalizeDeviceMetadata(
      row.device_metadata as Record<string, unknown> | undefined,
    ),
    browser_metadata: normalizeBrowserMetadata(
      row.browser_metadata as Record<string, unknown> | undefined,
    ),
    pageview_count: typeof row.pageview_count === "number" ? row.pageview_count : 0,
    total_time_on_site_ms:
      typeof row.total_time_on_site_ms === "number" ? Number(row.total_time_on_site_ms) : 0,
    started_at: asString(row.started_at),
    last_activity_at: asString(row.last_activity_at),
    ended_at: asString(row.ended_at) || null,
  }
}

export function generateVisitorKey(): string {
  return `v_${randomUUID()}`
}

export function generateSessionKey(): string {
  return `s_${randomUUID()}`
}

export function pageHostname(pageUrl: string): string | null {
  try {
    return new URL(pageUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isDomainAllowed(site: GrowthIntentPixelSite, pageUrl: string): boolean {
  if (site.domain_allowlist.length === 0) return true
  const host = pageHostname(pageUrl)
  if (!host) return false
  return site.domain_allowlist.some((allowed) => {
    const normalized = allowed.trim().toLowerCase()
    return host === normalized || host.endsWith(`.${normalized}`)
  })
}

export async function fetchIntentPixelSite(
  admin: SupabaseClient,
  siteKey: string,
): Promise<GrowthIntentPixelSite | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("intent_pixel_sites")
    .select("id, site_key, site_name, domain_allowlist, tracking_enabled, consent_required")
    .eq("site_key", siteKey)
    .maybeSingle()

  if (error || !data) return null
  return mapSite(data as Record<string, unknown>)
}

export async function upsertVisitorSession(
  admin: SupabaseClient,
  site: GrowthIntentPixelSite,
  payload: GrowthIntentPixelCollectPayload,
  consentStatus: GrowthIntentPixelConsentStatus,
): Promise<GrowthIntentPixelVisitorSession> {
  const visitorKey = asString(payload.visitor_key) || generateVisitorKey()
  const sessionKey = asString(payload.session_key) || generateSessionKey()
  const pageUrl = asString(payload.page_url)
  const utm = mergeUtmAttribution(payload.utm, pageUrl)
  const referrer = asString(payload.referrer)
  const device = normalizeDeviceMetadata(payload.device)
  const browser = normalizeBrowserMetadata(payload.browser, {
    page_url: pageUrl,
    referrer,
  })

  const { data: existing } = await admin
    .schema("growth")
    .from("intent_visitor_sessions")
    .select("*")
    .eq("site_id", site.id)
    .eq("session_key", sessionKey)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existing) {
    const row = existing as Record<string, unknown>
    const firstTouch = mapUtm(row.first_touch_utm)
    const patch = {
      consent_status: consentStatus,
      last_touch_utm: utm,
      last_referrer: referrer || asString(row.last_referrer) || null,
      last_page_url: pageUrl || asString(row.last_page_url) || null,
      device_metadata: device,
      browser_metadata: browser,
      last_activity_at: now,
    }

    const { data: updated, error } = await admin
      .schema("growth")
      .from("intent_visitor_sessions")
      .update(patch)
      .eq("id", asString(row.id))
      .select("*")
      .single()

    if (error || !updated) throw new Error(error?.message ?? "Could not update visitor session.")
    return mapSession(updated as Record<string, unknown>)
  }

  const insertRow = {
    site_id: site.id,
    visitor_key: visitorKey,
    session_key: sessionKey,
    consent_status: consentStatus,
    first_touch_utm: utm,
    last_touch_utm: utm,
    first_referrer: referrer || null,
    last_referrer: referrer || null,
    first_landing_url: pageUrl || browser.landing_url || null,
    last_page_url: pageUrl || null,
    device_metadata: device,
    browser_metadata: browser,
    pageview_count: 0,
    total_time_on_site_ms: 0,
    started_at: now,
    last_activity_at: now,
  }

  const { data: created, error } = await admin
    .schema("growth")
    .from("intent_visitor_sessions")
    .insert(insertRow)
    .select("*")
    .single()

  if (error || !created) throw new Error(error?.message ?? "Could not create visitor session.")
  return mapSession(created as Record<string, unknown>)
}

export async function recordPageview(
  admin: SupabaseClient,
  site: GrowthIntentPixelSite,
  session: GrowthIntentPixelVisitorSession,
  payload: GrowthIntentPixelCollectPayload,
): Promise<GrowthIntentPixelPageviewEvent> {
  const pageUrl = asString(payload.page_url) || session.last_page_url || ""
  const utm = mergeUtmAttribution(payload.utm, pageUrl)
  const durationMs =
    typeof payload.duration_ms === "number" && payload.duration_ms >= 0
      ? Math.round(payload.duration_ms)
      : 0

  const { data, error } = await admin
    .schema("growth")
    .from("intent_pageview_events")
    .insert({
      site_id: site.id,
      session_id: session.id,
      page_url: pageUrl,
      page_path: asString(payload.page_path) || extractPagePath(pageUrl),
      page_title: asString(payload.page_title).slice(0, 512),
      referrer: asString(payload.referrer) || null,
      utm,
      duration_ms: durationMs,
    })
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Could not record pageview.")

  const timeIncrement = durationMs
  await admin
    .schema("growth")
    .from("intent_visitor_sessions")
    .update({
      pageview_count: session.pageview_count + 1,
      total_time_on_site_ms: session.total_time_on_site_ms + timeIncrement,
      last_touch_utm: utm,
      last_page_url: pageUrl,
      last_referrer: asString(payload.referrer) || session.last_referrer,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", session.id)

  const row = data as Record<string, unknown>
  return {
    id: asString(row.id),
    session_id: asString(row.session_id),
    page_url: asString(row.page_url),
    page_path: asString(row.page_path),
    page_title: asString(row.page_title),
    referrer: asString(row.referrer) || null,
    utm: mapUtm(row.utm),
    duration_ms: typeof row.duration_ms === "number" ? row.duration_ms : 0,
    captured_at: asString(row.captured_at),
  }
}

export async function closeLastPageviewDuration(
  admin: SupabaseClient,
  sessionId: string,
  durationMs: number,
): Promise<void> {
  const { data: last } = await admin
    .schema("growth")
    .from("intent_pageview_events")
    .select("id, duration_ms")
    .eq("session_id", sessionId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!last) return
  const row = last as Record<string, unknown>
  const nextDuration = Math.max(
    typeof row.duration_ms === "number" ? row.duration_ms : 0,
    durationMs,
  )

  await admin
    .schema("growth")
    .from("intent_pageview_events")
    .update({ duration_ms: nextDuration })
    .eq("id", asString(row.id))
}

export async function recordConversion(
  admin: SupabaseClient,
  site: GrowthIntentPixelSite,
  session: GrowthIntentPixelVisitorSession,
  payload: GrowthIntentPixelCollectPayload,
): Promise<GrowthIntentPixelConversionEvent> {
  const { data, error } = await admin
    .schema("growth")
    .from("intent_conversion_events")
    .insert({
      site_id: site.id,
      session_id: session.id,
      conversion_type: asString(payload.conversion_type) || "custom",
      conversion_label: asString(payload.conversion_label).slice(0, 256),
      page_url: asString(payload.page_url).slice(0, 2048),
      metadata: payload.conversion_metadata ?? {},
    })
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Could not record conversion.")
  const row = data as Record<string, unknown>
  return {
    id: asString(row.id),
    session_id: asString(row.session_id),
    conversion_type: asString(row.conversion_type) as GrowthIntentPixelConversionEvent["conversion_type"],
    conversion_label: asString(row.conversion_label),
    page_url: asString(row.page_url),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
    captured_at: asString(row.captured_at),
  }
}

export async function attachIdentifiedContact(
  admin: SupabaseClient,
  site: GrowthIntentPixelSite,
  session: GrowthIntentPixelVisitorSession,
  captureSource: GrowthIntentPixelIdentifiedContact["capture_source"],
  identity: {
    email?: string | null
    phone?: string | null
    full_name?: string | null
    linkedin_url?: string | null
    company_name?: string | null
    submitted_fields?: Record<string, unknown>
  },
): Promise<GrowthIntentPixelIdentifiedContact> {
  const { data, error } = await admin
    .schema("growth")
    .from("intent_identified_contacts")
    .insert({
      site_id: site.id,
      session_id: session.id,
      capture_source: captureSource,
      email: identity.email ?? null,
      phone: identity.phone ?? null,
      full_name: identity.full_name ?? null,
      linkedin_url: identity.linkedin_url ?? null,
      company_name: identity.company_name ?? null,
      submitted_fields: identity.submitted_fields ?? {},
    })
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Could not attach identified contact.")

  await admin
    .schema("growth")
    .from("intent_visitor_sessions")
    .update({ is_identified: true, last_activity_at: new Date().toISOString() })
    .eq("id", session.id)

  const row = data as Record<string, unknown>
  return {
    id: asString(row.id),
    session_id: asString(row.session_id),
    capture_source: asString(row.capture_source) as GrowthIntentPixelIdentifiedContact["capture_source"],
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
    full_name: asString(row.full_name) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    company_name: asString(row.company_name) || null,
    captured_at: asString(row.captured_at),
  }
}

export async function fetchVisitHistory(
  admin: SupabaseClient,
  siteId: string,
  visitorKey: string,
  limit = 20,
): Promise<GrowthIntentPixelVisitHistory> {
  const { data: sessions } = await admin
    .schema("growth")
    .from("intent_visitor_sessions")
    .select("*")
    .eq("site_id", siteId)
    .eq("visitor_key", visitorKey)
    .order("started_at", { ascending: false })
    .limit(limit)

  const sessionRows = (sessions ?? []) as Record<string, unknown>[]
  const sessionIds = sessionRows.map((row) => asString(row.id)).filter(Boolean)

  let pageviews: Record<string, unknown>[] = []
  let conversions: Record<string, unknown>[] = []

  if (sessionIds.length > 0) {
    const { data: pv } = await admin
      .schema("growth")
      .from("intent_pageview_events")
      .select("*")
      .in("session_id", sessionIds)
      .order("captured_at", { ascending: true })
    pageviews = (pv ?? []) as Record<string, unknown>[]

    const { data: cv } = await admin
      .schema("growth")
      .from("intent_conversion_events")
      .select("*")
      .in("session_id", sessionIds)
      .order("captured_at", { ascending: true })
    conversions = (cv ?? []) as Record<string, unknown>[]
  }

  const pageviewsBySession = new Map<string, GrowthIntentPixelPageviewEvent[]>()
  for (const row of pageviews) {
    const sid = asString(row.session_id)
    const list = pageviewsBySession.get(sid) ?? []
    list.push({
      id: asString(row.id),
      session_id: sid,
      page_url: asString(row.page_url),
      page_path: asString(row.page_path),
      page_title: asString(row.page_title),
      referrer: asString(row.referrer) || null,
      utm: mapUtm(row.utm),
      duration_ms: typeof row.duration_ms === "number" ? row.duration_ms : 0,
      captured_at: asString(row.captured_at),
    })
    pageviewsBySession.set(sid, list)
  }

  const conversionsBySession = new Map<string, GrowthIntentPixelConversionEvent[]>()
  for (const row of conversions) {
    const sid = asString(row.session_id)
    const list = conversionsBySession.get(sid) ?? []
    list.push({
      id: asString(row.id),
      session_id: sid,
      conversion_type: asString(row.conversion_type) as GrowthIntentPixelConversionEvent["conversion_type"],
      conversion_label: asString(row.conversion_label),
      page_url: asString(row.page_url),
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
      captured_at: asString(row.captured_at),
    })
    conversionsBySession.set(sid, list)
  }

  const mappedSessions = sessionRows.map((row) => {
    const session = mapSession(row)
    return {
      session_key: session.session_key,
      started_at: session.started_at,
      last_activity_at: session.last_activity_at,
      pageview_count: session.pageview_count,
      total_time_on_site_ms: session.total_time_on_site_ms,
      is_identified: session.is_identified,
      consent_status: session.consent_status,
      first_touch_utm: session.first_touch_utm,
      last_touch_utm: session.last_touch_utm,
      pageviews: pageviewsBySession.get(session.id) ?? [],
      conversions: conversionsBySession.get(session.id) ?? [],
    }
  })

  const totalPageviews = mappedSessions.reduce((sum, s) => sum + s.pageviews.length, 0)
  const totalTime = mappedSessions.reduce((sum, s) => sum + s.total_time_on_site_ms, 0)
  const firstSeen = mappedSessions.at(-1)?.started_at ?? null
  const lastSeen = mappedSessions[0]?.last_activity_at ?? null

  return {
    visitor_key: visitorKey,
    session_count: mappedSessions.length,
    total_pageviews: totalPageviews,
    total_time_on_site_ms: totalTime,
    first_seen_at: firstSeen,
    last_seen_at: lastSeen,
    sessions: mappedSessions,
  }
}

export async function fetchIntentPixelDiagnostics(
  admin: SupabaseClient,
  siteKey: string | null,
): Promise<{
  schema_ready: boolean
  site_key: string | null
  session_count_24h: number
  pageview_count_24h: number
  conversion_count_24h: number
  identified_contact_count_24h: number
}> {
  const schema_ready = await isGrowthIntentPixelSchemaReady(admin)
  if (!schema_ready) {
    return {
      schema_ready: false,
      site_key: siteKey,
      session_count_24h: 0,
      pageview_count_24h: 0,
      conversion_count_24h: 0,
      identified_contact_count_24h: 0,
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let siteId: string | null = null

  if (siteKey) {
    const site = await fetchIntentPixelSite(admin, siteKey)
    siteId = site?.id ?? null
  }

  const sessionQuery = admin
    .schema("growth")
    .from("intent_visitor_sessions")
    .select("id", { count: "exact", head: true })
    .gte("started_at", since)
  if (siteId) sessionQuery.eq("site_id", siteId)

  const pageviewQuery = admin
    .schema("growth")
    .from("intent_pageview_events")
    .select("id", { count: "exact", head: true })
    .gte("captured_at", since)
  if (siteId) pageviewQuery.eq("site_id", siteId)

  const conversionQuery = admin
    .schema("growth")
    .from("intent_conversion_events")
    .select("id", { count: "exact", head: true })
    .gte("captured_at", since)
  if (siteId) conversionQuery.eq("site_id", siteId)

  const identifiedQuery = admin
    .schema("growth")
    .from("intent_identified_contacts")
    .select("id", { count: "exact", head: true })
    .gte("captured_at", since)
  if (siteId) identifiedQuery.eq("site_id", siteId)

  const [sessions, pageviews, conversions, identified] = await Promise.all([
    sessionQuery,
    pageviewQuery,
    conversionQuery,
    identifiedQuery,
  ])

  return {
    schema_ready: true,
    site_key: siteKey,
    session_count_24h: sessions.count ?? 0,
    pageview_count_24h: pageviews.count ?? 0,
    conversion_count_24h: conversions.count ?? 0,
    identified_contact_count_24h: identified.count ?? 0,
  }
}
