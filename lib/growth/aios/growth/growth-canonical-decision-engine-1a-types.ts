/**
 * GE-AIOS-DECISION-ENGINE-1A — Canonical next-best decision contract (client-safe).
 * Computed authority only — not a durable strategy store.
 */

export const GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_QA_MARKER =
  "ge-aios-decision-engine-1a-v1" as const

export const GROWTH_CANONICAL_PRIMARY_ACTIONS = [
  "research",
  "contact",
  "reply",
  "send_promised_information",
  "schedule_meeting",
  "prepare_meeting",
  "request_introduction",
  "multi_thread",
  "prepare_pricing",
  "prepare_proposal",
  "wait",
  "pause",
  "disqualify",
  "no_action",
] as const

export type GrowthCanonicalPrimaryAction = (typeof GROWTH_CANONICAL_PRIMARY_ACTIONS)[number]

export const GROWTH_CANONICAL_DECISION_URGENCIES = [
  "immediate",
  "today",
  "this_week",
  "scheduled",
  "none",
] as const

export type GrowthCanonicalDecisionUrgency = (typeof GROWTH_CANONICAL_DECISION_URGENCIES)[number]

export const GROWTH_CANONICAL_DECISION_ACTORS = [
  "ava",
  "operator",
  "sales_specialist",
  "system",
] as const

export type GrowthCanonicalDecisionActor = (typeof GROWTH_CANONICAL_DECISION_ACTORS)[number]

export const GROWTH_CANONICAL_DECISION_CHANNELS = [
  "email",
  "linkedin",
  "sms",
  "phone",
  "meeting",
  "none",
] as const

export type GrowthCanonicalDecisionChannel = (typeof GROWTH_CANONICAL_DECISION_CHANNELS)[number]

export type DecisionPrerequisite = {
  id: string
  label: string
  status: "pending" | "in_progress" | "complete"
  blocksPrimary: boolean
}

export type DecisionBlocker = {
  id: string
  label: string
  source: string
  severity: "hard" | "soft"
}

export type SupportingDecisionAction = {
  action: GrowthCanonicalPrimaryAction
  title: string
  rationale: string
  urgency: GrowthCanonicalDecisionUrgency
  recommendedActor: GrowthCanonicalDecisionActor
}

export type SuppressedDecisionAction = {
  action: GrowthCanonicalPrimaryAction
  title: string
  reason: string
  source: string
}

export type GrowthCanonicalDecisionSourceSummary = {
  relationshipGoal?: string | null
  revenueRecommendation?: string | null
  latestMaterialEvent?: string | null
  currentStage?: string | null
  packageStatus?: string | null
  approvalStatus?: string | null
}

export type GrowthCanonicalNextBestDecision = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_QA_MARKER
  decisionId: string
  decisionFingerprint: string
  organizationId: string
  leadId: string
  generatedAt: string

  primaryAction: GrowthCanonicalPrimaryAction
  title: string
  rationale: string[]
  urgency: GrowthCanonicalDecisionUrgency
  confidence: number

  recommendedActor: GrowthCanonicalDecisionActor
  recommendedChannel: GrowthCanonicalDecisionChannel

  targetContactId?: string | null
  targetRole?: string | null

  waitUntil?: string | null
  prerequisites: DecisionPrerequisite[]
  blockedBy: DecisionBlocker[]
  supportingActions: SupportingDecisionAction[]
  suppressedActions: SuppressedDecisionAction[]

  sourceSummary: GrowthCanonicalDecisionSourceSummary

  operatorReviewRequired: boolean
  transportBlocked: boolean
}
