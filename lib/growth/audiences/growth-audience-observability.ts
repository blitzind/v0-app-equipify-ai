import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeAudienceTable } from "@/lib/growth/audiences/growth-audience-schema-health"
import {
  aggregateAudienceDiffMetricsToday,
  countAudienceDiffsToday,
  countAudienceLeadCreationsToday,
  countInProgressAudienceRefreshRuns,
} from "@/lib/growth/audiences/growth-audience-repository"

export type GrowthAudienceObservabilitySnapshot = {
  schemaReady: boolean
  snapshotsGeneratedToday: number
  refreshesToday: number
  enrollmentsToday: number
  diffsGeneratedToday: number
  membersAddedToday: number
  membersRemovedToday: number
  leadCreationsToday: number
  rowsReadToday: number
  rowsWrittenToday: number
  failuresToday: number
  throttlesToday: number
  snapshotBacklog: number
  refreshBacklog: number
}

function startOfUtcDay(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

export async function getGrowthAudienceObservabilitySnapshot(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<GrowthAudienceObservabilitySnapshot> {
  const probe = await probeAudienceTable(admin, "growth_audiences")
  const fallback: GrowthAudienceObservabilitySnapshot = {
    schemaReady: false,
    snapshotsGeneratedToday: 0,
    refreshesToday: 0,
    enrollmentsToday: 0,
    diffsGeneratedToday: 0,
    membersAddedToday: 0,
    membersRemovedToday: 0,
    leadCreationsToday: 0,
    rowsReadToday: 0,
    rowsWrittenToday: 0,
    failuresToday: 0,
    throttlesToday: 0,
    snapshotBacklog: 0,
    refreshBacklog: 0,
  }
  if (probe.missing) return fallback

  const dayStart = startOfUtcDay()

  try {
    const refreshRuns = admin.schema("growth").from("growth_audience_refresh_runs")
    const snapshots = admin.schema("growth").from("growth_audience_snapshots")
    const snapshotDiffs = admin.schema("growth").from("growth_audience_snapshot_diffs")

    const [
      completedToday,
      refreshesToday,
      failuresToday,
      throttlesToday,
      metricsAgg,
      snapshotBacklog,
      refreshBacklog,
      diffFailuresToday,
      diffThrottlesToday,
      diffMetricsAgg,
    ] = await Promise.all([
      snapshots
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId)
        .gte("generated_at", dayStart),
      refreshRuns
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId)
        .gte("created_at", dayStart),
      refreshRuns
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId)
        .eq("status", "failed")
        .gte("created_at", dayStart),
      refreshRuns
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId)
        .eq("status", "throttled")
        .gte("created_at", dayStart),
      refreshRuns
        .select("rows_read, rows_written")
        .eq("organization_id", input.organizationId)
        .gte("created_at", dayStart)
        .limit(100),
      refreshRuns
        .select("remaining_estimate")
        .eq("organization_id", input.organizationId)
        .eq("status", "in_progress")
        .limit(25),
      countInProgressAudienceRefreshRuns(admin, input.organizationId),
      snapshotDiffs
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId)
        .eq("status", "failed")
        .gte("created_at", dayStart),
      snapshotDiffs
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId)
        .eq("status", "throttled")
        .gte("created_at", dayStart),
      snapshotDiffs
        .select("rows_read, rows_written")
        .eq("organization_id", input.organizationId)
        .gte("created_at", dayStart)
        .limit(100),
    ])

    let rowsReadToday = 0
    let rowsWrittenToday = 0
    for (const row of metricsAgg.data ?? []) {
      rowsReadToday += Number((row as { rows_read: number }).rows_read ?? 0)
      rowsWrittenToday += Number((row as { rows_written: number }).rows_written ?? 0)
    }
    for (const row of diffMetricsAgg.data ?? []) {
      rowsReadToday += Number((row as { rows_read: number }).rows_read ?? 0)
      rowsWrittenToday += Number((row as { rows_written: number }).rows_written ?? 0)
    }

    let snapshotBacklogEstimate = 0
    for (const row of snapshotBacklog.data ?? []) {
      snapshotBacklogEstimate += Number((row as { remaining_estimate: number }).remaining_estimate ?? 0)
    }

    const { count: enrollmentsToday } = await admin
      .schema("growth")
      .from("runtime_budgets")
      .select("count", { count: "exact", head: true })
      .eq("organization_id", input.organizationId)
      .eq("resource_type", "audience_enrollments")
      .eq("window_kind", "daily")
      .gte("window_start", dayStart)

    const [diffsGeneratedToday, diffMemberMetrics, leadCreationsToday] = await Promise.all([
      countAudienceDiffsToday(admin, input.organizationId, dayStart),
      aggregateAudienceDiffMetricsToday(admin, input.organizationId, dayStart),
      countAudienceLeadCreationsToday(admin, input.organizationId, dayStart),
    ])

    return {
      schemaReady: true,
      snapshotsGeneratedToday: completedToday.count ?? 0,
      refreshesToday: refreshesToday.count ?? 0,
      enrollmentsToday: enrollmentsToday ?? 0,
      diffsGeneratedToday,
      membersAddedToday: diffMemberMetrics.membersAdded,
      membersRemovedToday: diffMemberMetrics.membersRemoved,
      leadCreationsToday,
      rowsReadToday,
      rowsWrittenToday,
      failuresToday: (failuresToday.count ?? 0) + (diffFailuresToday.count ?? 0),
      throttlesToday: (throttlesToday.count ?? 0) + (diffThrottlesToday.count ?? 0),
      snapshotBacklog: snapshotBacklogEstimate,
      refreshBacklog,
    }
  } catch {
    return { ...fallback, schemaReady: true }
  }
}
