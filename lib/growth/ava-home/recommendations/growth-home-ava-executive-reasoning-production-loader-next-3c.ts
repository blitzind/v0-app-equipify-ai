/** GE-AIOS-NEXT-3C — Production executive reasoning loader (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadGrowthOrganizationalEvidenceCompletenessFromProduction } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-production-loader-next-3b"
import { buildExecutiveReasoningFromEvidenceCompleteness } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c"
import type { GrowthHomeAvaExecutiveReasoningPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c-types"

export const GROWTH_AIOS_NEXT_3C_PRODUCTION_LOADER_QA_MARKER =
  "ge-aios-next-3c-executive-reasoning-production-loader-v1" as const

export async function loadGrowthHomeAvaExecutiveReasoningFromProduction(input: {
  admin: SupabaseClient
  organizationId: string
  observationHours?: number
  outboundDisabled?: boolean
}): Promise<{
  qaMarker: typeof GROWTH_AIOS_NEXT_3C_PRODUCTION_LOADER_QA_MARKER
  readOnly: true
  reasoning: GrowthHomeAvaExecutiveReasoningPayload
}> {
  const evidence = await loadGrowthOrganizationalEvidenceCompletenessFromProduction({
    admin: input.admin,
    organizationId: input.organizationId,
    observationHours: input.observationHours,
  })

  const reasoning = buildExecutiveReasoningFromEvidenceCompleteness(evidence.snapshot, {
    outboundDisabled: input.outboundDisabled ?? true,
  })

  return {
    qaMarker: GROWTH_AIOS_NEXT_3C_PRODUCTION_LOADER_QA_MARKER,
    readOnly: true,
    reasoning,
  }
}
