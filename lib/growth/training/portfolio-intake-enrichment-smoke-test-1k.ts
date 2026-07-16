/**
 * GE-AIOS-EXTERNAL-DISCOVERY-KEYWORD-DEFERRAL-PRODUCTION-CLOSURE-1K — Read-only enrichment parity smoke test.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCanonicalProspectSearchFiltersFromBusinessProfile,
  buildProspectSearchQueryFromBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-prospect-search-canonical-filters-1k"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { listDatamoonAudienceImportRecords } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { recordsToProspectCompanies } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import { enrichProspectSearchExternalCompanies } from "@/lib/growth/prospect-search/prospect-search-external-enrichment"
import type { GrowthProspectSearchExternalFilterDiagnostics } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { parseProspectSearchQuery } from "@/lib/growth/prospect-search/prospect-search-query-parser"

export type PortfolioIntakeEnrichmentSmokeTestResult = {
  runId: string
  rawRecordCount: number
  normalizedCompanyCount: number
  postFilterSurvivorCount: number
  filterDiagnostics: GrowthProspectSearchExternalFilterDiagnostics
  eligibleForRecovery: boolean
  ineligibleReason: string | null
}

export async function runPortfolioIntakeEnrichmentSmokeTestForRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    profile: BusinessProfileDraftContent
    companyName?: string | null
  },
): Promise<PortfolioIntakeEnrichmentSmokeTestResult> {
  const query = buildProspectSearchQueryFromBusinessProfile(input.profile, input.companyName)
  const filters = await buildCanonicalProspectSearchFiltersFromBusinessProfile(admin, {
    profile: input.profile,
    query,
  })
  const parsed = parseProspectSearchQuery(query)
  const records = await listDatamoonAudienceImportRecords(admin, input.runId)
  const mapped = recordsToProspectCompanies(records, filters.industry ?? null)
  const enriched = await enrichProspectSearchExternalCompanies(admin, mapped.companies, {
    query,
    filters,
    parsed,
  })

  const postFilterSurvivorCount = enriched.companies.length
  const eligibleForRecovery =
    postFilterSurvivorCount > 0 ||
    isCompletePermanentDropLedger({
      normalizedCompanyCount: mapped.companies.length,
      filterDiagnostics: enriched.filter_diagnostics,
    })

  return {
    runId: input.runId,
    rawRecordCount: records.length,
    normalizedCompanyCount: mapped.companies.length,
    postFilterSurvivorCount,
    filterDiagnostics: enriched.filter_diagnostics,
    eligibleForRecovery,
    ineligibleReason: eligibleForRecovery
      ? null
      : resolveIneligibleRecoveryReason({
          normalizedCompanyCount: mapped.companies.length,
          postFilterSurvivorCount,
          filterDiagnostics: enriched.filter_diagnostics,
        }),
  }
}

function isCompletePermanentDropLedger(input: {
  normalizedCompanyCount: number
  filterDiagnostics: GrowthProspectSearchExternalFilterDiagnostics
}): boolean {
  if (input.normalizedCompanyCount === 0) return true
  if (input.filterDiagnostics.normalized_result_count > 0) return false
  const dropped = input.filterDiagnostics.dropped_result_count ?? 0
  return dropped === input.normalizedCompanyCount && dropped > 0
}

function resolveIneligibleRecoveryReason(input: {
  normalizedCompanyCount: number
  postFilterSurvivorCount: number
  filterDiagnostics: GrowthProspectSearchExternalFilterDiagnostics
}): string {
  if (input.normalizedCompanyCount === 0) return "normalization_zero"
  if (
    input.postFilterSurvivorCount === 0 &&
    (input.filterDiagnostics.dropped_reasons?.keywords ?? 0) > 0 &&
    input.filterDiagnostics.operational_keywords_deferred !== true
  ) {
    return "pre_research_keyword_gate_collapse"
  }
  return "enrichment_smoke_test_failed"
}
