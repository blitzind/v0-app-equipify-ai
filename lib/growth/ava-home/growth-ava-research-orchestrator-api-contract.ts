/** GE-AIOS-6B — Ava Research Orchestrator API contract (client-safe). */

import {
  GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
  GROWTH_AVA_RESEARCH_QUEUE_API_PATH,
  GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL,
  type GrowthAvaResearchQueueRunResult,
} from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"

export {
  GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
  GROWTH_AVA_RESEARCH_QUEUE_API_PATH,
  GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL,
}

export type GrowthAvaResearchQueueApiResponse = GrowthAvaResearchQueueRunResult & {
  message?: string | null
}

export const GROWTH_AVA_RESEARCH_QUEUE_SAFETY_DISCLAIMER =
  "Ava researches and qualifies leads internally. No outreach is sent without your approval." as const

export { GROWTH_AVA_QUALIFICATION_WAITING_MESSAGE } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
