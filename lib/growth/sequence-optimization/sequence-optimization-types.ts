/** Phase 6.35C — Sequence Optimization V2 (client-safe, approval-only). */

export const GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER =
  "growth-sequence-optimization-v2-v1" as const

export const GROWTH_SEQUENCE_OPTIMIZATION_RECOMMENDATION_TYPES = [
  "improve_subject",
  "improve_opener",
  "improve_cta",
  "adjust_timing",
  "add_step",
  "remove_step",
  "change_channel",
  "pause_underperforming_step",
  "double_down_on_winning_angle",
] as const

export type GrowthSequenceOptimizationRecommendationType =
  (typeof GROWTH_SEQUENCE_OPTIMIZATION_RECOMMENDATION_TYPES)[number]

export type GrowthSequenceOptimizationEvidence = {
  label: string
  value: string
  metric?: string
}

export type GrowthSequenceOptimizationRecommendation = {
  id: string
  recommendationType: GrowthSequenceOptimizationRecommendationType
  title: string
  explanation: string
  evidence: GrowthSequenceOptimizationEvidence[]
  confidence: number
  sequenceId: string | null
  sequenceLabel: string
  sequenceStepId: string | null
  sequenceStepLabel: string | null
  expectedImpact: string
  recommendedEdit: string
  safetyNotes: string
  category: "winning_angle" | "copy_improvement" | "step_structure" | "channel_timing" | "underperformer"
}

export type GrowthSequenceOptimizationRollups = {
  topSequences: Array<{ sequenceId: string; label: string; wins: number; revenue: number }>
  weakSteps: Array<{ stepId: string; label: string; touches: number; wins: number }>
  topSubjectCategories: Array<{ key: string; label: string; replyRatePct: number | null; sends: number }>
  topOpenerStrategies: Array<{ key: string; label: string; replyRatePct: number | null; sends: number }>
  channelScores: Array<{ channel: string; effectivenessScore: number }>
  generatedAt: string
}

export type GrowthSequenceOptimizationRecommendationsPayload = {
  qa_marker: typeof GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER
  recommendations: GrowthSequenceOptimizationRecommendation[]
  winningAngles: GrowthSequenceOptimizationRecommendation[]
  copyImprovements: GrowthSequenceOptimizationRecommendation[]
  stepStructure: GrowthSequenceOptimizationRecommendation[]
  channelTiming: GrowthSequenceOptimizationRecommendation[]
  underperformers: GrowthSequenceOptimizationRecommendation[]
  rollups: GrowthSequenceOptimizationRollups
  touchesAnalyzed: number
  lastCalculatedAt: string
}

export const GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES =
  "Approval-only advisory. Operators must manually edit sequences. No automatic sequence changes, sends, routing, warmup, or personalization."

export type SequenceOptimizationEngineInput = {
  bySequence: import("@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types").GrowthAttributionDimensionRow[]
  bySequenceStep: import("@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types").GrowthAttributionDimensionRow[]
  byChannel: import("@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types").GrowthAttributionDimensionRow[]
  funnel: import("@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types").GrowthAttributionFunnelStep[]
  sequenceLabels: Map<string, string>
  stepLabels: Map<string, string>
  stepMeta: Array<{
    stepId: string
    sequenceId: string
    stepOrder: number
    channel: string
    delayDaysMin: number
    delayDaysMax: number
  }>
  sequenceSnapshots: Array<{ sequenceId: string; replyPct: number; revenue: number }>
  subjectSignals: Array<{ key: string; label: string; sends: number; replyRatePct: number | null }>
  openerSignals: Array<{ key: string; label: string; sends: number; replyRatePct: number | null }>
  ctaSignals: Array<{ key: string; label: string; sends: number; wins: number }>
  painPoints: Array<{ key: string; label: string; winCount: number; leadCount: number }>
  channelEffectiveness: Array<{ channel: string; effectivenessScore: number; touchCount: number }>
  replyQualityBySequence: Array<{
    sequenceId: string
    replyQualityScore: number
    objectionRate: number
    positiveReplyRate: number
    totalReplies: number
  }>
  touchesAnalyzed: number
  filterSequenceId?: string | null
}

export function sequenceOptimizationTypeLabel(
  type: GrowthSequenceOptimizationRecommendationType,
): string {
  switch (type) {
    case "improve_subject":
      return "Improve subject"
    case "improve_opener":
      return "Improve opener"
    case "improve_cta":
      return "Improve CTA"
    case "adjust_timing":
      return "Adjust timing"
    case "add_step":
      return "Add step"
    case "remove_step":
      return "Remove step"
    case "change_channel":
      return "Change channel"
    case "pause_underperforming_step":
      return "Pause underperforming step"
    case "double_down_on_winning_angle":
      return "Double down on winning angle"
    default:
      return type
  }
}
