/** GE-AIOS-23 — Shared canonical research route helper (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import {
  executeGrowthLeadProspectResearch,
  type RunGrowthLeadResearchInput,
  type RunGrowthLeadResearchResult,
} from "@/lib/growth/research/growth-lead-research-execution-service"
import { GROWTH_CANONICAL_RESEARCH_23_QA_MARKER } from "@/lib/growth/research/growth-canonical-research-types"
import type { GrowthLeadResearchTrigger } from "@/lib/growth/research/growth-lead-research-execution-service"

export type RouteCanonicalProspectResearchInput = {
  admin: SupabaseClient
  leadId: string
  trigger: GrowthLeadResearchTrigger
  rebuild?: boolean
  force?: boolean
  runQualification?: boolean
  organizationId?: string | null
}

export type RouteCanonicalProspectResearchResult = RunGrowthLeadResearchResult & {
  qaMarker: typeof GROWTH_CANONICAL_RESEARCH_23_QA_MARKER
}

export async function routeCanonicalProspectResearch(
  input: RouteCanonicalProspectResearchInput,
): Promise<RouteCanonicalProspectResearchResult> {
  const organizationId = input.organizationId?.trim() || getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
      ok: false,
      outcome: "not_configured",
      code: "server_config",
      message: "Prospect research is not configured.",
    }
  }

  logGrowthEngine("canonical_research_route", {
    leadId: input.leadId,
    trigger: input.trigger,
    rebuild: Boolean(input.rebuild),
    force: Boolean(input.force),
    qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
  })

  const result = await executeGrowthLeadProspectResearch({
    admin: input.admin,
    organizationId,
    leadId: input.leadId,
    trigger: input.trigger,
    rebuild: input.rebuild,
    force: input.force,
    runQualification: input.runQualification,
  } satisfies RunGrowthLeadResearchInput)

  return { ...result, qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER }
}
