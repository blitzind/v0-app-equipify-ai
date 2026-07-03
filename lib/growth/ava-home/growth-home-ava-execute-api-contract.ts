/** GE-AVA-HOME-EXECUTION-1A — Ava Home safe execution API contract (client-safe). */

import type { OpportunityIntelligenceViewModel } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-view-model-types"
import type { GrowthHomeOpportunityIntelligenceResearchStatus } from "@/lib/growth/opportunity-intelligence/growth-home-opportunity-intelligence-api-contract"

export const GROWTH_AVA_HOME_EXECUTION_1A_QA_MARKER = "ge-ava-home-execution-1a-v1" as const

export const GROWTH_HOME_AVA_EXECUTE_ACTIONS = [
  "run_unified_intake",
  "start_research",
  "refresh_intelligence",
] as const

export type GrowthHomeAvaExecuteAction = (typeof GROWTH_HOME_AVA_EXECUTE_ACTIONS)[number]

export const GROWTH_HOME_AVA_EXECUTE_STATUSES = [
  "queued",
  "running",
  "completed",
  "skipped",
  "failed",
] as const

export type GrowthHomeAvaExecuteStatus = (typeof GROWTH_HOME_AVA_EXECUTE_STATUSES)[number]

export const GROWTH_HOME_AVA_RUN_INTAKE_LABEL = "Run intake workflow" as const
export const GROWTH_HOME_AVA_START_RESEARCH_LABEL = "Start AI research" as const
export const GROWTH_HOME_AVA_REFRESH_INTELLIGENCE_LABEL = "Refresh intelligence" as const

export const GROWTH_HOME_AVA_SAFE_EXECUTION_DISCLAIMER =
  "Ava can research and prepare recommendations, but she will not send outreach without approval." as const

export const GROWTH_HOME_AVA_EXECUTE_API_PATH = "/api/platform/growth/leads" as const

export type GrowthHomeAvaExecuteApiResponse = {
  ok: boolean
  qa_marker?: typeof GROWTH_AVA_HOME_EXECUTION_1A_QA_MARKER
  leadId?: string
  action?: GrowthHomeAvaExecuteAction
  status?: GrowthHomeAvaExecuteStatus
  readOnly?: boolean
  message?: string
  skipReason?: string | null
  auditEventId?: string | null
  workflow?: Record<string, unknown> | null
  research?: {
    missionId?: string | null
    workOrderId?: string | null
    researchRunId?: string | null
    workflowStatus?: string | null
  } | null
  viewModel?: OpportunityIntelligenceViewModel
  researchStatus?: GrowthHomeOpportunityIntelligenceResearchStatus
}

export function growthHomeAvaExecuteHref(leadId: string): string {
  return `${GROWTH_HOME_AVA_EXECUTE_API_PATH}/${encodeURIComponent(leadId)}/ava-execute`
}
