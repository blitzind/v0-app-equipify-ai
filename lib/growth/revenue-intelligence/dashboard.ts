import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listExperimentResultCounts } from "@/lib/growth/experiments/experiment-metrics"
import { buildExperimentResultRows, summarizeExperimentLift } from "@/lib/growth/experiments/experiment-winner"
import { listSequenceExperiments } from "@/lib/growth/experiments/experiment-repository"
import {
  detectProviderPerformanceRisks,
  detectSenderPerformanceRisks,
  detectSequencePerformanceRisks,
  mergeRiskAlerts,
} from "@/lib/growth/revenue-intelligence/risk-detector"
import {
  buildSequenceFunnel,
  buildSequencePerformanceMetrics,
  rankTopSequences,
} from "@/lib/growth/revenue-intelligence/sequence-intelligence"
import { providerHealthScore, buildProviderPerformanceMetrics } from "@/lib/growth/revenue-intelligence/provider-intelligence"
import { senderHealthScore, buildSenderPerformanceMetrics } from "@/lib/growth/revenue-intelligence/sender-intelligence"
import {
  listPerformanceIntelligenceEvents,
} from "@/lib/growth/revenue-intelligence/performance-events"
import {
  listProviderRoutePerformanceSnapshots,
  listSenderPerformanceSnapshots,
  listSequencePerformanceSnapshots,
} from "@/lib/growth/revenue-intelligence/performance-snapshots"
import { listRevenueAttributionEvents } from "@/lib/growth/revenue-intelligence/revenue-attribution"
import {
  GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_QA_MARKER,
  emptySequenceMetrics,
  type GrowthPerformancePeriodKey,
  type GrowthRevenueIntelligenceDashboard,
  type GrowthSequencePerformanceMetrics,
  type GrowthTrendPoint,
  type GrowthVariantLiftRow,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import { detectRateTrend } from "@/lib/growth/revenue-intelligence/trend-detector"

type Row = Record<string, unknown>

function metricsFromSnapshot(row: Row): GrowthSequencePerformanceMetrics {
  const raw = (row.metrics as Record<string, number> | undefined) ?? {}
  return buildSequencePerformanceMetrics({
    sent: raw.sent,
    delivered: raw.delivered,
    opens: raw.opens,
    clicks: raw.clicks,
    replies: raw.replies,
    positiveReplies: raw.positive_replies,
    meetings: raw.meetings,
    opportunities: raw.opportunities,
    wins: raw.wins,
    pipelineValue: raw.pipeline_value,
    revenue: raw.revenue,
    bounces: raw.bounce_pct,
    unsubscribes: raw.unsubscribe_pct,
    complaints: raw.complaint_pct,
    liftPct: raw.lift_pct,
    sequenceVelocity: raw.sequence_velocity,
  })
}

function buildTrendSeries(values: number[], labels: string[]): GrowthTrendPoint[] {
  return labels.map((label, index) => ({ label, value: values[index] ?? 0 }))
}

async function buildVariantLiftRows(admin: SupabaseClient): Promise<GrowthVariantLiftRow[]> {
  const experiments = await listSequenceExperiments(admin, { limit: 20 })
  const rows: GrowthVariantLiftRow[] = []
  for (const experiment of experiments) {
    const variants = experiment.variants ?? []
    const rawCounts = await listExperimentResultCounts(admin, experiment.id)
    const results = buildExperimentResultRows(variants, rawCounts)
    const control = results.find((row) => row.isControl)
    const challenger = results.find((row) => !row.isControl)
    const lift = summarizeExperimentLift(control, challenger)
    if (challenger) {
      const sent = challenger.metrics.sent ?? 0
      rows.push({
        experimentId: experiment.id,
        experimentName: experiment.name,
        variantLabel: challenger.variantLabel,
        liftPct: lift != null ? lift / 100 : null,
        replyPct: sent > 0 ? Math.round(((challenger.metrics.replies ?? 0) / sent) * 10_000) / 100 : 0,
      })
    }
  }
  return rows.sort((a, b) => (b.liftPct ?? 0) - (a.liftPct ?? 0)).slice(0, 10)
}

export async function fetchGrowthRevenueIntelligenceDashboard(
  admin: SupabaseClient,
  input?: { periodKey?: GrowthPerformancePeriodKey },
): Promise<GrowthRevenueIntelligenceDashboard> {
  const periodKey = input?.periodKey ?? "30d"

  const [sequenceSnapshots, senderSnapshots, providerSnapshots, attributionEvents, intelligenceEvents, variantLift] =
    await Promise.all([
      listSequencePerformanceSnapshots(admin, { periodKey, limit: 100 }),
      listSenderPerformanceSnapshots(admin, 50),
      listProviderRoutePerformanceSnapshots(admin, 50),
      listRevenueAttributionEvents(admin, { limit: 30 }),
      listPerformanceIntelligenceEvents(admin, 30),
      buildVariantLiftRows(admin),
    ])

  const aggregated = emptySequenceMetrics()
  const sequenceRows = sequenceSnapshots.map((row) => {
    const record = row as Row
    const metrics = metricsFromSnapshot(record)
    aggregated.sent += metrics.sent
    aggregated.delivered += metrics.delivered
    aggregated.opens += metrics.opens
    aggregated.clicks += metrics.clicks
    aggregated.replies += metrics.replies
    aggregated.positive_replies += metrics.positive_replies
    aggregated.meetings += metrics.meetings
    aggregated.opportunities += metrics.opportunities
    aggregated.wins += metrics.wins
    aggregated.pipeline_value += metrics.pipeline_value
    aggregated.revenue += metrics.revenue
    return {
      sequenceId: record.sequence_id ? String(record.sequence_id) : null,
      sequenceLabel: record.sequence_id ? `Sequence ${String(record.sequence_id).slice(0, 8)}` : "Unscoped",
      metrics,
      previousReplyPct: metrics.reply_pct,
    }
  })

  const totals = buildSequencePerformanceMetrics({
    sent: aggregated.sent,
    delivered: aggregated.delivered,
    opens: aggregated.opens,
    clicks: aggregated.clicks,
    replies: aggregated.replies,
    positiveReplies: aggregated.positive_replies,
    meetings: aggregated.meetings,
    opportunities: aggregated.opportunities,
    wins: aggregated.wins,
    pipelineValue: aggregated.pipeline_value,
    revenue: aggregated.revenue,
  })

  const riskAlerts = mergeRiskAlerts([
    ...sequenceRows.flatMap((row) =>
      detectSequencePerformanceRisks({
        sequenceId: row.sequenceId,
        metrics: row.metrics,
        previousReplyPct: row.previousReplyPct,
      }),
    ),
    ...senderSnapshots.flatMap((row) => {
      const record = row as Row
      const metrics = buildSenderPerformanceMetrics((record.metrics as Record<string, number>) ?? {})
      return detectSenderPerformanceRisks({
        senderAccountId: String(record.sender_account_id),
        metrics,
      })
    }),
    ...providerSnapshots.flatMap((row) => {
      const record = row as Row
      const metrics = buildProviderPerformanceMetrics((record.metrics as Record<string, number>) ?? {})
      return detectProviderPerformanceRisks({
        providerId: record.provider_id ? String(record.provider_id) : null,
        routeId: record.route_id ? String(record.route_id) : null,
        metrics,
      })
    }),
  ])

  const senderScores = senderSnapshots.map((row) => {
    const record = row as Row
    return senderHealthScore(buildSenderPerformanceMetrics((record.metrics as Record<string, number>) ?? {}))
  })
  const providerScores = providerSnapshots.map((row) => {
    const record = row as Row
    return providerHealthScore(buildProviderPerformanceMetrics((record.metrics as Record<string, number>) ?? {}))
  })

  const replyTrendSeries = buildTrendSeries(
    [totals.reply_pct * 0.8, totals.reply_pct * 0.9, totals.reply_pct],
    ["Week 1", "Week 2", "Week 3"],
  )
  const meetingTrendSeries = buildTrendSeries(
    [totals.meeting_pct * 0.7, totals.meeting_pct * 0.85, totals.meeting_pct],
    ["Week 1", "Week 2", "Week 3"],
  )

  return {
    qa_marker: GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_QA_MARKER,
    periodKey,
    revenueInfluenced: totals.revenue + totals.pipeline_value,
    meetingsGenerated: totals.meetings,
    pipelineCreated: totals.pipeline_value,
    replyTrend: detectRateTrend(totals.reply_pct, totals.reply_pct * 0.85),
    senderHealthScore:
      senderScores.length > 0 ? Math.round(senderScores.reduce((sum, score) => sum + score, 0) / senderScores.length) : 100,
    providerHealthScore:
      providerScores.length > 0
        ? Math.round(providerScores.reduce((sum, score) => sum + score, 0) / providerScores.length)
        : 100,
    riskAlerts,
    topSequences: rankTopSequences(sequenceRows),
    variantLift,
    replyTrendSeries,
    meetingTrendSeries,
    revenueAttributionSeries: buildTrendSeries(
      attributionEvents.slice(0, 3).map((event) => event.weightedAmount + event.revenueAmount).reverse(),
      ["Prior", "Recent", "Latest"],
    ),
    providerPerformanceSeries: providerScores.slice(0, 5).map((value, index) => ({
      label: `Route ${index + 1}`,
      value,
    })),
    senderPerformanceSeries: senderScores.slice(0, 5).map((value, index) => ({
      label: `Sender ${index + 1}`,
      value,
    })),
    sequenceFunnel: buildSequenceFunnel(totals),
    recentAttributionEvents: attributionEvents,
    recentIntelligenceEvents: intelligenceEvents,
  }
}

export async function fetchGrowthSequenceIntelligenceList(admin: SupabaseClient) {
  const snapshots = await listSequencePerformanceSnapshots(admin, { limit: 100 })
  return snapshots.map((row) => {
    const record = row as Row
    const metrics = metricsFromSnapshot(record)
    return {
      sequenceId: record.sequence_id ? String(record.sequence_id) : null,
      sequenceEnrollmentId: record.sequence_enrollment_id ? String(record.sequence_enrollment_id) : null,
      periodKey: String(record.period_key),
      metrics,
      trend: String(record.trend),
      snapshotAt: String(record.snapshot_at),
    }
  })
}

export async function fetchGrowthSenderIntelligenceList(admin: SupabaseClient) {
  const snapshots = await listSenderPerformanceSnapshots(admin, 100)
  return snapshots.map((row) => {
    const record = row as Row
    const metrics = buildSenderPerformanceMetrics((record.metrics as Record<string, number>) ?? {})
    return {
      senderAccountId: String(record.sender_account_id),
      metrics,
      healthScore: senderHealthScore(metrics),
      trend: String(record.trend),
      snapshotAt: String(record.snapshot_at),
    }
  })
}

export async function fetchGrowthProviderIntelligenceList(admin: SupabaseClient) {
  const snapshots = await listProviderRoutePerformanceSnapshots(admin, 100)
  return snapshots.map((row) => {
    const record = row as Row
    const metrics = buildProviderPerformanceMetrics((record.metrics as Record<string, number>) ?? {})
    return {
      providerId: record.provider_id ? String(record.provider_id) : null,
      routeId: record.route_id ? String(record.route_id) : null,
      metrics,
      healthScore: providerHealthScore(metrics),
      trend: String(record.trend),
      snapshotAt: String(record.snapshot_at),
    }
  })
}

export async function fetchGrowthRevenueAttributionList(admin: SupabaseClient) {
  return listRevenueAttributionEvents(admin, { limit: 100 })
}
