import { z } from "zod"
import type {
  GrowthEngagementDashboardCtaPerformance,
  GrowthEngagementDashboardDateRangePreset,
  GrowthEngagementDashboardFilters,
  GrowthEngagementDashboardMediaPerformanceRow,
  GrowthEngagementDashboardMediaResponse,
  GrowthEngagementDashboardOverviewMetrics,
  GrowthEngagementDashboardResolvedDateRange,
  SharePageEngagementSnapshot,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import { GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE } from "@/lib/growth/engagement/growth-engagement-dashboard-types"

const DATE_RANGE_SCHEMA = z.enum(["last_7_days", "last_30_days", "last_90_days", "custom"])

export function resolveEngagementDashboardDateRange(
  input: Pick<GrowthEngagementDashboardFilters, "dateRange" | "startDate" | "endDate">,
  now: Date = new Date(),
): GrowthEngagementDashboardResolvedDateRange {
  const end = input.endDate ? new Date(input.endDate) : now
  const endIso = Number.isNaN(end.getTime()) ? now.toISOString() : end.toISOString()

  if (input.dateRange === "custom" && input.startDate) {
    const start = new Date(input.startDate)
    const startIso = Number.isNaN(start.getTime())
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : start.toISOString()
    return { preset: "custom", startIso, endIso }
  }

  const days =
    input.dateRange === "last_7_days" ? 7 : input.dateRange === "last_90_days" ? 90 : 30
  const startIso = new Date(end.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
  return { preset: input.dateRange, startIso, endIso }
}

export function parseEngagementDashboardFilters(
  organizationId: string,
  searchParams: URLSearchParams,
): GrowthEngagementDashboardFilters {
  const dateRangeRaw = searchParams.get("dateRange") ?? GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE
  const parsedDateRange = DATE_RANGE_SCHEMA.safeParse(dateRangeRaw)
  const dateRange: GrowthEngagementDashboardDateRangePreset = parsedDateRange.success
    ? parsedDateRange.data
    : GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE

  return {
    organizationId,
    dateRange,
    startDate: searchParams.get("startDate"),
    endDate: searchParams.get("endDate"),
    templateId: searchParams.get("templateId"),
    mediaAssetId: searchParams.get("mediaAssetId") ?? searchParams.get("assetId"),
    leadId: searchParams.get("leadId"),
  }
}

export function computeMediaCompletionRate(playStarts: number, completions: number): number {
  if (playStarts <= 0) return 0
  return Math.min(1, Math.max(0, completions / playStarts))
}

export function aggregateMediaTotalsFromRollups(
  rows: GrowthEngagementDashboardMediaPerformanceRow[],
): GrowthEngagementDashboardMediaResponse["totals"] {
  const totals = rows.reduce(
    (acc, row) => {
      acc.views += row.views
      acc.uniqueViews += row.uniqueViews
      acc.playStarts += row.playStarts
      acc.completions += row.completions
      acc.ctaClicks += row.ctaClicks
      acc.watchSecondsSum += row.averageWatchSeconds * Math.max(row.playStarts, 1)
      acc.watchWeight += Math.max(row.playStarts, 1)
      return acc
    },
    {
      views: 0,
      uniqueViews: 0,
      playStarts: 0,
      completions: 0,
      ctaClicks: 0,
      watchSecondsSum: 0,
      watchWeight: 0,
    },
  )

  return {
    views: totals.views,
    uniqueViews: totals.uniqueViews,
    playStarts: totals.playStarts,
    completions: totals.completions,
    ctaClicks: totals.ctaClicks,
    averageWatchSeconds: totals.watchWeight > 0 ? totals.watchSecondsSum / totals.watchWeight : 0,
    completionRate: computeMediaCompletionRate(totals.playStarts, totals.completions),
  }
}

export function aggregateOverviewFromSamples(input: {
  sharePage: SharePageEngagementSnapshot | null
  mediaRows: GrowthEngagementDashboardMediaPerformanceRow[]
}): GrowthEngagementDashboardOverviewMetrics {
  const mediaTotals = aggregateMediaTotalsFromRollups(input.mediaRows)

  return {
    totalSharePageViews: input.sharePage?.totalSharePageViews ?? 0,
    uniqueSharePageVisitors: input.sharePage?.uniqueSharePageVisitors ?? 0,
    ctaClicks: input.sharePage?.ctaClicks ?? 0,
    bookingStarts: input.sharePage?.bookingStarts ?? 0,
    bookingCompletions: input.sharePage?.bookingCompletions ?? 0,
    mediaViews: mediaTotals.views,
    mediaPlayStarts: mediaTotals.playStarts,
    mediaCompletions: mediaTotals.completions,
    mediaCtaClicks: mediaTotals.ctaClicks,
    averageWatchSeconds: mediaTotals.averageWatchSeconds,
    completionRate: mediaTotals.completionRate,
    templateUsageCount: input.sharePage?.templateUsageCount ?? 0,
  }
}

export function buildCtaPerformance(input: {
  sharePageCtaClicks: number
  mediaRows: GrowthEngagementDashboardMediaPerformanceRow[]
}): GrowthEngagementDashboardCtaPerformance {
  const mediaCtaClicks = input.mediaRows.reduce((sum, row) => sum + row.ctaClicks, 0)
  const topCtaKeys = input.mediaRows
    .filter((row) => row.ctaClicks > 0)
    .slice(0, 5)
    .map((row) => ({ key: row.assetLabel, count: row.ctaClicks }))

  return {
    sharePageCtaClicks: input.sharePageCtaClicks,
    mediaCtaClicks,
    totalCtaClicks: input.sharePageCtaClicks + mediaCtaClicks,
    topCtaKeys,
  }
}

export function rollupRowsFromSampleEvents(
  events: Array<{
    assetId: string
    views: number
    uniqueViews: number
    playStarts: number
    completions: number
    ctaClicks: number
    averageWatchSeconds: number
    completionRate: number
    lastEventAt: string | null
  }>,
  labels: Record<string, string>,
): GrowthEngagementDashboardMediaPerformanceRow[] {
  return events.map((event) => ({
    assetId: event.assetId,
    assetLabel: labels[event.assetId] ?? event.assetId,
    views: event.views,
    uniqueViews: event.uniqueViews,
    playStarts: event.playStarts,
    completions: event.completions,
    ctaClicks: event.ctaClicks,
    averageWatchSeconds: event.averageWatchSeconds,
    completionRate: event.completionRate,
    lastEventAt: event.lastEventAt,
  }))
}
