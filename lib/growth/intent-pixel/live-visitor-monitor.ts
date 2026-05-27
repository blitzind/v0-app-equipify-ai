import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { bridgeIntentSessionFromStore } from "@/lib/growth/lead-engine/intent/intent-to-lead-bridge"
import {
  allowsBehavioralTracking,
  allowsBuyingStageInference,
  allowsIntentScoring,
  allowsSearchIntentSignals,
  resolveTrackingMode,
} from "@/lib/growth/intent-pixel/consent-gate"
import { fetchIntentPixelAdminDiagnostics } from "@/lib/growth/intent-pixel/intent-pixel-admin-repository"
import {
  GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
  type GrowthHighIntentQueueItem,
  type GrowthIntentPixelInstallVerification,
  type GrowthLiveVisitorMonitorSnapshot,
  type GrowthLiveVisitorRow,
  type GrowthPixelHealthTone,
  type GrowthPixelVerificationStatus,
  type GrowthVisitorTimelineEntry,
} from "@/lib/growth/intent-pixel/live-visitor-monitor-types"
import {
  isDomainAllowed,
  pageHostname,
  fetchIntentPixelSite,
} from "@/lib/growth/intent-pixel/intent-pixel-repository"
import { isGrowthIntentPixelSchemaReady } from "@/lib/growth/intent-pixel/intent-pixel-schema-health"
import type { GrowthIntentPixelConsentStatus } from "@/lib/growth/intent-pixel/intent-pixel-types"
import { GROWTH_INTENT_PIXEL_PRIVACY_NOTE } from "@/lib/growth/intent-pixel/pii-policy"
import { mergeUtmAttribution } from "@/lib/growth/intent-pixel/utm-attribution"

const ACTIVE_MS = 30 * 60 * 1000
const RECENT_EVENT_MS = 15 * 60 * 1000
const DOMAIN_CHECK_MS = 60 * 60 * 1000

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
}

function formatActiveSince(lastActivity: string): string {
  const delta = Date.now() - new Date(lastActivity).getTime()
  if (delta < 60_000) return "Just now"
  return `${formatDuration(delta)} active`
}

function displayLabelFromSession(input: {
  is_identified: boolean
  company_name: string | null
  company_domain: string | null
  last_page_url: string | null
  first_landing_url: string | null
  visitor_key: string
}): string {
  if (input.is_identified && input.company_name) return input.company_name
  if (input.company_domain) return input.company_domain
  const url = input.last_page_url || input.first_landing_url
  const host = url ? pageHostname(url) : null
  if (host) return host
  return `Visitor ${input.visitor_key.slice(0, 8)}…`
}

function pathSignals(path: string): string[] {
  const p = path.toLowerCase()
  const badges: string[] = []
  if (p.includes("pricing")) badges.push("Pricing page")
  if (p.includes("demo")) badges.push("Demo page")
  if (p.includes("contact") || p.includes("book")) badges.push("Contact intent")
  if (p.includes("compare") || p.includes("vs")) badges.push("Vendor comparison")
  return badges
}

function buyingStageLabel(stage: string | null): string | null {
  if (!stage) return null
  return stage.replace(/_/g, " ")
}

function consentAllowsBehavioralIntelligence(
  site: Awaited<ReturnType<typeof fetchIntentPixelSite>>,
  consentStatus: GrowthIntentPixelConsentStatus,
): boolean {
  if (!site) return false
  const mode = resolveTrackingMode(site, consentStatus, "pageview").mode
  return allowsBehavioralTracking(consentStatus, mode)
}

export async function buildInstallVerification(
  admin: SupabaseClient,
  siteKey: string,
): Promise<GrowthIntentPixelInstallVerification> {
  const schema_ready = await isGrowthIntentPixelSchemaReady(admin)
  if (!schema_ready) {
    return {
      pixel_status: "schema_missing",
      health_tone: "problem",
      status_label: "Schema missing",
      schema_ready: false,
      tracking_enabled: false,
      pixel_script_configured: false,
      events_received_recently: false,
      allowed_domain_match: true,
      recent_event_count_15m: 0,
      domain_mismatch_count_1h: 0,
      consent_distribution: { unknown: 0, denied: 0, granted: 0, not_required: 0 },
      checks: [
        {
          id: "schema",
          label: "Schema ready",
          passed: false,
          tone: "problem",
          detail: "Apply intent pixel foundation migration.",
        },
      ],
    }
  }

  const site = await fetchIntentPixelSite(admin, siteKey)
  const diagnostics = await fetchIntentPixelAdminDiagnostics(admin, siteKey)
  const since15m = new Date(Date.now() - RECENT_EVENT_MS).toISOString()
  const since1h = new Date(Date.now() - DOMAIN_CHECK_MS).toISOString()

  let recent_event_count_15m = 0
  let domain_mismatch_count_1h = 0
  let allowed_domain_match = true

  if (site) {
    const { count: pv15 } = await admin
      .schema("growth")
      .from("intent_pageview_events")
      .select("id", { count: "exact", head: true })
      .eq("site_id", site.id)
      .gte("captured_at", since15m)
    recent_event_count_15m = pv15 ?? 0

    const { data: recentPv } = await admin
      .schema("growth")
      .from("intent_pageview_events")
      .select("page_url")
      .eq("site_id", site.id)
      .gte("captured_at", since1h)
      .limit(100)

    for (const row of recentPv ?? []) {
      const url = asString((row as { page_url: string }).page_url)
      if (!url) continue
      if (!isDomainAllowed(site, url)) {
        domain_mismatch_count_1h += 1
        allowed_domain_match = false
      }
    }
  }

  const consent_distribution = {
    unknown: diagnostics.consent_unknown_sessions_24h,
    denied: diagnostics.consent_denied_sessions_24h,
    granted: diagnostics.consent_granted_sessions_24h,
    not_required: 0,
  }

  const events_received_recently = recent_event_count_15m > 0
  const tracking_enabled = site?.tracking_enabled ?? false
  const pixel_script_configured = Boolean(site)

  const consentTotal =
    consent_distribution.granted +
    consent_distribution.denied +
    consent_distribution.unknown
  const consentBlockedRatio =
    consentTotal > 0
      ? (consent_distribution.denied + consent_distribution.unknown) / consentTotal
      : 0

  let pixel_status: GrowthPixelVerificationStatus = "healthy"
  let health_tone: GrowthPixelHealthTone = "healthy"

  if (!tracking_enabled) {
    pixel_status = "no_traffic"
    health_tone = "attention"
  } else if (!events_received_recently && diagnostics.install_status !== "receiving") {
    pixel_status = "no_traffic"
    health_tone = "attention"
  } else if (domain_mismatch_count_1h > 0) {
    pixel_status = "domain_mismatch"
    health_tone = "problem"
  } else if (site?.consent_required && consentBlockedRatio > 0.55 && consentTotal >= 3) {
    pixel_status = "consent_blocked"
    health_tone = "attention"
  }

  const status_label =
    pixel_status === "healthy"
      ? "Healthy"
      : pixel_status === "no_traffic"
        ? "No traffic"
        : pixel_status === "domain_mismatch"
          ? "Domain mismatch"
          : pixel_status === "consent_blocked"
            ? "Consent blocked"
            : "Schema missing"

  const checks = [
    {
      id: "schema",
      label: "Schema ready",
      passed: schema_ready,
      tone: schema_ready ? ("healthy" as const) : ("problem" as const),
      detail: schema_ready ? "Tables available." : "Migration not applied.",
    },
    {
      id: "script",
      label: "Pixel script configured",
      passed: pixel_script_configured,
      tone: pixel_script_configured ? "healthy" : "problem",
      detail: pixel_script_configured ? `Site ${siteKey} registered.` : "Create a pixel site.",
    },
    {
      id: "tracking",
      label: "Tracking enabled",
      passed: tracking_enabled,
      tone: tracking_enabled ? "healthy" : "attention",
      detail: tracking_enabled ? "Collect endpoint accepting events." : "Tracking disabled in site settings.",
    },
    {
      id: "events",
      label: "Events received recently",
      passed: events_received_recently,
      tone: events_received_recently ? "healthy" : "attention",
      detail: events_received_recently
        ? `${recent_event_count_15m} event(s) in last 15m.`
        : "No pageviews in last 15 minutes.",
    },
    {
      id: "domain",
      label: "Allowed domain match",
      passed: allowed_domain_match,
      tone: allowed_domain_match ? "healthy" : "problem",
      detail: allowed_domain_match
        ? "Recent page URLs match allowlist."
        : `${domain_mismatch_count_1h} URL(s) outside allowlist (1h).`,
    },
    {
      id: "consent",
      label: "Consent status distribution",
      passed: pixel_status !== "consent_blocked",
      tone: pixel_status === "consent_blocked" ? "attention" : "healthy",
      detail: `Granted ${consent_distribution.granted}, denied ${consent_distribution.denied}, unknown ${consent_distribution.unknown} (24h sessions).`,
    },
  ]

  return {
    pixel_status,
    health_tone,
    status_label,
    schema_ready,
    tracking_enabled,
    pixel_script_configured,
    events_received_recently,
    allowed_domain_match,
    recent_event_count_15m,
    domain_mismatch_count_1h,
    consent_distribution,
    checks,
  }
}

async function loadSessionOverlays(
  admin: SupabaseClient,
  sessionIds: string[],
  visitorKeys: string[],
  sessionKeyToId: Map<string, string>,
): Promise<{
  buyingBySession: Map<string, string>
  matchConfidenceBySession: Map<string, number>
  companyBySession: Map<string, string>
  searchIntentBySession: Map<string, string>
  returningVisitors: Set<string>
}> {
  const buyingBySession = new Map<string, string>()
  const matchConfidenceBySession = new Map<string, number>()
  const companyBySession = new Map<string, string>()
  const searchIntentBySession = new Map<string, string>()
  const returningVisitors = new Set<string>()

  if (sessionIds.length === 0) return { buyingBySession, matchConfidenceBySession, companyBySession, searchIntentBySession, returningVisitors }

  try {
    const { data: buying } = await admin
      .schema("growth")
      .from("buying_stage_assessments")
      .select("intent_session_id, detected_stage")
      .in("intent_session_id", sessionIds)
      .order("created_at", { ascending: false })
    for (const row of buying ?? []) {
      const sid = asString((row as Record<string, unknown>).intent_session_id)
      if (sid && !buyingBySession.has(sid)) {
        buyingBySession.set(sid, asString((row as Record<string, unknown>).detected_stage))
      }
    }
  } catch {
    /* optional */
  }

  try {
    const { data: matches } = await admin
      .schema("growth")
      .from("company_identification_matches")
      .select("intent_session_id, match_confidence, company_name, company_domain")
      .in("intent_session_id", sessionIds)
      .order("created_at", { ascending: false })
    for (const row of matches ?? []) {
      const r = row as Record<string, unknown>
      const sid = asString(r.intent_session_id)
      if (!sid || matchConfidenceBySession.has(sid)) continue
      matchConfidenceBySession.set(sid, typeof r.match_confidence === "number" ? r.match_confidence : 0)
      const name = asString(r.company_name) || asString(r.company_domain)
      if (name) companyBySession.set(sid, name)
    }
  } catch {
    /* optional */
  }

  const sessionKeys = [...sessionKeyToId.keys()].filter(Boolean)
  if (sessionKeys.length) {
    try {
      const { data: signals } = await admin
        .schema("growth")
        .from("search_intent_signals")
        .select("session_key, intent_category, intent_topic")
        .in("session_key", sessionKeys.slice(0, 50))
        .order("created_at", { ascending: false })
      for (const row of signals ?? []) {
        const r = row as Record<string, unknown>
        const sk = asString(r.session_key)
        const sid = sessionKeyToId.get(sk)
        if (!sid || searchIntentBySession.has(sid)) continue
        const cat = asString(r.intent_category).replace(/_/g, " ")
        searchIntentBySession.set(sid, cat || asString(r.intent_topic))
      }
    } catch {
      /* optional */
    }
  }

  if (visitorKeys.length) {
    try {
      const { data: prior } = await admin
        .schema("growth")
        .from("intent_visitor_sessions")
        .select("visitor_key")
        .in("visitor_key", visitorKeys)
      const counts = new Map<string, number>()
      for (const row of prior ?? []) {
        const vk = asString((row as Record<string, unknown>).visitor_key)
        counts.set(vk, (counts.get(vk) ?? 0) + 1)
      }
      for (const [vk, n] of counts) {
        if (n > 1) returningVisitors.add(vk)
      }
    } catch {
      /* optional */
    }
  }

  return { buyingBySession, matchConfidenceBySession, companyBySession, searchIntentBySession, returningVisitors }
}

export async function fetchLiveVisitorMonitorSnapshot(
  admin: SupabaseClient,
  siteKey: string,
): Promise<GrowthLiveVisitorMonitorSnapshot> {
  const generated_at = new Date().toISOString()
  const install_verification = await buildInstallVerification(admin, siteKey)
  const empty: GrowthLiveVisitorMonitorSnapshot = {
    qa_marker: GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
    site_key: siteKey,
    generated_at,
    install_verification,
    live_visitors: [],
    visitor_timeline: [],
    high_intent_queue: [],
    privacy_note: GROWTH_INTENT_PIXEL_PRIVACY_NOTE,
  }

  if (!install_verification.schema_ready) return empty

  const site = await fetchIntentPixelSite(admin, siteKey)
  if (!site) return empty

  const activeSince = new Date(Date.now() - ACTIVE_MS).toISOString()
  const timelineSince = new Date(Date.now() - 2 * ACTIVE_MS).toISOString()

  const { data: sessions } = await admin
    .schema("growth")
    .from("intent_visitor_sessions")
    .select("*")
    .eq("site_id", site.id)
    .gte("last_activity_at", activeSince)
    .order("last_activity_at", { ascending: false })
    .limit(40)

  const sessionRows = (sessions ?? []) as Record<string, unknown>[]
  const sessionIds = sessionRows.map((r) => asString(r.id)).filter(Boolean)
  const visitorKeys = sessionRows.map((r) => asString(r.visitor_key)).filter(Boolean)

  const sessionKeyToId = new Map<string, string>()
  for (const row of sessionRows) {
    sessionKeyToId.set(asString(row.session_key), asString(row.id))
  }
  const overlays = await loadSessionOverlays(admin, sessionIds, visitorKeys, sessionKeyToId)

  let identifiedCompany = new Map<string, string>()
  if (sessionIds.length) {
    try {
      const { data: contacts } = await admin
        .schema("growth")
        .from("intent_identified_contacts")
        .select("session_id, company_name")
        .in("session_id", sessionIds)
      for (const row of contacts ?? []) {
        const r = row as Record<string, unknown>
        const sid = asString(r.session_id)
        const cn = asString(r.company_name)
        if (sid && cn) identifiedCompany.set(sid, cn)
      }
    } catch {
      /* optional */
    }
  }

  const live_visitors: GrowthLiveVisitorRow[] = sessionRows.map((row) => {
    const id = asString(row.id)
    const visitor_key = asString(row.visitor_key)
    const is_identified = row.is_identified === true
    const started = asString(row.started_at)
    const last_activity = asString(row.last_activity_at)
    const durationMs = Math.max(
      0,
      new Date(last_activity).getTime() - new Date(started).getTime(),
    )
    const lastPage = asString(row.last_page_url)
    const path = lastPage ? (() => { try { return new URL(lastPage).pathname } catch { return lastPage } })() : "—"
    const utm = mergeUtmAttribution(
      row.last_touch_utm && typeof row.last_touch_utm === "object"
        ? (row.last_touch_utm as Record<string, string>)
        : {},
    )
    const buying = overlays.buyingBySession.get(id) ?? null
    const matchConf = overlays.matchConfidenceBySession.get(id) ?? null
    const consent_status = asString(row.consent_status) as GrowthLiveVisitorRow["consent_status"]
    const behavioralAllowed = consentAllowsBehavioralIntelligence(site, consent_status)
    const pricingViewed = behavioralAllowed && path.toLowerCase().includes("pricing")
    const high_intent =
      behavioralAllowed &&
      ((buying === "purchase_ready" || buying === "active_opportunity") ||
        pricingViewed ||
        (typeof row.pageview_count === "number" && row.pageview_count >= 4))

    return {
      session_id: id,
      visitor_key,
      display_label: displayLabelFromSession({
        is_identified,
        company_name: identifiedCompany.get(id) ?? overlays.companyBySession.get(id) ?? null,
        company_domain: overlays.companyBySession.get(id) ?? null,
        last_page_url: lastPage || null,
        first_landing_url: asString(row.first_landing_url) || null,
        visitor_key,
      }),
      visitor_type: is_identified ? "identified" : "anonymous",
      session_duration_ms: durationMs,
      session_duration_label: formatDuration(durationMs),
      page_count: typeof row.pageview_count === "number" ? row.pageview_count : 0,
      current_page: path,
      referrer: asString(row.last_referrer) || null,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      search_intent_detected: allowsSearchIntentSignals(consent_status)
        ? overlays.searchIntentBySession.get(id) ?? null
        : null,
      company_match_confidence: matchConf,
      buying_stage_candidate: allowsBuyingStageInference(consent_status)
        ? buyingStageLabel(buying)
        : null,
      consent_status,
      high_intent,
      returning_session: overlays.returningVisitors.has(visitor_key),
      last_activity_at: last_activity,
    }
  })

  const { data: pageviews } = await admin
    .schema("growth")
    .from("intent_pageview_events")
    .select("id, session_id, page_path, page_title, page_url, captured_at")
    .eq("site_id", site.id)
    .gte("captured_at", timelineSince)
    .order("captured_at", { ascending: false })
    .limit(50)

  const sessionById = new Map(sessionRows.map((r) => [asString(r.id), r]))

  const visitor_timeline: GrowthVisitorTimelineEntry[] = []
  for (const row of pageviews ?? []) {
    const r = row as Record<string, unknown>
    const sessionId = asString(r.session_id)
    const session = sessionById.get(sessionId)
    if (!session) continue
    const is_identified = session.is_identified === true
    const visitor_key = asString(session.visitor_key)
    const path = asString(r.page_path) || asString(r.page_url)
    const badges = pathSignals(path)
    const buying = overlays.buyingBySession.get(sessionId) ?? null
    const consent_status = asString(session.consent_status) as GrowthIntentPixelConsentStatus
    const timeline_badges = [...badges]
    if (overlays.returningVisitors.has(visitor_key)) timeline_badges.push("Returning session")
    if (allowsBuyingStageInference(consent_status)) {
      if (buying === "vendor_evaluation" || buying === "comparison") {
        timeline_badges.push("Vendor comparison")
      }
      if (buying === "purchase_ready") timeline_badges.push("Purchase-ready candidate")
    }
    if (!is_identified) timeline_badges.push("Anonymous visitor")

    visitor_timeline.push({
      id: asString(r.id),
      session_id: sessionId,
      captured_at: asString(r.captured_at),
      display_label: displayLabelFromSession({
        is_identified,
        company_name: identifiedCompany.get(sessionId) ?? overlays.companyBySession.get(sessionId) ?? null,
        company_domain: overlays.companyBySession.get(sessionId) ?? null,
        last_page_url: asString(session.last_page_url) || null,
        first_landing_url: asString(session.first_landing_url) || null,
        visitor_key,
      }),
      active_duration_label: formatActiveSince(asString(session.last_activity_at)),
      page_path: path,
      page_title: asString(r.page_title) || path,
      kind: "pageview",
      visitor_type: is_identified ? "identified" : "anonymous",
      search_intent_label: allowsSearchIntentSignals(consent_status)
        ? overlays.searchIntentBySession.get(sessionId) ?? null
        : null,
      buying_stage_candidate: allowsBuyingStageInference(consent_status)
        ? buyingStageLabel(buying)
        : null,
      timeline_badges: [...new Set(timeline_badges)],
    })
  }

  const heuristicCandidates = live_visitors
    .filter((v) => v.high_intent || v.returning_session || v.page_count >= 3)
    .slice(0, 8)

  const high_intent_queue: GrowthHighIntentQueueItem[] = []

  for (const visitor of heuristicCandidates) {
    let intent_score = 0
    let intent_grade = "F"
    let lead_engine_eligible = false
    let bridgeSignals: string[] = []

    if (allowsIntentScoring(visitor.consent_status)) {
      try {
        const bridge = await bridgeIntentSessionFromStore(admin, siteKey, visitor.session_id)
        const candidate = bridge.lead_candidate
        if (candidate) {
          intent_score = candidate.intent_score
          intent_grade = candidate.intent_grade
          lead_engine_eligible = candidate.lead_engine_eligible
          bridgeSignals = candidate.candidate_reasoning.slice(0, 3)
        }
      } catch {
        /* bridge optional */
      }
    }

    const pricing_viewed =
      allowsBehavioralTracking(
        visitor.consent_status,
        resolveTrackingMode(site, visitor.consent_status, "pageview").mode,
      ) && visitor.current_page.toLowerCase().includes("pricing")

    high_intent_queue.push({
      session_id: visitor.session_id,
      visitor_key: visitor.visitor_key,
      display_label: visitor.display_label,
      visitor_type: visitor.visitor_type,
      intent_score,
      intent_grade,
      buying_stage_candidate: visitor.buying_stage_candidate,
      high_intent: visitor.high_intent || intent_score >= 12,
      returning_account: visitor.returning_session,
      pricing_viewed,
      signals: [
        ...bridgeSignals,
        ...(pricing_viewed ? ["Pricing viewed"] : []),
        ...(visitor.returning_session ? ["Returning account"] : []),
      ].slice(0, 4),
      lead_engine_eligible,
      last_activity_at: visitor.last_activity_at,
    })
  }

  high_intent_queue.sort((a, b) => b.intent_score - a.intent_score)

  return {
    qa_marker: GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
    site_key: siteKey,
    generated_at,
    install_verification,
    live_visitors,
    visitor_timeline,
    high_intent_queue,
    privacy_note: GROWTH_INTENT_PIXEL_PRIVACY_NOTE,
  }
}
