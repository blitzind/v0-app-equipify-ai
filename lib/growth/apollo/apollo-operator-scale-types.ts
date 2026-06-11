/** Apollo Operator Scale & Workflow Optimization types (Phase 13). */

export const APOLLO_OPERATOR_SCALE_QA_MARKER = "apollo-operator-scale-v13" as const

export const APOLLO_OPERATOR_QUEUE_STAGES = [
  "enrollment",
  "account_playbook",
  "voice_drop",
  "multichannel",
  "sequence_execution",
  "safe_execution",
] as const

export type ApolloOperatorQueueStage = (typeof APOLLO_OPERATOR_QUEUE_STAGES)[number]

export type ApolloOperatorQueueOutcome = "pending" | "approved" | "rejected" | "regenerated"

export type ApolloOperatorQueueItem = {
  id: string
  stage: ApolloOperatorQueueStage
  status: string
  outcome: ApolloOperatorQueueOutcome
  created_at: string
  resolved_at: string | null
  confidence_score: number | null
  regeneration_note: string | null
  metadata: Record<string, unknown>
}

export type ApolloOperatorQueueThroughput = {
  stage: ApolloOperatorQueueStage
  label: string
  items_created_per_day: number
  items_approved_per_day: number
  items_rejected_per_day: number
  items_regenerated_per_day: number
  average_time_in_queue_hours: number | null
  median_time_in_queue_hours: number | null
  max_queue_age_hours: number | null
  pending_count: number
}

export type ApolloOperatorApprovalQuality = {
  stage: ApolloOperatorQueueStage
  label: string
  approve_pct: number
  reject_pct: number
  regenerate_pct: number
  total_resolved: number
}

export type ApolloOperatorConfidenceCalibration = {
  stage: ApolloOperatorQueueStage
  label: string
  automation_accuracy_score: number
  high_confidence_approved: number
  high_confidence_rejected: number
  low_confidence_approved: number
  low_confidence_rejected: number
  high_confidence_threshold: number
}

export type ApolloOperatorBottleneckItem = {
  stage: ApolloOperatorQueueStage
  item_id: string
  status: string
  age_hours: number
  confidence_score: number | null
  company_name: string | null
}

export type ApolloOperatorBottleneckReport = {
  hotspots: Array<{ stage: ApolloOperatorQueueStage; pending_count: number; max_age_hours: number }>
  oldest_items: ApolloOperatorBottleneckItem[]
  stalled_candidates: ApolloOperatorBottleneckItem[]
}

export const APOLLO_DRAFT_REGENERATION_CATEGORIES = [
  "personalization_weak",
  "cta_weak",
  "wrong_tone",
  "inaccurate_research",
  "subject_issue",
  "operator_custom",
  "unknown",
] as const

export type ApolloDraftRegenerationCategory = (typeof APOLLO_DRAFT_REGENERATION_CATEGORIES)[number]

export type ApolloDraftRegenerationBreakdown = {
  category: ApolloDraftRegenerationCategory
  label: string
  count: number
  pct: number
}

export type ApolloOperatorApprovalSimulation = {
  threshold: number
  approvals_avoided: number
  pending_high_confidence: number
  operator_hours_saved: number
  estimated_error_rate_pct: number
  simulation_only: true
}

export type ApolloOperationalReadinessLevel =
  | "experimental"
  | "pilot_ready"
  | "production_ready"
  | "scale_ready"

export type ApolloOperationalReadinessScore = {
  score: number
  level: ApolloOperationalReadinessLevel
  factors: Record<string, number>
}

export type ApolloOperatorScaleForecastRow = {
  target_companies: number
  estimated_daily_queue_items: number
  estimated_operator_hours_per_day: number
  estimated_approval_load_per_day: number
  primary_bottleneck_stage: ApolloOperatorQueueStage | null
}

export type ApolloOperatorScaleReport = {
  qa_marker: typeof APOLLO_OPERATOR_SCALE_QA_MARKER
  computed_at: string
  throughput: ApolloOperatorQueueThroughput[]
  approval_quality: ApolloOperatorApprovalQuality[]
  confidence_calibration: ApolloOperatorConfidenceCalibration[]
  bottlenecks: ApolloOperatorBottleneckReport
  regeneration: ApolloDraftRegenerationBreakdown[]
  simulations: ApolloOperatorApprovalSimulation[]
  readiness: ApolloOperationalReadinessScore
  forecasts: ApolloOperatorScaleForecastRow[]
  recommendations: string[]
  verdict: {
    current_operator_capacity_items_per_day: number
    capacity_at_25_companies: number
    capacity_at_50_companies: number
    capacity_at_100_companies: number
    biggest_scaling_bottleneck: ApolloOperatorQueueStage | null
    recommended_next_phase: string
  }
}
