/** GE-AIOS-NEXT-3E — Production organizational learning certification loader (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listRevenueDirectorWorkflowRequestsForOrganization } from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-repository"
import { fetchOrganizationMemoryStore } from "@/lib/growth/memory/storage/organization-memory-repository"
import { loadGrowthHomeAvaRecommendationAccountabilityFromProduction } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-production-loader-next-3d"
import { buildExecutiveReasoningFromEvidenceCompleteness } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c"
import { loadGrowthOrganizationalEffectivenessBaselineFromProduction } from "@/lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-production-loader-next-3a"
import { loadGrowthOrganizationalEvidenceCompletenessFromProduction } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-production-loader-next-3b"
import {
  buildGrowthOrganizationalLearningCertificationNext3e,
  buildGrowthOrganizationalLearningProductionConclusions,
} from "@/lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e"
import type { GrowthOrganizationalLearningCertificationSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e-types"

export const GROWTH_AIOS_NEXT_3E_PRODUCTION_LOADER_QA_MARKER =
  "ge-aios-next-3e-organizational-learning-certification-production-loader-v1" as const

export async function loadGrowthOrganizationalLearningCertificationFromProduction(input: {
  admin: SupabaseClient
  organizationId: string
  observationHours?: number
  outboundDisabled?: boolean
}): Promise<{
  qaMarker: typeof GROWTH_AIOS_NEXT_3E_PRODUCTION_LOADER_QA_MARKER
  readOnly: true
  certification: GrowthOrganizationalLearningCertificationSnapshot
  productionConclusions: ReturnType<typeof buildGrowthOrganizationalLearningProductionConclusions>
}> {
  const generatedAt = new Date().toISOString()
  const observationHours = input.observationHours ?? 24
  const sinceIso = new Date(Date.now() - observationHours * 60 * 60 * 1000).toISOString()

  const [baseline, evidence, accountabilityPayload, memoryPayload, workflowRequests] = await Promise.all([
    loadGrowthOrganizationalEffectivenessBaselineFromProduction({
      admin: input.admin,
      organizationId: input.organizationId,
      observationHours,
    }),
    loadGrowthOrganizationalEvidenceCompletenessFromProduction({
      admin: input.admin,
      organizationId: input.organizationId,
      observationHours,
    }),
    loadGrowthHomeAvaRecommendationAccountabilityFromProduction({
      admin: input.admin,
      organizationId: input.organizationId,
      observationHours,
      outboundDisabled: input.outboundDisabled,
    }),
    fetchOrganizationMemoryStore(input.admin, {
      organizationId: input.organizationId,
      generatedAt,
      limit: 200,
    }),
    listRevenueDirectorWorkflowRequestsForOrganization(input.admin, {
      organizationId: input.organizationId,
      limit: 100,
    }).catch(() => []),
  ])

  const reasoning = buildExecutiveReasoningFromEvidenceCompleteness(evidence.snapshot, {
    outboundDisabled: input.outboundDisabled ?? true,
    pendingApprovals: evidence.snapshot.operatorDecisionHistory.pendingApprovals,
  })

  const memoryEvents = memoryPayload.store.events.filter((event) => event.timestamp >= sinceIso)

  const certification = buildGrowthOrganizationalLearningCertificationNext3e({
    organizationId: input.organizationId,
    generatedAt,
    accountability: accountabilityPayload.accountability,
    evidenceCompleteness: evidence.snapshot,
    baselineSnapshot: baseline.snapshot,
    baselineEvidence: baseline.rawEvidence,
    executiveReasoning: reasoning,
    memoryEvents,
    workflowRequests,
    outboundDisabled: input.outboundDisabled ?? true,
  })

  return {
    qaMarker: GROWTH_AIOS_NEXT_3E_PRODUCTION_LOADER_QA_MARKER,
    readOnly: true,
    certification,
    productionConclusions: buildGrowthOrganizationalLearningProductionConclusions(certification),
  }
}
