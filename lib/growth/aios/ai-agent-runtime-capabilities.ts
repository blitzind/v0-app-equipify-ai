/** GE-AIOS-2C — Default constitutional agent capability map (client-safe). §12.3 */

import type { AiOsRuntimeAgent } from "@/lib/growth/aios/ai-agent-runtime-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

/** Primary owner → work order types (constitutional §12.3). */
export const AI_OS_DEFAULT_AGENT_CAPABILITIES: Readonly<
  Record<AiOsRuntimeAgent, readonly AiWorkOrderType[]>
> = {
  prospecting: [],
  research: ["research_company", "generate_buying_committee"],
  qualification: ["verify_email"],
  strategy: ["pause_sequence"],
  personalization: ["generate_email", "generate_video"],
  outreach: ["enroll_sequence", "pause_sequence"],
  conversation: ["analyze_reply"],
  meeting: ["prepare_meeting"],
  opportunity: ["create_opportunity"],
  learning: ["update_memory", "run_learning_cycle"],
  executive_reporting: [],
  compliance: [],
  budget: [],
  provider: [],
  warmup: [],
  deliverability: [],
}

export function defaultCapabilitiesForAgent(agentKey: AiOsRuntimeAgent): AiWorkOrderType[] {
  return [...(AI_OS_DEFAULT_AGENT_CAPABILITIES[agentKey] ?? [])]
}

export function agentOwnsWorkOrderType(input: {
  agentKey: AiOsRuntimeAgent
  workOrderType: AiWorkOrderType
  assignedAgent: AiOsRuntimeAgent | string
}): boolean {
  if (input.agentKey !== input.assignedAgent) return false
  const defaults = defaultCapabilitiesForAgent(input.agentKey)
  if (defaults.includes(input.workOrderType)) return true
  return input.workOrderType === "custom"
}

export function aiAgentCapabilityCatalog() {
  return {
    agents: Object.keys(AI_OS_DEFAULT_AGENT_CAPABILITIES),
    mappings: { ...AI_OS_DEFAULT_AGENT_CAPABILITIES },
  }
}
