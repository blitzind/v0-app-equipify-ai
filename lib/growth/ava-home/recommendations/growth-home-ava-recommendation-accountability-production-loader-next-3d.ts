/** GE-AIOS-NEXT-3D — Production accountability loader (server-only, read-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadGrowthOrganizationalEvidenceCompletenessFromProduction } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-production-loader-next-3b"
import { fetchOrganizationMemoryStore } from "@/lib/growth/memory/storage/organization-memory-repository"
import { buildExecutiveReasoningFromEvidenceCompleteness } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c"
import { buildGrowthHomeAvaRecommendationAccountabilityNext3d } from "./growth-home-ava-recommendation-accountability-next-3d"
import type { GrowthHomeAvaRecommendationAccountabilitySnapshot } from "./growth-home-ava-recommendation-accountability-next-3d-types"

export const GROWTH_AIOS_NEXT_3D_PRODUCTION_LOADER_QA_MARKER =
  "ge-aios-next-3d-recommendation-accountability-production-loader-v1" as const

export async function loadGrowthHomeAvaRecommendationAccountabilityFromProduction(input: {
  admin: SupabaseClient
  organizationId: string
  observationHours?: number
  outboundDisabled?: boolean
}): Promise<{
  qaMarker: typeof GROWTH_AIOS_NEXT_3D_PRODUCTION_LOADER_QA_MARKER
  readOnly: true
  accountability: GrowthHomeAvaRecommendationAccountabilitySnapshot
}> {
  const generatedAt = new Date().toISOString()
  const observationHours = input.observationHours ?? 24

  const [evidence, memoryPayload] = await Promise.all([
    loadGrowthOrganizationalEvidenceCompletenessFromProduction({
      admin: input.admin,
      organizationId: input.organizationId,
      observationHours,
    }),
    fetchOrganizationMemoryStore(input.admin, {
      organizationId: input.organizationId,
      generatedAt,
      limit: 200,
    }),
  ])

  const sinceIso = new Date(Date.now() - observationHours * 60 * 60 * 1000).toISOString()
  const memoryEvents = memoryPayload.store.events.filter((event) => event.timestamp >= sinceIso)

  const reasoning = buildExecutiveReasoningFromEvidenceCompleteness(evidence.snapshot, {
    outboundDisabled: input.outboundDisabled ?? true,
    pendingApprovals: evidence.snapshot.operatorDecisionHistory.pendingApprovals,
  })

  const accountability = buildGrowthHomeAvaRecommendationAccountabilityNext3d({
    organizationId: input.organizationId,
    generatedAt,
    evidenceCompleteness: evidence.snapshot,
    executiveReasoning: reasoning,
    memoryEvents,
  })

  return {
    qaMarker: GROWTH_AIOS_NEXT_3D_PRODUCTION_LOADER_QA_MARKER,
    readOnly: true,
    accountability,
  }
}
