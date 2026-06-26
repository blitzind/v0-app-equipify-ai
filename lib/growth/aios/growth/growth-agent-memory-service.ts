/** GE-AIOS-GROWTH-4D — Agent Memory service (server-only read aggregation). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildGrowthLeadResearchApprovedPlanReadinessQueue } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import { buildGrowthLeadResearchExecutionPlanApprovalQueue } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import {
  buildGrowthLeadResearchExecutionPlanId,
  resolveEffectiveExecutionPlanApprovalStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { fetchLatestExecutionPlanReviewForLead } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import {
  resolveApprovedPlanReadinessReason,
  resolveApprovedPlanReadinessState,
  resolveFutureExecutionSummary,
  summarizeExecutionPlanAuditTrail,
} from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import { buildGrowthLeadResearchExecutionPlanAuditTrail } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import {
  buildFutureExecutionHandoffContract,
  summarizeFutureExecutionHandoffContract,
} from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import { resolveFutureExecutionHandoffInfrastructure } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"
import {
  auditWorkflowBoundary,
  buildPlanExecutionBoundaryStatus,
  summarizePlanBoundaryStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import {
  buildPlanPreflightChecklist,
  buildWorkflowPreflightChecklist,
  summarizePlanPreflightChecklist,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import {
  buildPlanExecutionSimulation,
  summarizePlanExecutionSimulation,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-simulation-types"
import { getLatestDryRunReportForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"
import { summarizeDryRunReport } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import { findExecutionRuntimeRecordForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-service"
import { summarizeExecutionRuntimeRecord } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import { buildPilotEligibilityForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { RevenueOperatorPlanStateInput } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import { buildRevenueOperatorOrchestration, resolveOwningAgent } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-engine"
import {
  buildAgentEventQueueItem,
  buildAgentEventRecord,
  inferAgentEventTypeFromPlanState,
} from "@/lib/growth/aios/growth/growth-agent-event-engine"
import {
  buildAgentMemoryLeadBundle,
  buildAgentMemoryPlanContext,
  buildAgentMemoryReadModel,
  buildSharedAgentMemoryRecord,
  isAgentMemorySchedulerActive,
} from "@/lib/growth/aios/growth/growth-agent-memory-engine"
import type {
  GrowthAgentMemoryAggregationInput,
  GrowthAgentMemoryLeadBundle,
  GrowthAgentMemoryPlanContext,
  GrowthAgentMemoryReadModel,
} from "@/lib/growth/aios/growth/growth-agent-memory-types"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"

export {
  buildSharedAgentMemoryRecord,
  buildAgentMemoryLeadBundle,
  buildAgentMemoryReadModel,
  buildAgentMemoryPlanContext,
  scoreMemoryCompleteness,
  detectMemoryConflicts,
  buildAgentContextView,
  buildAllAgentContextViews,
  isAgentMemorySchedulerActive,
} from "@/lib/growth/aios/growth/growth-agent-memory-engine"

function nowIso(): string {
  return new Date().toISOString()
}

async function collectLeadIds(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const [approved, reviewQueue] = await Promise.all([
    buildGrowthLeadResearchApprovedPlanReadinessQueue(admin, { organizationId }),
    buildGrowthLeadResearchExecutionPlanApprovalQueue(admin, { organizationId }),
  ])
  const ids = new Set<string>()
  for (const row of approved) ids.add(row.leadId)
  for (const row of reviewQueue) ids.add(row.leadId)
  return [...ids].slice(0, 24)
}

export async function buildGrowthAgentMemoryAggregationInput(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAgentMemoryAggregationInput | null> {
  const generatedAt = input.generatedAt ?? nowIso()
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  if (!snapshot?.executionPlan) return null

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  const planId = buildGrowthLeadResearchExecutionPlanId({ leadId: input.leadId, plan: snapshot.executionPlan })
  const review = await fetchLatestExecutionPlanReviewForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  const approvalStatus = resolveEffectiveExecutionPlanApprovalStatus({
    plan: snapshot.executionPlan,
    review,
    planId,
  })
  const confidence =
    snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null

  const companySummary =
    snapshot.opportunityAssessment?.summary ??
    snapshot.evidenceSummary?.verifiedEvidence[0] ??
    lead?.companyName ??
    null

  const researchSummary =
    snapshot.workflowStatus !== "not_started"
      ? `Workflow ${snapshot.workflowStatus.replaceAll("_", " ")} — ${companySummary ?? "research in progress"}`
      : null

  const qualificationSummary = snapshot.qualification
    ? `Fit ${snapshot.qualification.fitScore} — ${snapshot.qualification.reason}`
    : null

  const opportunityAssessment = snapshot.opportunityAssessment?.summary ?? null
  const nextBestAction =
    snapshot.nextBestAction?.label ?? snapshot.executionPlan.nextBestAction ?? null

  const executionPlanSummary = `${snapshot.executionPlan.workflowType.replaceAll("_", " ")} · ${snapshot.executionPlan.executionReadiness.replaceAll("_", " ")} · ${snapshot.executionPlan.expectedOutcome}`

  let readinessState = null as string | null
  let handoffState = null as string | null
  let boundaryStatus = null as string | null
  let preflightStatus = null as string | null
  let simulationSummary = null as string | null
  let runtimeState = null as string | null
  let dryRunState = null as string | null
  let pilotState = null as string | null
  let futureExecutionEligible = null as boolean | null
  let pilotEligible = null as boolean | null
  let pilotBlockedReasons: string[] = []
  let preflightMissingRequirements: string[] = []
  let coreTouchRiskPresent = false
  const humanReviewRequirements: string[] = []
  const blockedReasons: string[] = []

  if (approvalStatus === "approved_for_future_execution") {
    const readiness = resolveApprovedPlanReadinessState({
      plan: snapshot.executionPlan,
      approvalStatus,
      confidence,
    })
    readinessState = readiness
    const futureExecution = resolveFutureExecutionSummary({
      plan: snapshot.executionPlan,
      readinessState: readiness,
    })
    futureExecutionEligible = futureExecution.eligible

    const handoffInfrastructure = await resolveFutureExecutionHandoffInfrastructure(admin, {
      organizationId: input.organizationId,
    })
    const auditTrail = await buildGrowthLeadResearchExecutionPlanAuditTrail(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      planId,
    })
    void summarizeExecutionPlanAuditTrail(auditTrail.entries)

    const handoffContract = buildFutureExecutionHandoffContract({
      planId,
      leadId: input.leadId,
      companyName: lead?.companyName ?? null,
      plan: snapshot.executionPlan,
      approvalState: approvalStatus,
      readinessState: readiness,
      readinessReason: resolveApprovedPlanReadinessReason(readiness, {
        plan: snapshot.executionPlan,
        approvalStatus,
        confidence,
      }),
      futureExecutionEligible: futureExecution.eligible,
      evidenceSummary: snapshot.evidenceSummary,
      auditTrail,
      infrastructure: handoffInfrastructure,
      generatedAt,
      observationHref:
        buildAiOsPilotLeadResearchHref(input.leadId) ??
        `/growth/os/pilot/lead-research/${input.leadId}`,
    })
    handoffState = handoffContract.handoffState
    void summarizeFutureExecutionHandoffContract(handoffContract)

    const workflowReport = auditWorkflowBoundary(
      snapshot.executionPlan.workflowType as GrowthLeadResearchCanonicalWorkflowType,
      handoffInfrastructure,
    )
    coreTouchRiskPresent = workflowReport.coreTouchRisk === "high" || workflowReport.coreTouchRisk === "medium"
    const planBoundary = buildPlanExecutionBoundaryStatus({ handoff: handoffContract, workflowReport })
    boundaryStatus = summarizePlanBoundaryStatus(planBoundary)
    const workflowPreflight = buildWorkflowPreflightChecklist({
      boundary: workflowReport,
      infrastructure: handoffInfrastructure,
    })
    const planPreflight = buildPlanPreflightChecklist({
      handoff: handoffContract,
      workflowChecklist: workflowPreflight,
    })
    preflightStatus = planPreflight.preflightStatus
    preflightMissingRequirements = planPreflight.missingRequirements
    void summarizePlanPreflightChecklist(planPreflight)

    const planSimulation = buildPlanExecutionSimulation({
      plan: snapshot.executionPlan,
      planId,
      leadId: input.leadId,
      companyName: lead?.companyName ?? null,
      approvalState: approvalStatus,
      readinessState: readiness,
      boundary: workflowReport,
      workflowPreflight,
      planPreflight,
      handoff: handoffContract,
      observationHref:
        buildAiOsPilotLeadResearchHref(input.leadId) ??
        `/growth/os/pilot/lead-research/${input.leadId}`,
    })
    simulationSummary = summarizePlanExecutionSimulation(planSimulation)
  }

  const runtimeRecord = await findExecutionRuntimeRecordForPlan(admin, {
    organizationId: input.organizationId,
    planId,
  })
  if (runtimeRecord) {
    runtimeState = runtimeRecord.state
    void summarizeExecutionRuntimeRecord(runtimeRecord)
  }

  const latestDryRun = getLatestDryRunReportForPlan(planId)
  if (latestDryRun) {
    dryRunState = latestDryRun.finalStatus
    void summarizeDryRunReport(latestDryRun)
  } else {
    dryRunState = "not_run"
  }

  const pilotEligibility = await buildPilotEligibilityForPlan(admin, {
    organizationId: input.organizationId,
    planId,
    executionPlan: snapshot.executionPlan,
    approvalState: approvalStatus,
    confidence,
  })
  pilotEligible = pilotEligibility.pilotEligible
  pilotBlockedReasons = pilotEligibility.pilotBlockedReasons
  pilotState = pilotEligibility.pilotSummary

  if (readinessState?.startsWith("blocked")) {
    blockedReasons.push(`Readiness blocked: ${readinessState.replaceAll("_", " ")}`)
    humanReviewRequirements.push("Resolve readiness blockers.")
  }
  if (preflightStatus === "preflight_blocked") {
    blockedReasons.push("Preflight blocked.")
    humanReviewRequirements.push("Complete preflight checklist.")
  }
  if (snapshot.executionPlan.workflowType === "outreach_generation") {
    blockedReasons.push("Outreach workflow blocked in 4D.")
  }
  blockedReasons.push(...pilotBlockedReasons)

  const planState: RevenueOperatorPlanStateInput = {
    leadId: input.leadId,
    companyId: input.leadId,
    companyName: lead?.companyName ?? null,
    planId,
    workflowType: snapshot.executionPlan.workflowType,
    approvalStatus,
    readinessState: readinessState as RevenueOperatorPlanStateInput["readinessState"],
    preflightStatus: preflightStatus as RevenueOperatorPlanStateInput["preflightStatus"],
    pilotEligible: pilotEligible ?? undefined,
    pilotBlockedReasons,
    runtimeState: runtimeState as RevenueOperatorPlanStateInput["runtimeState"],
    latestDryRunStatus: latestDryRun?.finalStatus ?? null,
    confidence,
    generatedAt,
  }

  const orchestration = buildRevenueOperatorOrchestration(planState)
  const eventType = inferAgentEventTypeFromPlanState({
    workflowType: snapshot.executionPlan.workflowType,
    approvalStatus,
    readinessState: planState.readinessState,
    latestDryRunStatus: latestDryRun?.finalStatus ?? null,
    runtimeState: planState.runtimeState,
  })
  const event = buildAgentEventRecord({
    eventType,
    source: "plan_state",
    timestamp: generatedAt,
    leadId: input.leadId,
    companyName: lead?.companyName ?? null,
    workflowType: snapshot.executionPlan.workflowType,
    triggeringReason: "Shared memory event index.",
    planState,
    blockedReasons: pilotBlockedReasons,
  })
  const eventQueueItem = buildAgentEventQueueItem({ event, planState })

  return {
    leadId: input.leadId,
    companyId: input.leadId,
    companyName: lead?.companyName ?? null,
    companySummary,
    researchSummary,
    qualificationSummary,
    opportunityAssessment,
    nextBestAction,
    executionPlanSummary,
    workflowType: snapshot.executionPlan.workflowType,
    approvalState: approvalStatus,
    readinessState,
    handoffState,
    boundaryStatus,
    preflightStatus,
    simulationSummary,
    runtimeState,
    dryRunState,
    pilotState,
    owningAgent: resolveOwningAgent(planState),
    routedEvents: [eventQueueItem.eventType.replaceAll("_", " ")],
    revenueOperatorRecommendation: orchestration.record.recommendedNextAction,
    blockedReasons,
    humanReviewRequirements,
    confidence,
    lastUpdatedAt: snapshot.updatedAt ?? generatedAt,
    generatedAt,
    futureExecutionEligible,
    pilotEligible,
    pilotBlockedReasons,
    orchestrationDecision: orchestration.record.orchestrationDecision,
    preflightMissingRequirements,
    coreTouchRiskPresent,
    outboundRecommended:
      snapshot.executionPlan.workflowType === "outreach_generation" ||
      snapshot.nextBestAction?.kind === "generate_outreach_draft",
    workflowStatus: snapshot.workflowStatus,
  }
}

export async function buildGrowthAgentMemoryReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<GrowthAgentMemoryReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const leadIds = await collectLeadIds(admin, input.organizationId)
  const bundles: GrowthAgentMemoryLeadBundle[] = []

  for (const leadId of leadIds) {
    const aggregation = await buildGrowthAgentMemoryAggregationInput(admin, {
      organizationId: input.organizationId,
      leadId,
      generatedAt,
    })
    if (!aggregation) continue
    bundles.push(buildAgentMemoryLeadBundle(aggregation))
  }

  void isAgentMemorySchedulerActive()

  return buildAgentMemoryReadModel({ bundles, generatedAt })
}

export async function buildGrowthAgentMemoryPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAgentMemoryPlanContext | null> {
  const aggregation = await buildGrowthAgentMemoryAggregationInput(admin, input)
  if (!aggregation) return null
  return buildAgentMemoryPlanContext(buildAgentMemoryLeadBundle(aggregation))
}
