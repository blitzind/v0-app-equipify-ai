/** GE-AIOS-GROWTH-2A — Execution Runtime Boundary Audit service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildAllWorkflowBoundaryReports,
  buildExecutionBoundarySystemSummary,
  buildPlanExecutionBoundaryStatus,
  GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_QA_MARKER,
  GROWTH_LEAD_RESEARCH_WORKFLOW_BOUNDARY_CATALOG,
  type GrowthLeadResearchExecutionBoundaryAuditReadModel,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { buildGrowthLeadResearchFutureExecutionHandoffContracts } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"
import { resolveFutureExecutionHandoffInfrastructure } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"

function nowIso(): string {
  return new Date().toISOString()
}

export async function buildGrowthLeadResearchExecutionBoundaryAudit(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number; generatedAt?: string },
): Promise<GrowthLeadResearchExecutionBoundaryAuditReadModel> {
  const infrastructure = await resolveFutureExecutionHandoffInfrastructure(admin, {
    organizationId: input.organizationId,
  })

  const workflowReports = buildAllWorkflowBoundaryReports(infrastructure)
  const systemSummary = buildExecutionBoundarySystemSummary({ workflowReports, infrastructure })

  const handoffContracts = await buildGrowthLeadResearchFutureExecutionHandoffContracts(admin, {
    organizationId: input.organizationId,
    limit: input.limit,
    infrastructure,
    generatedAt: input.generatedAt ?? nowIso(),
  })

  const reportByWorkflow = new Map(
    workflowReports.map((report) => [report.workflowType, report]),
  )

  const planBoundaries = handoffContracts.map((handoff) => {
    const workflowType = handoff.recommendedWorkflow as GrowthLeadResearchCanonicalWorkflowType
    const workflowReport =
      reportByWorkflow.get(workflowType) ??
      workflowReports.find((report) => report.workflowType === workflowType) ??
      workflowReports[0]

    return buildPlanExecutionBoundaryStatus({ handoff, workflowReport })
  })

  return {
    readOnly: true,
    qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_QA_MARKER,
    generatedAt: input.generatedAt ?? nowIso(),
    workflowReports,
    systemSummary,
    planBoundaries,
  }
}

/** Exposed for certification — verifies catalog covers all canonical workflow types. */
export function listAuditedWorkflowTypes(): GrowthLeadResearchCanonicalWorkflowType[] {
  return Object.keys(GROWTH_LEAD_RESEARCH_WORKFLOW_BOUNDARY_CATALOG) as GrowthLeadResearchCanonicalWorkflowType[]
}
