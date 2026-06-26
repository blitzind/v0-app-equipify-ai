/** GE-AIOS-GROWTH-3C — Execution runtime pilot service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  buildGrowthLeadResearchExecutionPlanId,
  type GrowthLeadResearchExecutionPlanApprovalStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { resolveApprovedPlanReadinessState } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import { buildGrowthLeadResearchApprovedPlanReadinessQueue } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import {
  getLatestDryRunReportForPlan,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"
import {
  buildExecutionRuntimePilotSummary,
  isRuntimePilotWorkflow,
  validateExecutionRuntimePilotEnqueue,
  type GrowthLeadResearchExecutionRuntimePilotEnqueueValidation,
  type GrowthLeadResearchExecutionRuntimePilotPlanItem,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import {
  buildExecutionRuntimeValidation,
  resolveExecutionRuntimeEnabled,
  resolveExecutionRuntimePilotEnabled,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"

export { resolveExecutionRuntimePilotEnabled } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service"

export async function resolveExecutionRuntimeEffectiveEnabled(
  admin: SupabaseClient,
  input: { organizationId: string; runtimeOverride?: boolean; pilotOverride?: boolean },
): Promise<{ runtimeEnabled: boolean; pilotEnabled: boolean; effectiveRuntimeEnabled: boolean }> {
  const runtimeEnabled = await resolveExecutionRuntimeEnabled(admin, {
    organizationId: input.organizationId,
    override: input.runtimeOverride,
  })
  const pilotEnabled = await resolveExecutionRuntimePilotEnabled(admin, {
    organizationId: input.organizationId,
    override: input.pilotOverride,
  })
  return {
    runtimeEnabled,
    pilotEnabled,
    effectiveRuntimeEnabled: runtimeEnabled && pilotEnabled,
  }
}

export async function validateGrowthLeadResearchExecutionPilotEnqueue(
  admin: SupabaseClient,
  input: {
    organizationId: string
    planId: string
    leadId: string
    executionPlan: GrowthLeadResearchExecutionPlan
    approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
    confidence: number | null
    runtimeOverride?: boolean
    pilotOverride?: boolean
  },
): Promise<GrowthLeadResearchExecutionRuntimePilotEnqueueValidation> {
  const flags = await resolveExecutionRuntimeEffectiveEnabled(admin, {
    organizationId: input.organizationId,
    runtimeOverride: input.runtimeOverride,
    pilotOverride: input.pilotOverride,
  })

  const gateValidation = await buildExecutionRuntimeValidation(admin, {
    organizationId: input.organizationId,
    executionPlan: input.executionPlan,
    approvalState: input.approvalState,
    confidence: input.confidence,
    runtimeEnabled: flags.effectiveRuntimeEnabled,
  })

  const latestDryRun = getLatestDryRunReportForPlan(input.planId)

  return validateExecutionRuntimePilotEnqueue({
    pilotEnabled: flags.pilotEnabled,
    runtimeEnabled: flags.runtimeEnabled,
    workflowType: input.executionPlan.workflowType,
    gateValidation,
    dryRunStatus: latestDryRun?.finalStatus ?? null,
  })
}

async function buildPilotPlanItem(
  admin: SupabaseClient,
  input: {
    organizationId: string
    planId: string
    leadId: string
    companyName: string | null
    executionPlan: GrowthLeadResearchExecutionPlan
    approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
    confidence: number | null
    flags: Awaited<ReturnType<typeof resolveExecutionRuntimeEffectiveEnabled>>
  },
): Promise<GrowthLeadResearchExecutionRuntimePilotPlanItem> {
  const validation = await validateGrowthLeadResearchExecutionPilotEnqueue(admin, {
    organizationId: input.organizationId,
    planId: input.planId,
    leadId: input.leadId,
    executionPlan: input.executionPlan,
    approvalState: input.approvalState,
    confidence: input.confidence,
    runtimeOverride: input.flags.runtimeEnabled,
    pilotOverride: input.flags.pilotEnabled,
  })

  const latestDryRun = getLatestDryRunReportForPlan(input.planId)

  return {
    planId: input.planId,
    leadId: input.leadId,
    companyName: input.companyName,
    workflowType: input.executionPlan.workflowType,
    approvalState: input.approvalState,
    confidence: input.confidence,
    executionPlan: input.executionPlan,
    observationHref: buildAiOsPilotLeadResearchHref(input.leadId),
    dryRunRequired: true,
    latestDryRunStatus: latestDryRun?.finalStatus ?? null,
    enqueueAllowed: validation.allowed,
    blockReason: validation.blockReason,
  }
}

export async function buildExecutionRuntimePilotPlanQueues(
  admin: SupabaseClient,
  input: { organizationId: string; runtimeOverride?: boolean; pilotOverride?: boolean },
): Promise<{
  pilotSummary: ReturnType<typeof buildExecutionRuntimePilotSummary>
  pilotEligiblePlans: GrowthLeadResearchExecutionRuntimePilotPlanItem[]
  pilotBlockedPlans: GrowthLeadResearchExecutionRuntimePilotPlanItem[]
}> {
  const flags = await resolveExecutionRuntimeEffectiveEnabled(admin, {
    organizationId: input.organizationId,
    runtimeOverride: input.runtimeOverride,
    pilotOverride: input.pilotOverride,
  })
  const pilotSummary = buildExecutionRuntimePilotSummary(flags)

  const approvedPlans = await buildGrowthLeadResearchApprovedPlanReadinessQueue(admin, {
    organizationId: input.organizationId,
  })

  const pilotEligiblePlans: GrowthLeadResearchExecutionRuntimePilotPlanItem[] = []
  const pilotBlockedPlans: GrowthLeadResearchExecutionRuntimePilotPlanItem[] = []

  for (const item of approvedPlans) {
    const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId: item.leadId,
    })
    if (!snapshot?.executionPlan) continue

    const plan = snapshot.executionPlan
    const planId = buildGrowthLeadResearchExecutionPlanId({ leadId: item.leadId, plan })

    if (!isRuntimePilotWorkflow(plan.workflowType)) {
      pilotBlockedPlans.push({
        planId,
        leadId: item.leadId,
        companyName: item.companyName,
        workflowType: plan.workflowType,
        approvalState: item.approvalState,
        confidence: snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null,
        executionPlan: plan,
        observationHref: buildAiOsPilotLeadResearchHref(item.leadId),
        dryRunRequired: true,
        latestDryRunStatus: getLatestDryRunReportForPlan(planId)?.finalStatus ?? null,
        enqueueAllowed: false,
        blockReason: `Workflow ${plan.workflowType} is not enabled in the research_company pilot.`,
      })
      continue
    }

    const planItem = await buildPilotPlanItem(admin, {
      organizationId: input.organizationId,
      planId,
      leadId: item.leadId,
      companyName: item.companyName,
      executionPlan: plan,
      approvalState: item.approvalState,
      confidence: snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null,
      flags,
    })

    if (planItem.enqueueAllowed) {
      pilotEligiblePlans.push(planItem)
    } else {
      pilotBlockedPlans.push(planItem)
    }
  }

  return { pilotSummary, pilotEligiblePlans, pilotBlockedPlans }
}

export async function buildPilotEligibilityForPlan(
  admin: SupabaseClient,
  input: {
    organizationId: string
    planId: string
    executionPlan: GrowthLeadResearchExecutionPlan
    approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
    confidence: number | null
  },
) {
  const validation = await validateGrowthLeadResearchExecutionPilotEnqueue(admin, {
    organizationId: input.organizationId,
    planId: input.planId,
    leadId: "validation-only",
    executionPlan: input.executionPlan,
    approvalState: input.approvalState,
    confidence: input.confidence,
  })

  const latestDryRun = getLatestDryRunReportForPlan(input.planId)

  return {
    pilotEligible: isRuntimePilotWorkflow(input.executionPlan.workflowType) && validation.allowed,
    pilotSummary: validation.allowed
      ? "Eligible for research_company runtime pilot — dry-run passed and gates open."
      : validation.blockReason ?? "Not eligible for runtime pilot.",
    pilotBlockedReasons: validation.blockReason ? [validation.blockReason] : [],
    dryRunRequired: true,
    latestDryRunStatus: latestDryRun?.finalStatus ?? null,
    pilotEnabled: validation.pilotEnabled,
    runtimeEnabled: validation.runtimeEnabled,
  }
}
