/** GE-AIOS-GROWTH-3B — Internal workflow dry-run service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"
import { buildGrowthLeadResearchApprovedPlanReadinessQueue } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { buildGrowthLeadResearchExecutionPlanId } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import {
  runInternalWorkflowDryRun,
  validateDryRunExecutionGates,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-engine"
import {
  buildDryRunEligibilityPreview,
  buildDryRunId,
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_RULE,
  type GrowthLeadResearchExecutionDryRunEligiblePlan,
  type GrowthLeadResearchExecutionDryRunReport,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import { isInternalMutationRuntimeWorkflow } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import { buildExecutionRuntimeValidation } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service"

const latestDryRunReportsByPlanId = new Map<string, GrowthLeadResearchExecutionDryRunReport>()

export function getLatestDryRunReportForPlan(planId: string): GrowthLeadResearchExecutionDryRunReport | null {
  return latestDryRunReportsByPlanId.get(planId) ?? null
}

export function rememberLatestDryRunReport(report: GrowthLeadResearchExecutionDryRunReport): void {
  latestDryRunReportsByPlanId.set(report.planId, report)
}

export async function buildDryRunGateValidation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    executionPlan: GrowthLeadResearchExecutionPlan
    approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
    confidence: number | null
  },
) {
  const runtimeValidation = await buildExecutionRuntimeValidation(admin, {
    organizationId: input.organizationId,
    executionPlan: input.executionPlan,
    approvalState: input.approvalState,
    confidence: input.confidence,
    runtimeEnabled: true,
  })

  if (!isInternalMutationRuntimeWorkflow(input.executionPlan.workflowType)) {
    return runtimeValidation
  }

  return validateDryRunExecutionGates({
    runtimeEnabled: true,
    workflowType: input.executionPlan.workflowType,
    approvalState: input.approvalState,
    readinessState: runtimeValidation.gateSnapshot.readinessState,
    handoffState: runtimeValidation.gateSnapshot.handoffState,
    preflightStatus: runtimeValidation.gateSnapshot.preflightStatus,
    boundaryClassification: runtimeValidation.gateSnapshot.boundaryClassification,
    runtimeImplementationAllowed: runtimeValidation.gateSnapshot.runtimeImplementationAllowed,
    futureExecutionAllowed: runtimeValidation.gateSnapshot.futureExecutionAllowed,
  })
}

export async function runGrowthLeadResearchExecutionDryRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    planId: string
    leadId: string
    executionPlan: GrowthLeadResearchExecutionPlan
    approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
    confidence: number | null
    now?: string
  },
): Promise<GrowthLeadResearchExecutionDryRunReport> {
  const validation = await buildDryRunGateValidation(admin, {
    organizationId: input.organizationId,
    executionPlan: input.executionPlan,
    approvalState: input.approvalState,
    confidence: input.confidence,
  })

  const report = runInternalWorkflowDryRun({
    organizationId: input.organizationId,
    planId: input.planId,
    leadId: input.leadId,
    executionPlan: input.executionPlan,
    validation,
    now: input.now,
    dryRunId: buildDryRunId(input.planId, input.now),
  })

  rememberLatestDryRunReport(report)
  return report
}

export async function buildDryRunEligiblePlans(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthLeadResearchExecutionDryRunEligiblePlan[]> {
  const approvedPlans = await buildGrowthLeadResearchApprovedPlanReadinessQueue(admin, {
    organizationId: input.organizationId,
    limit: input.limit ?? 24,
  })

  const eligible: GrowthLeadResearchExecutionDryRunEligiblePlan[] = []

  for (const item of approvedPlans) {
    if (!isInternalMutationRuntimeWorkflow(item.recommendedWorkflow as never)) continue

    const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId: item.leadId,
    })
    if (!snapshot?.executionPlan) continue

    const plan = snapshot.executionPlan
    const planId = buildGrowthLeadResearchExecutionPlanId({ leadId: item.leadId, plan })
    const confidence = snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null

    eligible.push({
      planId,
      leadId: item.leadId,
      companyName: item.companyName,
      workflowType: plan.workflowType as GrowthLeadResearchExecutionDryRunEligiblePlan["workflowType"],
      approvalState: item.approvalState,
      confidence,
      executionPlan: plan,
      observationHref: buildAiOsPilotLeadResearchHref(item.leadId),
    })
  }

  return eligible
}

export async function buildDryRunEligibilityForPlan(
  admin: SupabaseClient,
  input: {
    organizationId: string
    executionPlan: GrowthLeadResearchExecutionPlan
    approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
    confidence: number | null
    planId: string
  },
) {
  const validation = isInternalMutationRuntimeWorkflow(input.executionPlan.workflowType)
    ? await buildDryRunGateValidation(admin, {
        organizationId: input.organizationId,
        executionPlan: input.executionPlan,
        approvalState: input.approvalState,
        confidence: input.confidence,
      })
    : null

  const preview = buildDryRunEligibilityPreview({
    workflowType: input.executionPlan.workflowType,
    validation,
  })

  const latestDryRunReport = getLatestDryRunReportForPlan(input.planId)

  return {
    dryRunEligible: preview.eligible,
    dryRunSummary: latestDryRunReport ? `${preview.summary} Latest: ${latestDryRunReport.finalStatus.replaceAll("_", " ")}.` : preview.summary,
    dryRunBlockedReasons: latestDryRunReport?.blockedReasons.length
      ? latestDryRunReport.blockedReasons
      : preview.blockedReasons,
    latestDryRunStatus: latestDryRunReport?.finalStatus ?? null,
  }
}

export const GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_SERVICE_METADATA = {
  qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER,
  dryRunRule: GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_RULE,
} as const
