/** GE-AIOS-INSTITUTIONAL-LEARNING-1A — Organizational sales intelligence types (client-safe). */

import { GROWTH_LEARNING_MIN_SAMPLE_SIZE } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"

export const GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_QA_MARKER =
  "ge-aios-institutional-learning-1a-organizational-sales-intelligence-v1" as const

export const GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_OPERATOR_LAYOUT_QA_MARKER =
  "ge-aios-institutional-learning-1a-operator-insights-layout-v1" as const

export const INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE = GROWTH_LEARNING_MIN_SAMPLE_SIZE

export const INSTITUTIONAL_LEARNING_MIN_CONFIDENCE = 0.55 as const

export const INSTITUTIONAL_LEARNING_MAX_CONFIDENCE_BOOST = 0.06 as const

/** Decision priority — institutional learning is advisory only, never above account evidence. */
export const INSTITUTIONAL_LEARNING_DECISION_PRIORITY = [
  "current_account_evidence",
  "relationship_history",
  "buying_committee",
  "current_company_research",
  "institutional_learning",
  "seller_defaults",
] as const

export type GrowthInstitutionalAdvisoryDimension =
  | "industry"
  | "company_size"
  | "buyer_persona"
  | "role"
  | "relationship_stage"
  | "operational_problem"
  | "business_pressure"
  | "conversation_angle"
  | "first_question"
  | "cta"
  | "channel"
  | "follow_up_timing"
  | "objection"
  | "meeting_outcome"
  | "proposal_outcome"
  | "competitor"
  | "buying_committee_shape"
  | "message_theme"

export type GrowthInstitutionalAdvisoryPattern = {
  dimension: GrowthInstitutionalAdvisoryDimension
  dimensionValue: string
  advisory: string
  confidence: number
  sampleSize: number
  freshnessDays: number
  applicability: string
  polarity: "positive" | "negative" | "neutral"
}

export type GrowthInstitutionalOperatorInsight = {
  headline: string
  detail: string
  watchFor: string | null
  confidence: number
  sampleSize: number
}

export type GrowthInstitutionalAccountContext = {
  companyName: string
  industry?: string | null
  persona?: string | null
  contactTitle?: string | null
  companySize?: string | null
  relationshipStage?: string | null
  businessPressureKey?: string | null
  messageThemeKey?: string | null
  discoveryQuestionTheme?: string | null
  accountEvidenceThemes?: string[]
  employeeCount?: string | null
}

export type GrowthInstitutionalSalesIntelligence = {
  qaMarker: typeof GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_QA_MARKER
  readOnly: true
  advisoryOnly: true
  patterns: GrowthInstitutionalAdvisoryPattern[]
  applicablePatterns: GrowthInstitutionalAdvisoryPattern[]
  operatorInsights: GrowthInstitutionalOperatorInsight[]
  confidenceBoost: number
  channelHint: string | null
  conversationAngleHint: string | null
  discoveryOrderHint: string | null
  followUpCadenceHint: string | null
  objectionPriorityHint: string | null
  ctaHint: string | null
  hierarchyRespected: true
  rejectedPatterns: string[]
  /** INSTITUTIONAL-LEARNING-1B — refined pattern set applied. */
  refinementMarker?: typeof import("@/lib/growth/aios/growth/growth-institutional-learning-1b-types").GROWTH_AIOS_INSTITUTIONAL_LEARNING_1B_QA_MARKER
}
