/**
 * AVA-SUPERVISED-CUTOVER-1A — Resolve external company before CI ensure.
 * Lead is evidence only; never treated as the company record.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { loadCompanyIntelligenceForGrowthLead } from "@/lib/fuzor/company-intelligence"

export const AVA_SUPERVISED_CUTOVER_1A_QA_MARKER =
  "ava-supervised-cutover-1a-internal-reasoning-v1" as const

export type EquipifyExternalCompanyPreflight =
  | {
      ok: true
      canEnsure: true
      externalCompanyId: string | null
      hasPriorIntelligence: boolean
    }
  | {
      ok: true
      canEnsure: false
      reason: string
      externalCompanyId: null
      hasPriorIntelligence: false
    }

/**
 * Preflight external company identity for Company Intelligence persistence.
 * Does not guess, provision, or duplicate companies — only reads existing resolution signals.
 */
export async function preflightEquipifyExternalCompanyForIntelligence(
  admin: SupabaseClient,
  leadId: string,
): Promise<EquipifyExternalCompanyPreflight> {
  const prior = await loadCompanyIntelligenceForGrowthLead({ admin, leadId })
  if (prior) {
    return {
      ok: true,
      canEnsure: true,
      externalCompanyId: prior.companyId,
      hasPriorIntelligence: true,
    }
  }

  const externalCompanyId = await resolveCanonicalCompanyIdForLead(admin, leadId)
  if (externalCompanyId) {
    return {
      ok: true,
      canEnsure: true,
      externalCompanyId,
      hasPriorIntelligence: false,
    }
  }

  const lead = await fetchGrowthLeadById(admin, leadId)
  const domain = canonicalNormalizedDomain(null, lead?.website ?? null)
  if (domain) {
    // Platform ensure may provision from website domain — identity path is known.
    return {
      ok: true,
      canEnsure: true,
      externalCompanyId: null,
      hasPriorIntelligence: false,
    }
  }

  return {
    ok: true,
    canEnsure: false,
    reason:
      "External company identity could not be resolved. No canonical company link, resolvable website domain, or prior Company Intelligence version exists for this lead. The lead record is evidence only — not the external company.",
    externalCompanyId: null,
    hasPriorIntelligence: false,
  }
}
