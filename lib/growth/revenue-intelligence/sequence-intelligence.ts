import type {
  GrowthSequenceFunnelStep,
  GrowthSequencePerformanceMetrics,
  GrowthTopSequenceRow,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import { emptySequenceMetrics } from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import { detectRateTrend } from "@/lib/growth/revenue-intelligence/trend-detector"

export function computeRatePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 10_000) / 100
}

export function buildSequencePerformanceMetrics(input: {
  sent?: number
  delivered?: number
  opens?: number
  clicks?: number
  replies?: number
  positiveReplies?: number
  meetings?: number
  opportunities?: number
  wins?: number
  pipelineValue?: number
  revenue?: number
  bounces?: number
  unsubscribes?: number
  complaints?: number
  liftPct?: number
  sequenceVelocity?: number
}): GrowthSequencePerformanceMetrics {
  const metrics = emptySequenceMetrics()
  metrics.sent = input.sent ?? 0
  metrics.delivered = input.delivered ?? metrics.sent
  metrics.opens = input.opens ?? 0
  metrics.clicks = input.clicks ?? 0
  metrics.replies = input.replies ?? 0
  metrics.positive_replies = input.positiveReplies ?? 0
  metrics.meetings = input.meetings ?? 0
  metrics.opportunities = input.opportunities ?? 0
  metrics.wins = input.wins ?? 0
  metrics.pipeline_value = input.pipelineValue ?? 0
  metrics.revenue = input.revenue ?? 0
  metrics.bounce_pct = computeRatePct(input.bounces ?? 0, metrics.sent)
  metrics.unsubscribe_pct = computeRatePct(input.unsubscribes ?? 0, metrics.sent)
  metrics.complaint_pct = computeRatePct(input.complaints ?? 0, metrics.sent)
  metrics.reply_pct = computeRatePct(metrics.replies, metrics.sent)
  metrics.meeting_pct = computeRatePct(metrics.meetings, metrics.sent)
  metrics.open_pct = computeRatePct(metrics.opens, metrics.sent)
  metrics.click_pct = computeRatePct(metrics.clicks, metrics.sent)
  metrics.lift_pct = input.liftPct ?? 0
  metrics.sequence_velocity = input.sequenceVelocity ?? 0
  return metrics
}

export function mergeSequencePerformanceMetrics(
  base: GrowthSequencePerformanceMetrics,
  delta: Partial<Record<keyof GrowthSequencePerformanceMetrics, number>>,
): GrowthSequencePerformanceMetrics {
  const sent = base.sent + (delta.sent ?? 0)
  const delivered = base.delivered + (delta.delivered ?? 0)
  const opens = base.opens + (delta.opens ?? 0)
  const clicks = base.clicks + (delta.clicks ?? 0)
  const replies = base.replies + (delta.replies ?? 0)
  const positiveReplies = base.positive_replies + (delta.positive_replies ?? 0)
  const meetings = base.meetings + (delta.meetings ?? 0)
  const opportunities = base.opportunities + (delta.opportunities ?? 0)
  const wins = base.wins + (delta.wins ?? 0)
  const pipelineValue = base.pipeline_value + (delta.pipeline_value ?? 0)
  const revenue = base.revenue + (delta.revenue ?? 0)

  const bounceCount = Math.round((base.bounce_pct / 100) * base.sent) + (delta.bounce_pct ?? 0)
  const unsubscribeCount = Math.round((base.unsubscribe_pct / 100) * base.sent) + (delta.unsubscribe_pct ?? 0)
  const complaintCount = Math.round((base.complaint_pct / 100) * base.sent) + (delta.complaint_pct ?? 0)

  return buildSequencePerformanceMetrics({
    sent,
    delivered,
    opens,
    clicks,
    replies,
    positiveReplies,
    meetings,
    opportunities,
    wins,
    pipelineValue,
    revenue,
    bounces: bounceCount,
    unsubscribes: unsubscribeCount,
    complaints: complaintCount,
    liftPct: delta.lift_pct ?? base.lift_pct,
    sequenceVelocity: delta.sequence_velocity ?? base.sequence_velocity,
  })
}

export function buildSequenceFunnel(metrics: GrowthSequencePerformanceMetrics): GrowthSequenceFunnelStep[] {
  const sent = metrics.sent
  return [
    { label: "Sent", count: sent, ratePct: 100 },
    { label: "Delivered", count: metrics.delivered, ratePct: computeRatePct(metrics.delivered, sent) },
    { label: "Opened", count: metrics.opens, ratePct: computeRatePct(metrics.opens, sent) },
    { label: "Clicked", count: metrics.clicks, ratePct: computeRatePct(metrics.clicks, sent) },
    { label: "Replied", count: metrics.replies, ratePct: computeRatePct(metrics.replies, sent) },
    { label: "Meetings", count: metrics.meetings, ratePct: computeRatePct(metrics.meetings, sent) },
    { label: "Opportunities", count: metrics.opportunities, ratePct: computeRatePct(metrics.opportunities, sent) },
    { label: "Wins", count: metrics.wins, ratePct: computeRatePct(metrics.wins, sent) },
  ]
}

export function rankTopSequences(
  rows: Array<{
    sequenceId: string | null
    sequenceLabel: string
    metrics: GrowthSequencePerformanceMetrics
    previousReplyPct?: number
  }>,
  limit = 10,
): GrowthTopSequenceRow[] {
  return rows
    .map((row) => ({
      sequenceId: row.sequenceId,
      sequenceLabel: row.sequenceLabel,
      sent: row.metrics.sent,
      replyPct: row.metrics.reply_pct,
      meetingPct: row.metrics.meeting_pct,
      revenue: row.metrics.revenue,
      trend: detectRateTrend(row.metrics.reply_pct, row.previousReplyPct ?? row.metrics.reply_pct),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.replyPct - a.replyPct)
    .slice(0, limit)
}

export function computeSequenceVelocity(stepsCompleted: number, daysElapsed: number): number {
  if (daysElapsed <= 0) return 0
  return Math.round((stepsCompleted / daysElapsed) * 100) / 100
}
