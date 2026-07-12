/** GE-AIOS-6B — Ava Research Orchestrator API contract (client-safe). */

import {
  GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
  GROWTH_AVA_RESEARCH_QUEUE_API_PATH,
  GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL,
  type GrowthAvaResearchQueueRunResult,
} from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  resolveAiTeammatePresentation,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"

export {
  GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
  GROWTH_AVA_RESEARCH_QUEUE_API_PATH,
  GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL,
}

export type GrowthAvaResearchQueueApiResponse = GrowthAvaResearchQueueRunResult & {
  message?: string | null
}

export function growthResearchQueueSafetyDisclaimer(teammate: AiTeammatePresentation): string {
  return `${teammate.name} researches and qualifies leads internally. No outreach is sent without your approval.`
}
export const GROWTH_AVA_RESEARCH_QUEUE_SAFETY_DISCLAIMER =
  growthResearchQueueSafetyDisclaimer(resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME))

export { GROWTH_AVA_QUALIFICATION_WAITING_MESSAGE } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
