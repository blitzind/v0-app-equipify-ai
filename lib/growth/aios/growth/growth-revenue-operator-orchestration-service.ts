/** GE-AIOS-GROWTH-4B — Revenue Operator orchestration service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthLeadResearchApprovedPlanReadinessQueue } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import { buildGrowthLeadResearchExecutionPlanId } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { resolveEffectiveExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { fetchLatestExecutionPlanReviewForLead } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import { getLatestDryRunReportForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"
import { findExecutionRuntimeRecordForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-service"
import { buildPilotEligibilityForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  buildRevenueOperatorOrchestration,
  isRevenueOperatorSchedulerActive,
  resolveCandidateAgents,
  resolveOwningAgent,
  buildAgentHandoff,
} from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-engine"
import { bindRevenueOperatorOrchestrationToCanonicalAuthority } from "@/lib/growth/aios/growth/growth-revenue-operator-canonical-binding-1b"
import { buildCanonicalOpportunityAuthorityFromResolution } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-1b"
import { resolveGrowthCanonicalDecisionForLeadCached } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import type {
  RevenueOperatorOrchestrationEngineResult,
  RevenueOperatorPlanStateInput,
  RevenueOperatorReadModel,
} from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import {
  GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER,
  GROWTH_REVENUE_OPERATOR_ORCHESTRATION_RULE,
} from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"

export {
  resolveOwningAgent,
  resolveCandidateAgents,
  buildAgentHandoff,
  buildRevenueOperatorOrchestration,
} from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-engine"

function nowIso(): string {
  return new Date().toISOString()
}

export async function buildOrchestrationForPlanState(
  admin: SupabaseClient,
  input: RevenueOperatorPlanStateInput,
): Promise<RevenueOperatorOrchestrationEngineResult> {
  void admin
  return buildRevenueOperatorOrchestration(input)
}

export async function buildRevenueOperatorReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<RevenueOperatorReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const approvedPlans = await buildGrowthLeadResearchApprovedPlanReadinessQueue(admin, {
    organizationId: input.organizationId,
  })

  const orchestrations: RevenueOperatorOrchestrationEngineResult[] = []

  for (const item of approvedPlans.slice(0, 12)) {
    const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId: item.leadId,
    })
    if (!snapshot?.executionPlan) continue

    const planId = buildGrowthLeadResearchExecutionPlanId({ leadId: item.leadId, plan: snapshot.executionPlan })
    const review = await fetchLatestExecutionPlanReviewForLead(admin, {
      organizationId: input.organizationId,
      leadId: item.leadId,
    })
    const approvalStatus = resolveEffectiveExecutionPlanApprovalStatus({
      plan: snapshot.executionPlan,
      review,
      planId,
    })
    const pilotEligibility = await buildPilotEligibilityForPlan(admin, {
      organizationId: input.organizationId,
      planId,
      executionPlan: snapshot.executionPlan,
      approvalState: approvalStatus,
      confidence: item.confidence,
    })
    const runtimeRecord = await findExecutionRuntimeRecordForPlan(admin, {
      organizationId: input.organizationId,
      planId,
    })
    const latestDryRun = getLatestDryRunReportForPlan(planId)

    orchestrations.push(
      await (async () => {
        const base = buildRevenueOperatorOrchestration({
          leadId: item.leadId,
          companyId: item.leadId,
          companyName: item.companyName,
          planId,
          workflowType: snapshot.executionPlan.workflowType,
          approvalStatus,
          readinessState: item.readinessState,
          preflightStatus: null,
          pilotEligible: pilotEligibility.pilotEligible,
          pilotBlockedReasons: pilotEligibility.pilotBlockedReasons,
          runtimeState: runtimeRecord?.state ?? null,
          latestDryRunStatus: latestDryRun?.finalStatus ?? null,
          confidence: item.confidence,
          generatedAt,
        })

        const resolution = await resolveGrowthCanonicalDecisionForLeadCached(admin, {
          organizationId: input.organizationId,
          leadId: item.leadId,
          generatedAt,
        }).catch(() => null)

        const canonicalAuthority = resolution
          ? buildCanonicalOpportunityAuthorityFromResolution(resolution)
          : null

        return bindRevenueOperatorOrchestrationToCanonicalAuthority({
          result: base,
          canonicalAuthority,
        })
      })(),
    )
  }

  return {
    qaMarker: GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER,
    generatedAt,
    rule: GROWTH_REVENUE_OPERATOR_ORCHESTRATION_RULE,
    supervisorAgent: "revenue_operator_agent",
    schedulerActive: isRevenueOperatorSchedulerActive(),
    summary: {
      leadsEvaluated: orchestrations.length,
      humanReviewRequired: orchestrations.filter(
        (row) => row.record.orchestrationDecision === "human_review_required",
      ).length,
      blocked: orchestrations.filter((row) => row.record.orchestrationDecision === "blocked").length,
      executionReady: orchestrations.filter(
        (row) => row.record.orchestrationDecision === "handoff_to_execution",
      ).length,
    },
    orchestrations: orchestrations.map((row) => row.record),
  }
}

export async function buildRevenueOperatorPlanContext(
  admin: SupabaseClient,
  input: RevenueOperatorPlanStateInput,
): Promise<RevenueOperatorOrchestrationEngineResult> {
  return buildOrchestrationForPlanState(admin, input)
}
