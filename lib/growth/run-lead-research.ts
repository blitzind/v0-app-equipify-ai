/**
 * GE-AIOS-23 — Deprecated LLM research entry point.
 * All callers must route through executeGrowthLeadProspectResearch → runProspectResearch.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { mapProspectRunToLegacyResearchRun } from "@/lib/growth/research/growth-canonical-research-legacy-adapter"
import { routeCanonicalProspectResearch } from "@/lib/growth/research/growth-canonical-research-route"
import { GROWTH_CANONICAL_RESEARCH_23_QA_MARKER } from "@/lib/growth/research/growth-canonical-research-types"
import type { GrowthLeadResearchRun } from "@/lib/growth/research-types"
import type { GrowthLead, GrowthLeadStatus } from "@/lib/growth/types"

export type RunGrowthLeadResearchInput = {
  admin: SupabaseClient
  leadId: string
  createdBy: string | null
  actingUserEmail: string
  regenerate?: boolean
}

export type RunGrowthLeadResearchResult =
  | {
      ok: true
      run: GrowthLeadResearchRun
      leadStatus: GrowthLeadStatus
      leadScore: number | null
      lead?: GrowthLead | null
      cached: boolean
    }
  | { ok: false; code: string; message: string; run?: GrowthLeadResearchRun | null }

/** @deprecated GE-AIOS-23 — Delegates to routeCanonicalProspectResearch. */
export async function runGrowthLeadResearch(
  input: RunGrowthLeadResearchInput,
): Promise<RunGrowthLeadResearchResult> {
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      ok: false,
      code: "server_config",
      message: "AI research is not configured. Set GROWTH_ENGINE_AI_ORG_ID on the server.",
    }
  }

  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return { ok: false, code: "not_found", message: "Lead not found." }
  }

  logGrowthEngine("runGrowthLeadResearch_deprecated_delegate", {
    leadId: input.leadId,
    regenerate: Boolean(input.regenerate),
    qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
  })

  const result = await routeCanonicalProspectResearch({
    admin: input.admin,
    organizationId,
    leadId: input.leadId,
    trigger: "manual",
    rebuild: Boolean(input.regenerate),
    force: Boolean(input.regenerate),
    runQualification: true,
  })

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      run: result.run
        ? mapProspectRunToLegacyResearchRun(result.run, {
            createdBy: input.createdBy,
            triggerKind: input.regenerate ? "regenerate" : "manual",
          })
        : null,
    }
  }

  const legacyRun = mapProspectRunToLegacyResearchRun(result.run, {
    createdBy: input.createdBy,
    triggerKind: input.regenerate ? "regenerate" : "manual",
  })

  return {
    ok: true,
    run: legacyRun,
    leadStatus: result.lead?.status ?? lead.status,
    leadScore: result.lead?.score ?? lead.score,
    lead: result.lead ?? lead,
    cached: result.outcome === "cached" || result.outcome === "active",
  }
}
