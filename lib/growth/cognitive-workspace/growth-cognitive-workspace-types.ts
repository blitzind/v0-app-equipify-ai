/** GE-AIOS-25A-1 — Ava Cognitive Workspace (client-safe types). */

export const GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER =
  "ge-aios-25a-1-ava-cognitive-workspace-v1" as const

export const GROWTH_AVA_COGNITIVE_WORKSPACE_RULE =
  "presentation-only: compose existing drawer data; no LLM; no new APIs; no schema" as const

export const GROWTH_AVA_COGNITIVE_SECTION_ORDER = [
  "assessment",
  "why_i_believe",
  "evidence",
  "execution_plan",
  "research_journal",
  "operational_state",
  "activity_timeline",
  "human_workspace",
  "raw_intelligence",
] as const

export type GrowthAvaCognitiveSectionId = (typeof GROWTH_AVA_COGNITIVE_SECTION_ORDER)[number]

export const GROWTH_AVA_COGNITIVE_SECTION_IDS: Record<GrowthAvaCognitiveSectionId, string> = {
  assessment: "ava-cognitive-assessment",
  why_i_believe: "ava-cognitive-why-i-believe",
  evidence: "ava-cognitive-evidence",
  execution_plan: "ava-cognitive-execution-plan",
  research_journal: "ava-cognitive-research-journal",
  operational_state: "ava-cognitive-operational-state",
  activity_timeline: "ava-cognitive-activity-timeline",
  human_workspace: "ava-cognitive-human-workspace",
  raw_intelligence: "ava-cognitive-raw-intelligence",
}

export const GROWTH_AVA_COGNITIVE_SECTION_TITLES: Record<GrowthAvaCognitiveSectionId, string> = {
  assessment: "Ava's Current Assessment",
  why_i_believe: "Why I Believe This",
  evidence: "Evidence",
  execution_plan: "Execution Plan",
  research_journal: "Research Journal",
  operational_state: "Operational State",
  activity_timeline: "Activity Timeline",
  human_workspace: "Human Workspace",
  raw_intelligence: "Raw Intelligence",
}

/** Focus keys that should expand Raw Intelligence when deep-linking. */
export const GROWTH_AVA_RAW_INTELLIGENCE_FOCUS_TARGETS = [
  "executive",
  "revenue",
  "conversation",
  "relationship",
  "capacity",
  "call-copilot",
  "realtime-call",
  "sequence",
  "ai-copilot",
  "research",
  "meetings",
  "execution",
] as const

export type GrowthAvaAccountStatusLabel =
  | "Active Pursuit"
  | "Monitoring"
  | "Awaiting Approval"
  | "In Conversation"
  | "Opportunity Active"
  | "Customer"
  | "Closed Lost"
  | "Archived"
  | "Researching"
  | "New"

export type GrowthAvaConfidenceMeasure = {
  label: string
  valuePercent: number | null
  measures: string
}

export type GrowthAvaCurrentAssessment = {
  accountStatus: GrowthAvaAccountStatusLabel
  briefingParagraphs: string[]
  conclusion: string | null
  recommendation: string | null
  objective: string | null
  confidence: GrowthAvaConfidenceMeasure | null
  matchRating: string | null
  opportunityLevel: string | null
  blocker: string | null
  operatorInvolvementRequired: boolean
  operatorInvolvementSummary: string
  lastUpdatedLabel: string | null
  lastUpdatedAt: string | null
}

export type GrowthAvaBelief = {
  id: string
  text: string
  sourceKey: string
}

export type GrowthAvaEvidenceFact = {
  id: string
  label: string
  value: string
  source?: string | null
  confidencePercent?: number | null
}

export type GrowthAvaResearchJournalEntry = {
  id: string
  at: string | null
  title: string
  detail: string | null
}

export type GrowthAvaOperationalItem = {
  id: string
  label: string
  value: string
  note?: string | null
}
