import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import { buildSendrLaunchAttentionRecommendation } from "@/lib/growth/sendr/growth-sendr-analytics-attention"
import { loadSendrPageEngagementSummaryInRange } from "@/lib/growth/sendr/growth-sendr-analytics-read-repository"
import { getGrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import { listRecentSendrLaunchRuns } from "@/lib/growth/sendr/growth-sendr-launch-run-repository"
import type {
  GrowthSendrAnalyticsDateRange,
  GrowthSendrAnalyticsLaunchRow,
  GrowthSendrLaunchRun,
} from "@/lib/growth/sendr/growth-sendr-types"

async function resolveAudienceName(
  admin: SupabaseClient,
  audienceId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("growth_audiences")
    .select("name")
    .eq("id", audienceId)
    .maybeSingle()
  if (error || !data) return null
  return String((data as { name: string }).name)
}

async function resolveSequenceName(
  admin: SupabaseClient,
  sequencePatternId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("growth_sequence_patterns")
    .select("name")
    .eq("id", sequencePatternId)
    .maybeSingle()
  if (error || !data) return null
  return String((data as { name: string }).name)
}

async function mapLaunchRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    run: GrowthSendrLaunchRun
    dateRange: GrowthSendrAnalyticsDateRange
  },
): Promise<GrowthSendrAnalyticsLaunchRow> {
  const page = await getGrowthSendrLandingPage(admin, input.run.landingPageId)
  const engagement = await loadSendrPageEngagementSummaryInRange(admin, {
    organizationId: input.organizationId,
    landingPageId: input.run.landingPageId,
    dateRange: input.dateRange,
  })
  const [audienceName, sequenceName] = await Promise.all([
    resolveAudienceName(admin, input.run.audienceId),
    resolveSequenceName(admin, input.run.sequencePatternId),
  ])

  return {
    launchRunId: input.run.id,
    audienceName,
    sequenceName,
    sendrPageTitle: page?.title ?? null,
    sendrPageId: input.run.landingPageId,
    enrolled: input.run.enrolledCount,
    views: engagement.views,
    ctaClicks: engagement.ctaClicks,
    bookings: engagement.bookingsCompleted,
    status: input.run.status,
    startedAt: input.run.startedAt,
  }
}

export async function getSendrAnalyticsLaunches(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    page?: number
    pageSize?: number
    attentionOnly?: boolean
  },
): Promise<{
  items: GrowthSendrAnalyticsLaunchRow[]
  total: number
  page: number
  pageSize: number
}> {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100)

  const runs = await listRecentSendrLaunchRuns(admin, {
    organizationId: input.organizationId,
    limit: 50,
  })

  const inRange = runs.filter((run) => {
    const started = new Date(run.startedAt).getTime()
    return (
      started >= new Date(input.dateRange.startAt).getTime() &&
      started <= new Date(input.dateRange.endAt).getTime()
    )
  })

  const rows: GrowthSendrAnalyticsLaunchRow[] = []
  for (const run of inRange) {
    const row = await mapLaunchRow(admin, {
      organizationId: input.organizationId,
      run,
      dateRange: input.dateRange,
    })
    if (input.attentionOnly) {
      const needsAttention = buildSendrLaunchAttentionRecommendation({
        status: run.status,
        enrolled: run.enrolledCount,
        views: row.views,
        lastError: run.lastError,
      })
      if (!needsAttention) continue
    }
    rows.push(row)
  }

  const offset = (page - 1) * pageSize
  return {
    items: rows.slice(offset, offset + pageSize),
    total: rows.length,
    page,
    pageSize,
  }
}

export function parseSendrAnalyticsLaunchesInput(searchParams: URLSearchParams) {
  return {
    dateRange: resolveSendrAnalyticsDateRange({
      preset: searchParams.get("dateRange"),
      startAt: searchParams.get("startAt"),
      endAt: searchParams.get("endAt"),
    }),
    page: Number(searchParams.get("page") ?? "1"),
    pageSize: Number(searchParams.get("pageSize") ?? "25"),
    attentionOnly: searchParams.get("attentionOnly") === "true",
  }
}
