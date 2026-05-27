/** Client-safe Growth Engine sequence performance + revenue intelligence types (Phase 2M). */

export const GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_QA_MARKER =
  "growth-revenue-sequence-intelligence-v1" as const

export const GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_PRIVACY_NOTE =
  "Performance and revenue intelligence is read-only operator telemetry. No autonomous optimization, variant promotion, or compliance bypass."

export const GROWTH_PERFORMANCE_PERIOD_KEYS = ["7d", "30d", "90d", "all"] as const
export type GrowthPerformancePeriodKey = (typeof GROWTH_PERFORMANCE_PERIOD_KEYS)[number]

export const GROWTH_PERFORMANCE_TRENDS = ["improving", "stable", "declining", "critical"] as const
export type GrowthPerformanceTrend = (typeof GROWTH_PERFORMANCE_TRENDS)[number]

export const GROWTH_SEQUENCE_PERFORMANCE_METRICS = [
  "sent",
  "delivered",
  "opens",
  "clicks",
  "replies",
  "positive_replies",
  "meetings",
  "opportunities",
  "wins",
  "pipeline_value",
  "revenue",
  "bounce_pct",
  "unsubscribe_pct",
  "complaint_pct",
  "reply_pct",
  "meeting_pct",
  "open_pct",
  "click_pct",
  "lift_pct",
  "sequence_velocity",
] as const
export type GrowthSequencePerformanceMetric = (typeof GROWTH_SEQUENCE_PERFORMANCE_METRICS)[number]

export type GrowthSequencePerformanceMetrics = Record<GrowthSequencePerformanceMetric, number>

export const GROWTH_SENDER_PERFORMANCE_METRICS = [
  "deliverability",
  "bounce_trend",
  "complaint_trend",
  "warmup_trend",
  "engagement_trend",
  "fatigue_score",
  "reputation_score",
] as const
export type GrowthSenderPerformanceMetric = (typeof GROWTH_SENDER_PERFORMANCE_METRICS)[number]

export type GrowthSenderPerformanceMetrics = Record<GrowthSenderPerformanceMetric, number>

export const GROWTH_PROVIDER_PERFORMANCE_METRICS = [
  "delivery_latency_ms",
  "failure_pct",
  "bounce_pct",
  "complaint_pct",
  "delivery_success_pct",
  "route_performance_score",
] as const
export type GrowthProviderPerformanceMetric = (typeof GROWTH_PROVIDER_PERFORMANCE_METRICS)[number]

export type GrowthProviderPerformanceMetrics = Record<GrowthProviderPerformanceMetric, number>

export const GROWTH_REVENUE_ATTRIBUTION_EVENT_TYPES = [
  "meeting_booked",
  "opportunity_created",
  "opportunity_won",
  "pipeline_value",
  "demo_request_detected",
  "pricing_question_detected",
  "positive_reply_detected",
  "momentum_accelerated",
] as const
export type GrowthRevenueAttributionEventType = (typeof GROWTH_REVENUE_ATTRIBUTION_EVENT_TYPES)[number]

export const GROWTH_REVENUE_ATTRIBUTION_TYPES = [
  "sequence",
  "variant",
  "sender",
  "provider_route",
  "reply_draft",
] as const
export type GrowthRevenueAttributionType = (typeof GROWTH_REVENUE_ATTRIBUTION_TYPES)[number]

export const GROWTH_PERFORMANCE_RISK_TYPES = [
  "bounce_spike",
  "unsubscribe_spike",
  "complaint_spike",
  "sender_fatigue",
  "provider_degradation",
  "meeting_drop",
  "reply_collapse",
] as const
export type GrowthPerformanceRiskType = (typeof GROWTH_PERFORMANCE_RISK_TYPES)[number]

export type GrowthSequencePerformanceSnapshot = {
  id: string
  sequenceId: string | null
  sequenceEnrollmentId: string | null
  periodKey: GrowthPerformancePeriodKey
  metrics: GrowthSequencePerformanceMetrics
  trend: GrowthPerformanceTrend
  snapshotAt: string
  metadata: Record<string, unknown>
}

export type GrowthSenderPerformanceSnapshot = {
  id: string
  senderAccountId: string
  periodKey: GrowthPerformancePeriodKey
  metrics: GrowthSenderPerformanceMetrics
  trend: GrowthPerformanceTrend
  snapshotAt: string
  metadata: Record<string, unknown>
}

export type GrowthProviderRoutePerformanceSnapshot = {
  id: string
  providerId: string | null
  routeId: string | null
  periodKey: GrowthPerformancePeriodKey
  metrics: GrowthProviderPerformanceMetrics
  trend: GrowthPerformanceTrend
  snapshotAt: string
  metadata: Record<string, unknown>
}

export type GrowthRevenueAttributionEvent = {
  id: string
  leadId: string
  opportunityId: string | null
  eventType: GrowthRevenueAttributionEventType
  attributionType: GrowthRevenueAttributionType
  sequenceId: string | null
  sequenceEnrollmentId: string | null
  experimentId: string | null
  variantId: string | null
  senderAccountId: string | null
  providerId: string | null
  deliveryAttemptId: string | null
  weightedAmount: number
  revenueAmount: number
  attributionWeight: number
  metadata: Record<string, unknown>
  occurredAt: string
}

export type GrowthPerformanceIntelligenceEvent = {
  id: string
  eventType: string
  severity: "info" | "low" | "medium" | "high" | "critical"
  title: string
  description: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthPerformanceRiskAlert = {
  riskType: GrowthPerformanceRiskType
  severity: "medium" | "high" | "critical"
  title: string
  description: string
  entityType: string
  entityId: string | null
  metricValue: number
  threshold: number
}

export type GrowthTrendPoint = {
  label: string
  value: number
}

export type GrowthSequenceFunnelStep = {
  label: string
  count: number
  ratePct: number | null
}

export type GrowthTopSequenceRow = {
  sequenceId: string | null
  sequenceLabel: string
  sent: number
  replyPct: number
  meetingPct: number
  revenue: number
  trend: GrowthPerformanceTrend
}

export type GrowthVariantLiftRow = {
  experimentId: string
  experimentName: string
  variantLabel: string
  liftPct: number | null
  replyPct: number
}

export type GrowthRevenueIntelligenceDashboard = {
  qa_marker: typeof GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_QA_MARKER
  periodKey: GrowthPerformancePeriodKey
  revenueInfluenced: number
  meetingsGenerated: number
  pipelineCreated: number
  replyTrend: GrowthPerformanceTrend
  senderHealthScore: number
  providerHealthScore: number
  riskAlerts: GrowthPerformanceRiskAlert[]
  topSequences: GrowthTopSequenceRow[]
  variantLift: GrowthVariantLiftRow[]
  replyTrendSeries: GrowthTrendPoint[]
  meetingTrendSeries: GrowthTrendPoint[]
  revenueAttributionSeries: GrowthTrendPoint[]
  providerPerformanceSeries: GrowthTrendPoint[]
  senderPerformanceSeries: GrowthTrendPoint[]
  sequenceFunnel: GrowthSequenceFunnelStep[]
  recentAttributionEvents: GrowthRevenueAttributionEvent[]
  recentIntelligenceEvents: GrowthPerformanceIntelligenceEvent[]
}

export function performanceTrendLabel(trend: GrowthPerformanceTrend): string {
  return trend.charAt(0).toUpperCase() + trend.slice(1)
}

export function emptySequenceMetrics(): GrowthSequencePerformanceMetrics {
  return Object.fromEntries(GROWTH_SEQUENCE_PERFORMANCE_METRICS.map((m) => [m, 0])) as GrowthSequencePerformanceMetrics
}

export function emptySenderMetrics(): GrowthSenderPerformanceMetrics {
  return Object.fromEntries(GROWTH_SENDER_PERFORMANCE_METRICS.map((m) => [m, 0])) as GrowthSenderPerformanceMetrics
}

export function emptyProviderMetrics(): GrowthProviderPerformanceMetrics {
  return Object.fromEntries(GROWTH_PROVIDER_PERFORMANCE_METRICS.map((m) => [m, 0])) as GrowthProviderPerformanceMetrics
}
