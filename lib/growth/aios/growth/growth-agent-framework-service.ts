/** GE-AIOS-GROWTH-4A — Growth Agent Framework read service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthAgentDefinitions } from "@/lib/growth/aios/growth/growth-agent-framework-registry"
import {
  GROWTH_AGENT_FRAMEWORK_QA_MARKER,
  GROWTH_AGENT_FRAMEWORK_RULE,
  type GrowthAgentFrameworkReadModel,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"
import { isAgentSchedulerActive } from "@/lib/growth/aios/growth/growth-agent-framework-permissions"

function nowIso(): string {
  return new Date().toISOString()
}

export async function buildGrowthAgentFrameworkReadModel(
  _admin: SupabaseClient,
  input?: { generatedAt?: string },
): Promise<GrowthAgentFrameworkReadModel> {
  void _admin
  const agents = listGrowthAgentDefinitions()

  return {
    qaMarker: GROWTH_AGENT_FRAMEWORK_QA_MARKER,
    generatedAt: input?.generatedAt ?? nowIso(),
    rule: GROWTH_AGENT_FRAMEWORK_RULE,
    schedulerActive: isAgentSchedulerActive(),
    agents,
    summary: {
      totalAgents: agents.length,
      disabledAgents: agents.filter((agent) => agent.status === "disabled").length,
      definitionOnlyAgents: agents.filter((agent) => agent.capabilities.definitionOnly).length,
      dryRunEligibleAgents: agents.filter((agent) => agent.capabilities.dryRunEligible).length,
      internalRuntimeEligibleAgents: agents.filter((agent) => agent.capabilities.internalRuntimeEligible).length,
      outboundBlockedAgents: agents.filter((agent) => agent.capabilities.outboundBlocked).length,
      coreMutationBlockedAgents: agents.filter((agent) => agent.capabilities.coreMutationBlocked).length,
    },
  }
}
