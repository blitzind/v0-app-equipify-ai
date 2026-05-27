/** Client-safe Growth Engine sequence A/B experiment types (Phase 2L). */

export const GROWTH_SEQUENCE_AB_TESTING_QA_MARKER = "growth-sequence-ab-testing-v1" as const

export const GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE =
  "Sequence experiments require human start and winner promotion. Recommendations only — no autonomous sends or winner rollout."

export const GROWTH_SEQUENCE_EXPERIMENT_TYPES = [
  "subject",
  "body",
  "send_window",
  "sender",
  "provider_route",
  "sequence_step",
  "full_sequence",
] as const
export type GrowthSequenceExperimentType = (typeof GROWTH_SEQUENCE_EXPERIMENT_TYPES)[number]

export const GROWTH_SEQUENCE_EXPERIMENT_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
] as const
export type GrowthSequenceExperimentStatus = (typeof GROWTH_SEQUENCE_EXPERIMENT_STATUSES)[number]

export const GROWTH_SEQUENCE_EXPERIMENT_VARIANT_STATUSES = ["draft", "active", "paused", "archived"] as const
export type GrowthSequenceExperimentVariantStatus = (typeof GROWTH_SEQUENCE_EXPERIMENT_VARIANT_STATUSES)[number]

export const GROWTH_SEQUENCE_EXPERIMENT_METRICS = [
  "sent",
  "opens",
  "clicks",
  "replies",
  "positive_replies",
  "meetings",
  "bounces",
  "unsubscribes",
  "complaints",
] as const
export type GrowthSequenceExperimentMetric = (typeof GROWTH_SEQUENCE_EXPERIMENT_METRICS)[number]

export const GROWTH_SEQUENCE_EXPERIMENT_POSITIVE_METRICS: GrowthSequenceExperimentMetric[] = [
  "opens",
  "clicks",
  "replies",
  "positive_replies",
  "meetings",
]

export const GROWTH_SEQUENCE_EXPERIMENT_RISK_METRICS: GrowthSequenceExperimentMetric[] = [
  "bounces",
  "unsubscribes",
  "complaints",
]

export type GrowthSequenceExperimentVariantPayload = {
  subject?: string
  body?: string
  sendWindowStartHour?: number
  sendWindowEndHour?: number
  senderAccountId?: string
  providerRouteId?: string
  sequenceStepId?: string
}

export type GrowthSequenceExperimentVariant = {
  id: string
  experimentId: string
  label: string
  isControl: boolean
  payload: GrowthSequenceExperimentVariantPayload
  weight: number
  status: GrowthSequenceExperimentVariantStatus
  createdAt: string
  updatedAt: string
}

export type GrowthSequenceExperiment = {
  id: string
  name: string
  experimentType: GrowthSequenceExperimentType
  status: GrowthSequenceExperimentStatus
  sequenceId: string | null
  sequenceStepId: string | null
  controlVariantId: string | null
  winningVariantId: string | null
  minimumSampleSize: number
  confidenceThreshold: number
  metadata: Record<string, unknown>
  startedAt: string | null
  completedAt: string | null
  promotedAt: string | null
  createdBy: string | null
  promotedBy: string | null
  createdAt: string
  updatedAt: string
  variants?: GrowthSequenceExperimentVariant[]
}

export type GrowthSequenceExperimentAssignment = {
  id: string
  experimentId: string
  variantId: string
  leadId: string
  sequenceEnrollmentId: string | null
  assignmentHash: string
  deliveryAttemptId: string | null
  assignedAt: string
}

export type GrowthSequenceExperimentResultRow = {
  variantId: string
  variantLabel: string
  isControl: boolean
  metrics: Record<GrowthSequenceExperimentMetric, number>
}

export type GrowthSequenceExperimentWinnerRecommendation = {
  experimentId: string
  recommendedVariantId: string | null
  recommendedVariantLabel: string | null
  confidence: number
  liftBasisPoints: number | null
  riskPenalty: number
  sampleSize: number
  meetsMinimumSample: boolean
  meetsConfidenceThreshold: boolean
  reasons: string[]
  requiresHumanPromotion: true
}

export type GrowthSequenceExperimentEvent = {
  id: string
  experimentId: string
  variantId: string | null
  eventType: string
  severity: "info" | "low" | "medium" | "high" | "critical"
  title: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthSequenceExperimentDashboard = {
  qa_marker: typeof GROWTH_SEQUENCE_AB_TESTING_QA_MARKER
  activeExperiments: number
  winnerRecommendations: GrowthSequenceExperimentWinnerRecommendation[]
  riskyVariants: Array<{ experimentId: string; experimentName: string; variantId: string; variantLabel: string; riskScore: number }>
  liftObserved: Array<{ experimentId: string; experimentName: string; liftBasisPoints: number | null; variantLabel: string }>
  experiments: GrowthSequenceExperiment[]
  results: Array<GrowthSequenceExperimentResultRow & { experimentId: string; experimentName: string }>
  events: GrowthSequenceExperimentEvent[]
}

export function experimentStatusLabel(status: GrowthSequenceExperimentStatus): string {
  return status.replace(/_/g, " ")
}

export function experimentTypeLabel(type: GrowthSequenceExperimentType): string {
  return type.replace(/_/g, " ")
}

export function maskExperimentLabel(experimentId: string, name?: string | null): string {
  if (name?.trim()) return name.trim().slice(0, 80)
  return `Experiment ${experimentId.slice(0, 8)}…`
}
