/**
 * Phase 7.PS-HE — Rehydrate Prospect Search company intelligence after human acquisition.
 * Loads contact_intelligence directly from DB; does not depend on re-search page membership.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { attachReachableHumanToCompanies } from "@/lib/growth/prospect-search/prospect-search-contactability-ranking"
import { applyProspectSearchContactIntelligenceOverlay } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-loader"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_HYDRATION_QA_MARKER =
  "growth-prospect-search-human-acquisition-hydration-7-ps-he-v1" as const

export async function refreshProspectSearchCompanyAfterHumanAcquisition(
  admin: SupabaseClient,
  input: {
    company: GrowthProspectSearchCompanyResult
    canonical_company_id?: string | null
    query?: string | null
  },
): Promise<GrowthProspectSearchCompanyResult> {
  const canonical =
    (input.canonical_company_id ?? "").trim() ||
    input.company.contact_intelligence?.engine_coverage?.company?.canonical_company_id ||
    input.company.canonical_company_id ||
    input.company.contact_intelligence?.engine_intelligence?.canonical_company_id ||
    null

  const base: GrowthProspectSearchCompanyResult = {
    ...input.company,
    canonical_company_id: canonical ?? input.company.canonical_company_id ?? null,
  }

  const [withIntelligence] = await applyProspectSearchContactIntelligenceOverlay(admin, [base], {
    query: input.query ?? undefined,
  })
  const [withReachable] = attachReachableHumanToCompanies([withIntelligence ?? base])
  return withReachable ?? base
}
