/** GE-AIOS-GROWTH-4E — Mission & Goal Planning service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthLeadResearchApprovedPlanReadinessQueue } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import { buildGrowthLeadResearchExecutionPlanApprovalQueue } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import { buildGrowthAgentMemoryAggregationInput } from "@/lib/growth/aios/growth/growth-agent-memory-service"
import { buildSharedAgentMemoryRecord } from "@/lib/growth/aios/growth/growth-agent-memory-engine"
import {
  buildMissionFrameworkReadModel,
  buildMissionPlanContext,
  deriveMissionsForLead,
  isMissionFrameworkSchedulerActive,
} from "@/lib/growth/aios/growth/growth-mission-framework-engine"
import type {
  GrowthMissionDerivationInput,
  GrowthMissionFrameworkReadModel,
  GrowthMissionPlanContext,
  GrowthMissionRecord,
} from "@/lib/growth/aios/growth/growth-mission-framework-types"

export {
  buildMissionRecord,
  deriveMissionsForLead,
  deriveMissionTypesForLead,
  decomposeMission,
  resolveMissionDependencies,
  assessMissionHealth,
  planMissions,
  buildMissionFrameworkReadModel,
  buildMissionPlanContext,
  getMissionDefinition,
  isMissionFrameworkSchedulerActive,
} from "@/lib/growth/aios/growth/growth-mission-framework-engine"

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

function toDerivationInput(
  aggregation: NonNullable<Awaited<ReturnType<typeof buildGrowthAgentMemoryAggregationInput>>>,
  generatedAt: string,
): GrowthMissionDerivationInput {
  const memory = buildSharedAgentMemoryRecord(aggregation)
  return {
    leadId: aggregation.leadId,
    companyId: aggregation.companyId,
    companyName: aggregation.companyName,
    workflowType: aggregation.workflowType ?? null,
    workflowStatus: aggregation.workflowStatus ?? null,
    researchSummary: aggregation.researchSummary ?? null,
    qualificationSummary: aggregation.qualificationSummary ?? null,
    opportunityAssessment: aggregation.opportunityAssessment ?? null,
    nextBestAction: aggregation.nextBestAction ?? null,
    approvalState: aggregation.approvalState ?? null,
    readinessState: aggregation.readinessState ?? null,
    runtimeState: aggregation.runtimeState ?? null,
    dryRunState: aggregation.dryRunState ?? null,
    owningAgent: aggregation.owningAgent,
    revenueOperatorRecommendation: aggregation.revenueOperatorRecommendation ?? null,
    blockedReasons: aggregation.blockedReasons ?? [],
    humanReviewRequirements: aggregation.humanReviewRequirements ?? [],
    confidence: aggregation.confidence ?? null,
    completenessState: memory.completenessState,
    orchestrationDecision: aggregation.orchestrationDecision ?? null,
    outboundRecommended: aggregation.outboundRecommended ?? false,
    lastUpdatedAt: aggregation.lastUpdatedAt,
    generatedAt,
  }
}

export async function buildGrowthMissionDerivationInput(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthMissionDerivationInput | null> {
  const generatedAt = input.generatedAt ?? nowIso()
  const aggregation = await buildGrowthAgentMemoryAggregationInput(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt,
  })
  if (!aggregation) return null
  return toDerivationInput(aggregation, generatedAt)
}

export async function buildGrowthMissionsForLead(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthMissionRecord[]> {
  const derivation = await buildGrowthMissionDerivationInput(admin, input)
  if (!derivation) return []
  return deriveMissionsForLead(derivation)
}

export async function buildGrowthMissionFrameworkReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<GrowthMissionFrameworkReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const leadIds = await collectLeadIds(admin, input.organizationId)
  const missions: GrowthMissionRecord[] = []

  for (const leadId of leadIds) {
    missions.push(
      ...(await buildGrowthMissionsForLead(admin, {
        organizationId: input.organizationId,
        leadId,
        generatedAt,
      })),
    )
  }

  void isMissionFrameworkSchedulerActive()

  return buildMissionFrameworkReadModel({ missions, generatedAt })
}

export async function buildGrowthMissionPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthMissionPlanContext | null> {
  const missions = await buildGrowthMissionsForLead(admin, input)
  return buildMissionPlanContext(missions)
}
