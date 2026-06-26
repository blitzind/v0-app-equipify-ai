/** GE-AIOS-GROWTH-2C — Execution Simulation Engine service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  auditWorkflowBoundary,
  buildAllWorkflowBoundaryReports,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { buildGrowthLeadResearchFutureExecutionHandoffContracts } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"
import { resolveFutureExecutionHandoffInfrastructure } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"
import {
  buildAllWorkflowPreflightChecklists,
  buildPlanPreflightChecklist,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import {
  buildAllWorkflowExecutionSimulations,
  buildExecutionSimulationSystemSummary,
  buildPlanExecutionSimulation,
  GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_QA_MARKER,
  type GrowthLeadResearchExecutionSimulationReadModel,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-simulation-types"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"

function nowIso(): string {
  return new Date().toISOString()
}

export async function buildGrowthLeadResearchExecutionSimulation(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number; generatedAt?: string },
): Promise<GrowthLeadResearchExecutionSimulationReadModel> {
  const infrastructure = await resolveFutureExecutionHandoffInfrastructure(admin, {
    organizationId: input.organizationId,
  })

  const boundaries = buildAllWorkflowBoundaryReports(infrastructure)
  const workflowPreflights = buildAllWorkflowPreflightChecklists({ boundaries, infrastructure })
  const workflowSimulations = buildAllWorkflowExecutionSimulations({
    boundaries,
    workflowPreflights,
  })

  const preflightByWorkflow = new Map(workflowPreflights.map((row) => [row.workflowType, row]))
  const boundaryByWorkflow = new Map(boundaries.map((row) => [row.workflowType, row]))

  const handoffContracts = await buildGrowthLeadResearchFutureExecutionHandoffContracts(admin, {
    organizationId: input.organizationId,
    limit: input.limit,
    infrastructure,
    generatedAt: input.generatedAt ?? nowIso(),
  })

  const planSimulations = []
  for (const handoff of handoffContracts) {
    if (handoff.approvalState !== "approved_for_future_execution") continue

    const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId: handoff.leadId,
    })
    if (!snapshot?.executionPlan) continue

    const workflowType = handoff.recommendedWorkflow as GrowthLeadResearchCanonicalWorkflowType
    const workflowPreflight = preflightByWorkflow.get(workflowType)
    const boundary = boundaryByWorkflow.get(workflowType) ?? auditWorkflowBoundary(workflowType, infrastructure)
    if (!workflowPreflight) continue

    const planPreflight = buildPlanPreflightChecklist({ handoff, workflowChecklist: workflowPreflight })

    planSimulations.push(
      buildPlanExecutionSimulation({
        plan: snapshot.executionPlan,
        planId: handoff.planId,
        leadId: handoff.leadId,
        companyName: handoff.companyName,
        approvalState: handoff.approvalState,
        readinessState: handoff.readinessState,
        boundary,
        workflowPreflight,
        planPreflight,
        handoff,
        observationHref: handoff.observationHref,
      }),
    )
  }

  const allSimulations = [...workflowSimulations, ...planSimulations]

  return {
    readOnly: true,
    qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_QA_MARKER,
    generatedAt: input.generatedAt ?? nowIso(),
    workflowSimulations,
    planSimulations,
    systemSummary: buildExecutionSimulationSystemSummary({ simulations: allSimulations }),
  }
}
