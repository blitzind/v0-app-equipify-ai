/** GE-AIOS-5D — AI OS Daily Briefing read model (client-safe). */

export const GROWTH_AIOS_5D_PHASE = "GE-AIOS-5D" as const

export const GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER = "growth-aios-5d-daily-briefing-v1" as const

export type AiOsDailyBriefingImpactLevel = "high" | "medium" | "low"

export type AiOsDailyBriefingUrgencyLevel = "high" | "medium" | "low"

export type AiOsDailyBriefingActionItem = {
  id: string
  title: string
  reason: string
  impact: AiOsDailyBriefingImpactLevel
  urgency: AiOsDailyBriefingUrgencyLevel
  href: string | null
  linkLabel: string | null
}

export type AiOsDailyBriefingWin = {
  id: string
  title: string
  summary: string
  occurredAt: string
}

export type AiOsDailyBriefingRisk = {
  id: string
  label: string
  summary: string
  severity: "high" | "medium" | "low"
}

export type AiOsDailyBriefingSuggestedLinkCategory =
  | "planning_review"
  | "pilot_observation"
  | "objectives"
  | "leads"

export type AiOsDailyBriefingSuggestedLink = {
  id: string
  label: string
  href: string
  category: AiOsDailyBriefingSuggestedLinkCategory
}

export type AiOsDailyBriefing = {
  readOnly: true
  qaMarker: typeof GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER
  briefingId: string
  generatedAt: string
  executiveHeadline: string
  whatChangedSummary: string
  topPriorities: AiOsDailyBriefingActionItem[]
  needsApproval: AiOsDailyBriefingActionItem[]
  blockers: AiOsDailyBriefingActionItem[]
  recentWins: AiOsDailyBriefingWin[]
  risks: AiOsDailyBriefingRisk[]
  recommendedNextActions: AiOsDailyBriefingActionItem[]
  suggestedLinks: AiOsDailyBriefingSuggestedLink[]
}

export const AI_OS_DAILY_BRIEFING_RUNTIME_RULE =
  "AI OS Daily Briefing is advisory and read-only — it synthesizes existing Command Center data and never executes Work Orders, invokes providers, sends outbound, or mutates runtime state." as const
