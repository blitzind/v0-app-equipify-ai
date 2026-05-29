/** Browser extension operator analytics — client-safe. */

export const GROWTH_BROWSER_EXTENSION_ANALYTICS_QA_MARKER =
  "growth-browser-extension-analytics-v1" as const

export const GROWTH_BROWSER_EXTENSION_ANALYTICS_EVENT_TYPES = [
  "captures_created",
  "companies_captured",
  "contacts_captured",
  "duplicates_prevented",
  "research_briefs_generated",
  "call_preps_generated",
  "queue_saves",
] as const

export type GrowthBrowserExtensionAnalyticsEventType =
  (typeof GROWTH_BROWSER_EXTENSION_ANALYTICS_EVENT_TYPES)[number]

export type GrowthBrowserExtensionAnalyticsEvent = {
  type: GrowthBrowserExtensionAnalyticsEventType
  at: string
}

export type GrowthBrowserExtensionAnalyticsPeriod = "today" | "week" | "month"

export type GrowthBrowserExtensionAnalyticsCounts = Record<
  GrowthBrowserExtensionAnalyticsEventType,
  number
>

export type GrowthBrowserExtensionAnalyticsSummary = {
  period: GrowthBrowserExtensionAnalyticsPeriod
  counts: GrowthBrowserExtensionAnalyticsCounts
  total_events: number
}

function emptyCounts(): GrowthBrowserExtensionAnalyticsCounts {
  return {
    captures_created: 0,
    companies_captured: 0,
    contacts_captured: 0,
    duplicates_prevented: 0,
    research_briefs_generated: 0,
    call_preps_generated: 0,
    queue_saves: 0,
  }
}

function periodStart(period: GrowthBrowserExtensionAnalyticsPeriod, now = new Date()): Date {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === "today") return start
  if (period === "week") {
    start.setDate(start.getDate() - 6)
    return start
  }
  start.setDate(start.getDate() - 29)
  return start
}

export function aggregateBrowserExtensionAnalytics(
  events: GrowthBrowserExtensionAnalyticsEvent[],
  period: GrowthBrowserExtensionAnalyticsPeriod,
  now = new Date(),
): GrowthBrowserExtensionAnalyticsSummary {
  const startMs = periodStart(period, now).getTime()
  const counts = emptyCounts()
  let total = 0

  for (const event of events) {
    const atMs = Date.parse(event.at)
    if (Number.isNaN(atMs) || atMs < startMs) continue
    if (!(event.type in counts)) continue
    counts[event.type] += 1
    total += 1
  }

  return { period, counts, total_events: total }
}

export function trimBrowserExtensionAnalyticsEvents(
  events: GrowthBrowserExtensionAnalyticsEvent[],
  max = 500,
): GrowthBrowserExtensionAnalyticsEvent[] {
  return events.slice(-max)
}
