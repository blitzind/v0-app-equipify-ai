import type {
  GrowthIntentPixelConversionEvent,
  GrowthIntentPixelIdentifiedContact,
  GrowthIntentPixelPageviewEvent,
  GrowthIntentPixelVisitorSession,
  GrowthIntentPixelVisitHistory,
} from "@/lib/growth/intent-pixel/intent-pixel-types"
import { pageHostname } from "@/lib/growth/intent-pixel/intent-pixel-repository"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type GrowthIntentAggregatedSession = {
  site_key: string
  primary_session: GrowthIntentPixelVisitorSession
  visit_history: GrowthIntentPixelVisitHistory
  identified_contacts: GrowthIntentPixelIdentifiedContact[]
  all_pageviews: GrowthIntentPixelPageviewEvent[]
  all_conversions: GrowthIntentPixelConversionEvent[]
  unique_page_count: number
  total_time_on_site_ms: number
  domain: string | null
  high_intent_path_hits: string[]
}

function uniquePagePaths(pageviews: GrowthIntentPixelPageviewEvent[]): number {
  const paths = new Set<string>()
  for (const pv of pageviews) {
    const path = (pv.page_path || pv.page_url).split("?")[0]?.toLowerCase() ?? ""
    if (path) paths.add(path)
  }
  return paths.size
}

function collectHighIntentPathHits(pageviews: GrowthIntentPixelPageviewEvent[]): string[] {
  const hits = new Set<string>()
  const segments = ["/pricing", "/demo", "/book", "/contact", "/product", "/service"]
  for (const pv of pageviews) {
    const path = (pv.page_path || pv.page_url).toLowerCase()
    for (const segment of segments) {
      if (path.includes(segment)) hits.add(segment)
    }
  }
  return [...hits]
}

function resolveDomain(
  session: GrowthIntentPixelVisitorSession,
  pageviews: GrowthIntentPixelPageviewEvent[],
): string | null {
  for (const url of [session.last_page_url, session.first_landing_url, ...pageviews.map((p) => p.page_url)]) {
    if (!url) continue
    const host = pageHostname(url)
    if (host && !host.includes("localhost") && host !== "127.0.0.1") return host
  }
  return null
}

export function aggregateIntentSession(input: {
  site_key: string
  session: GrowthIntentPixelVisitorSession
  visit_history: GrowthIntentPixelVisitHistory
  identified_contacts?: GrowthIntentPixelIdentifiedContact[]
}): GrowthIntentAggregatedSession {
  const historySessions = input.visit_history.sessions
  const primaryHistory =
    historySessions.find((s) => s.session_key === input.session.session_key) ?? historySessions[0]

  const all_pageviews: GrowthIntentPixelPageviewEvent[] = []
  const all_conversions: GrowthIntentPixelConversionEvent[] = []

  for (const s of historySessions) {
    all_pageviews.push(...s.pageviews)
    all_conversions.push(...s.conversions)
  }

  if (primaryHistory && all_pageviews.length === 0) {
    all_pageviews.push(...primaryHistory.pageviews)
    all_conversions.push(...primaryHistory.conversions)
  }

  const identified_contacts = input.identified_contacts ?? []

  return {
    site_key: input.site_key,
    primary_session: input.session,
    visit_history: input.visit_history,
    identified_contacts,
    all_pageviews,
    all_conversions,
    unique_page_count: uniquePagePaths(all_pageviews),
    total_time_on_site_ms: input.visit_history.total_time_on_site_ms || input.session.total_time_on_site_ms,
    domain: resolveDomain(input.session, all_pageviews),
    high_intent_path_hits: collectHighIntentPathHits(all_pageviews),
  }
}

export function extractIdentityFromContacts(
  contacts: GrowthIntentPixelIdentifiedContact[],
): {
  email: string | null
  phone: string | null
  full_name: string | null
  company_name: string | null
  capture_source: string | null
  identity_rejected: boolean
} {
  const latest = contacts.at(-1)
  if (!latest) {
    return {
      email: null,
      phone: null,
      full_name: null,
      company_name: null,
      capture_source: null,
      identity_rejected: false,
    }
  }

  return {
    email: latest.email,
    phone: latest.phone,
    full_name: latest.full_name,
    company_name: latest.company_name,
    capture_source: latest.capture_source,
    identity_rejected: false,
  }
}

/** Build visit history from a single session when full history unavailable. */
export function singleSessionVisitHistory(
  session: GrowthIntentPixelVisitorSession,
  pageviews: GrowthIntentPixelPageviewEvent[] = [],
  conversions: GrowthIntentPixelConversionEvent[] = [],
): GrowthIntentPixelVisitHistory {
  return {
    visitor_key: session.visitor_key,
    session_count: 1,
    total_pageviews: pageviews.length || session.pageview_count,
    total_time_on_site_ms: session.total_time_on_site_ms,
    first_seen_at: session.started_at,
    last_seen_at: session.last_activity_at,
    sessions: [
      {
        session_key: session.session_key,
        started_at: session.started_at,
        last_activity_at: session.last_activity_at,
        pageview_count: session.pageview_count,
        total_time_on_site_ms: session.total_time_on_site_ms,
        is_identified: session.is_identified,
        consent_status: session.consent_status,
        first_touch_utm: session.first_touch_utm,
        last_touch_utm: session.last_touch_utm,
        pageviews,
        conversions,
      },
    ],
  }
}
