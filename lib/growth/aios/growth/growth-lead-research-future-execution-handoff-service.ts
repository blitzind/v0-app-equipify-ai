/** GE-AIOS-GROWTH-1F — Future Execution Handoff Contract service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateAiOsProviderHealth } from "@/lib/growth/aios/ai-provider-health"
import { buildGrowthLeadResearchApprovedPlanReadinessQueue } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  buildFutureExecutionHandoffContract,
  type GrowthLeadResearchFutureExecutionHandoffContract,
  type GrowthLeadResearchFutureExecutionHandoffInfrastructure,
} from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { isGrowthLeadResearchWorkflowEnabled } from "@/lib/growth/aios/pilot/lead-research-pilot-config"

function nowIso(): string {
  return new Date().toISOString()
}

export async function resolveFutureExecutionHandoffInfrastructure(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<GrowthLeadResearchFutureExecutionHandoffInfrastructure> {
  const [providerHealth, killSwitches] = await Promise.all([
    evaluateAiOsProviderHealth(admin, { organizationId: input.organizationId }),
    getRuntimeKillSwitchStates(admin, input.organizationId),
  ])

  return {
    providerReady: providerHealth.ready,
    availableProviderIds: providerHealth.providers
      .filter((provider) => provider.available)
      .map((provider) => provider.providerId),
    autonomyEnabled: Boolean(killSwitches.autonomy_enabled),
    emergencyStopActive: !killSwitches.autonomy_enabled,
    workflowFeatureEnabled: isGrowthLeadResearchWorkflowEnabled(),
  }
}

export async function buildGrowthLeadResearchFutureExecutionHandoffContracts(
  admin: SupabaseClient,
  input: {
    organizationId: string
    limit?: number
    infrastructure?: GrowthLeadResearchFutureExecutionHandoffInfrastructure
    generatedAt?: string
  },
): Promise<GrowthLeadResearchFutureExecutionHandoffContract[]> {
  const infrastructure =
    input.infrastructure ??
    (await resolveFutureExecutionHandoffInfrastructure(admin, { organizationId: input.organizationId }))

  const approvedPlans = await buildGrowthLeadResearchApprovedPlanReadinessQueue(admin, {
    organizationId: input.organizationId,
    limit: input.limit,
  })

  const generatedAt = input.generatedAt ?? nowIso()
  const contracts: GrowthLeadResearchFutureExecutionHandoffContract[] = []

  for (const item of approvedPlans) {
    const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId: item.leadId,
    })
    if (!snapshot?.executionPlan) continue

    contracts.push(
      buildFutureExecutionHandoffContract({
        planId: item.planId,
        leadId: item.leadId,
        companyName: item.companyName,
        plan: snapshot.executionPlan,
        approvalState: item.approvalState,
        readinessState: item.readinessState,
        readinessReason: item.readinessReason,
        futureExecutionEligible: item.futureExecutionEligible,
        evidenceSummary: item.evidenceSummary,
        auditTrail: item.auditTrail,
        infrastructure,
        generatedAt,
        observationHref: item.observationHref,
      }),
    )
  }

  return contracts
}
