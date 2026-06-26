/** GE-AIOS-GROWTH-2B — Execution Guardrail Preflight Checklist service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildAllWorkflowBoundaryReports,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { buildGrowthLeadResearchFutureExecutionHandoffContracts } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"
import { resolveFutureExecutionHandoffInfrastructure } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"
import {
  buildAllWorkflowPreflightChecklists,
  buildExecutionPreflightSystemSummary,
  buildPlanPreflightChecklist,
  GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_QA_MARKER,
  type GrowthLeadResearchExecutionPreflightReadModel,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"

function nowIso(): string {
  return new Date().toISOString()
}

export async function buildGrowthLeadResearchExecutionPreflightChecklist(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number; generatedAt?: string },
): Promise<GrowthLeadResearchExecutionPreflightReadModel> {
  const infrastructure = await resolveFutureExecutionHandoffInfrastructure(admin, {
    organizationId: input.organizationId,
  })

  const boundaries = buildAllWorkflowBoundaryReports(infrastructure)
  const workflowChecklists = buildAllWorkflowPreflightChecklists({ boundaries, infrastructure })

  const checklistByWorkflow = new Map(
    workflowChecklists.map((checklist) => [checklist.workflowType, checklist]),
  )

  const handoffContracts = await buildGrowthLeadResearchFutureExecutionHandoffContracts(admin, {
    organizationId: input.organizationId,
    limit: input.limit,
    infrastructure,
    generatedAt: input.generatedAt ?? nowIso(),
  })

  const planChecklists = handoffContracts.map((handoff) => {
    const workflowType = handoff.recommendedWorkflow as GrowthLeadResearchCanonicalWorkflowType
    const workflowChecklist =
      checklistByWorkflow.get(workflowType) ?? workflowChecklists[0]

    return buildPlanPreflightChecklist({ handoff, workflowChecklist })
  })

  return {
    readOnly: true,
    qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_QA_MARKER,
    generatedAt: input.generatedAt ?? nowIso(),
    workflowChecklists,
    planChecklists,
    systemSummary: buildExecutionPreflightSystemSummary({ workflowChecklists }),
  }
}
