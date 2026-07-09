/** GE-AIOS-10B — Ava Decision Intelligence Engine types (client-safe). */

export const GROWTH_DECISION_ENGINE_QA_MARKER = "ge-aios-10b-decision-engine-v1" as const

export type DecisionActionKind =
  | "research_company"
  | "refresh_bi"
  | "prepare_outreach"
  | "review_reply"
  | "continue_qualification"
  | "request_business_clarification"
  | "meeting_prep"
  | "review_approval"
  | "continue_mission"
  | "wait"

export type DecisionCandidateSource =
  | "waiting_on_you"
  | "daily_work_queue"
  | "workspace_kpi"
  | "research_loop"
  | "mission"
  | "inbox"
  | "meeting"

export type DecisionCandidate = {
  id: string
  kind: DecisionActionKind
  title: string
  detail: string | null
  href: string | null
  companyName?: string | null
  source: DecisionCandidateSource
  severity?: number
  queuePriority?: "critical" | "high" | "medium" | "low"
  requiresHumanApproval?: boolean
  confidencePercent?: number | null
  estimatedMinutes?: number | null
  blocked?: boolean
  blockedBy?: string[]
  dependsOn?: string[]
  hotCompany?: boolean
  readyForOutreach?: boolean
  qualificationComplete?: boolean
  relationship_graph?: import("@/lib/growth/relationship/relationship-graph-types").AvaRelationshipGraphContext | null
}

export type DecisionContext = {
  opportunities: DecisionCandidate[]
  approvals: DecisionCandidate[]
  missions: DecisionCandidate[]
  inbox: DecisionCandidate[]
  research: DecisionCandidate[]
  meetings: DecisionCandidate[]
  businessUnderstanding: {
    hasApprovedProfile: boolean
    hasBusinessResearch: boolean
    profileIncomplete: boolean
  }
  evidenceConfidence: number | null
  memorySummary?: import("@/lib/growth/memory/types").AvaMemorySummary | null
  leadSnapshotsById?: import("@/lib/growth/relationship/relationship-lead-snapshot-types").RelationshipLeadSnapshotMap
}

export type DecisionScoreBreakdown = {
  revenue_impact: number
  customer_impact: number
  urgency: number
  confidence: number
  business_understanding: number
  dependencies: number
  effort: number
  approval_gate: number
}

export type DecisionExplainReason = {
  code: string
  label: string
}

export type NextBestAction = {
  id: string
  kind: DecisionActionKind
  title: string
  reason: DecisionExplainReason[]
  overall_score: number
  score_breakdown: DecisionScoreBreakdown
  depends_on: string[]
  blocked_by: string[]
  estimated_time_minutes: number | null
  requires_operator: boolean
  confidence: number
  href: string | null
  company_name: string | null
  source_id: string
  relationship_graph?: import("@/lib/growth/relationship/relationship-graph-types").AvaRelationshipGraphContext | null
}

export type DecisionEngineResult = {
  qaMarker: typeof GROWTH_DECISION_ENGINE_QA_MARKER
  context: DecisionContext
  next_best_actions: NextBestAction[]
  top_action: NextBestAction | null
}
