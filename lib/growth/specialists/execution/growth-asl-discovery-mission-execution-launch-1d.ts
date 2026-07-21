/** GE-AIOS-LAUNCH-1D — Wire discovery work items to existing mission runtime orchestration. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadGrowthHomeMissionDiscoveryObjectives } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import { runGrowthMissionRuntimeOrchestration } from "@/lib/growth/mission-center/growth-mission-runtime-orchestrator"
import {
  GROWTH_ASL_DISCOVERY_MISSION_EXECUTION_LAUNCH_1D_QA_MARKER,
  resolveDiscoveryMissionSourceId,
} from "@/lib/growth/specialists/execution/growth-asl-discovery-mission-work-items-launch-1d"
import type { ExecuteSalesWorkflowAgentResult } from "@/lib/growth/specialists/execution/execute-sales-workflow-agent"
import type { SalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export { GROWTH_ASL_DISCOVERY_MISSION_EXECUTION_LAUNCH_1D_QA_MARKER }

function buildDiscoveryMissionOutcome(input: {
  workItem: AvaWorkItem
  generatedAt: string
  summary: string
}): SalesOutcome {
  return {
    work_item_id: input.workItem.id,
    company_id: null,
    person_id: null,
    relationship_stage: null,
    outcome_type: "research_completed",
    confidence: 72,
    completed_by: "research_agent",
    validated_by: "sales_specialist",
    completed_at: input.generatedAt,
    summary: input.summary,
    generated_artifacts: [],
    approval_required: false,
    recommended_next_action: null,
    memory_events: [],
  }
}

/** Invokes the same mission orchestrator the objective scheduler uses — no new discovery engine. */
export async function executeDiscoveryMissionWorkItem(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workItem: AvaWorkItem
    generatedAt: string
  },
): Promise<ExecuteSalesWorkflowAgentResult> {
  const objectives = await loadGrowthHomeMissionDiscoveryObjectives(admin, input.organizationId)
  const objective = objectives[0] ?? null
  if (!objective) {
    return {
      executed: false,
      workflow_agent: "research_agent",
      skip_reason: "mission_objective_not_found",
    }
  }

  const orchestration = await runGrowthMissionRuntimeOrchestration(
    admin,
    input.organizationId,
    objective.id,
  )

  if (!orchestration.ran) {
    return {
      executed: false,
      workflow_agent: "research_agent",
      skip_reason: orchestration.skippedReason ?? "mission_orchestration_skipped",
    }
  }

  const discoverySource = resolveDiscoveryMissionSourceId(input.workItem)
  const summary =
    orchestration.activityLabel?.trim() ||
    (discoverySource === "discovery:prospect_search"
      ? "Prospect search cycle completed."
      : discoverySource === "discovery:refresh_audience"
        ? "Audience refresh cycle completed."
        : "Discovery cycle completed.")

  return {
    executed: true,
    workflow_agent: "research_agent",
    outcome: buildDiscoveryMissionOutcome({
      workItem: input.workItem,
      generatedAt: input.generatedAt,
      summary,
    }),
  }
}
