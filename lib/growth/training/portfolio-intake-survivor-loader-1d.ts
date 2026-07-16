/**
 * GE-AIOS-FIRST-CUSTOMER-PORTFOLIO-INTAKE-1D — Load Prospect Search survivors from production runs (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import {
  buildCanonicalProspectSearchFiltersFromBusinessProfile,
  buildProspectSearchQueryFromBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-prospect-search-canonical-filters-1k"
import {
  resolveDatamoonProspectCompanyIdentityKey,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-company-identity"
import { normalizeDatamoonAudienceRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import type { DatamoonAudienceImportRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  isRunEligibleForIntakePromotion,
  type AutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-intake-lifecycle-1f"
import { recordsToProspectCompanies } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import { enrichProspectSearchExternalCompanies } from "@/lib/growth/prospect-search/prospect-search-external-enrichment"
import { parseProspectSearchQuery } from "@/lib/growth/prospect-search/prospect-search-query-parser"
import { prospectSearchDedupeHash } from "@/lib/growth/prospect-search/prospect-search-index"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export type LoadedPortfolioIntakeSurvivor = {
  survivorKey: string
  canonicalCompanyKey: string
  company: GrowthProspectSearchCompanyResult
  runId: string
  audienceId: string | null
  discoveryDate: string
  runStatus: string
  runRank: number
  runSurvivorCount: number
  batchSizeAtRun: number | null
  dedupeHash: string
  runIntake: AutonomousRunIntakeLifecycleFields
  runEligibleForIntakePromotion: boolean
}

function resolveImportRecordNormalized(input: {
  normalizedPayload?: DatamoonAudienceImportRecord["normalized"] | null
  providerRecord: Record<string, unknown>
}): DatamoonAudienceImportRecord["normalized"] {
  const baseNormalized =
    Object.keys(input.providerRecord).length > 0
      ? normalizeDatamoonAudienceRecord(input.providerRecord)
      : normalizeDatamoonAudienceRecord({})
  const normalizedPayload = input.normalizedPayload
  if (!normalizedPayload || Object.keys(normalizedPayload).length === 0) {
    return baseNormalized
  }
  return {
    ...baseNormalized,
    ...normalizedPayload,
    naics_codes: normalizedPayload.naics_codes ?? baseNormalized.naics_codes,
    sic_codes: normalizedPayload.sic_codes ?? baseNormalized.sic_codes,
  }
}

function readRunIntakeLifecycle(providerMetadata: Record<string, unknown>): AutonomousRunIntakeLifecycleFields {
  const metaRaw = providerMetadata.autonomous_prospect_search_1a
  if (!metaRaw || typeof metaRaw !== "object") return {}
  const meta = metaRaw as AutonomousRunIntakeLifecycleFields
  return {
    intake_pending: meta.intake_pending,
    intake_pending_at: meta.intake_pending_at ?? null,
    intake_completed: meta.intake_completed,
    intake_completed_at: meta.intake_completed_at ?? null,
    intake_promotion_started_at: meta.intake_promotion_started_at ?? null,
  }
}

function readBatchSizeFromRunMetadata(providerMetadata: Record<string, unknown>): number | null {
  const metaRaw = providerMetadata.autonomous_prospect_search_1a
  if (metaRaw && typeof metaRaw === "object") {
    const batch = (metaRaw as { batch_size?: unknown }).batch_size
    if (typeof batch === "number" && batch > 0) return batch
  }
  return null
}

export async function loadPortfolioIntakeSurvivorsFromProduction(input: {
  admin: SupabaseClient
  organizationId: string
}): Promise<{
  survivors: LoadedPortfolioIntakeSurvivor[]
  completedRunCount: number
  cumulativeSurvivorInstances: number
  uniqueCanonicalSurvivors: number
}> {
  const approved = await getActiveApprovedBusinessProfile(input.admin, input.organizationId)
  const profile = approved?.profile ?? null
  if (!profile) throw new Error("no_active_business_profile")
  const query = buildProspectSearchQueryFromBusinessProfile(profile, approved?.companyName ?? null)
  const canonicalFilters = await buildCanonicalProspectSearchFiltersFromBusinessProfile(input.admin, {
    profile,
    query,
  })
  const parsed = parseProspectSearchQuery(query)

  const { data: runs } = await input.admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select(
      "id, status, datamoon_audience_id, created_at, completed_at, provider_metadata, record_count, preview_count",
    )
    .like("run_name", "ge-aios-autonomous-prospect-search:%")
    .filter(
      "provider_metadata->autonomous_prospect_search_1a->>organization_id",
      "eq",
      input.organizationId,
    )
    .order("created_at", { ascending: true })

  const completedRuns = (runs ?? []).filter((row) => row.status === "completed")
  const survivors: LoadedPortfolioIntakeSurvivor[] = []

  for (const run of completedRuns) {
    const { data: dbRecords } = await input.admin
      .schema("growth")
      .from("datamoon_audience_import_records")
      .select("provider_record, normalized_payload, status, dedupe_rule, message")
      .eq("run_id", run.id)

    const importRecords: DatamoonAudienceImportRecord[] = (dbRecords ?? []).map((row, index) => {
      const normalizedPayload = (row as { normalized_payload?: DatamoonAudienceImportRecord["normalized"] })
        .normalized_payload
      const providerRecord = (row as { provider_record?: Record<string, unknown> }).provider_record ?? {}
      const normalized = resolveImportRecordNormalized({ normalizedPayload, providerRecord })
      return {
        id: `${run.id}:${index}`,
        runId: run.id,
        recordIndex: index,
        status: String((row as { status: string }).status) as DatamoonAudienceImportRecord["status"],
        normalized,
        dedupeRule: (row as { dedupe_rule?: string | null }).dedupe_rule ?? null,
        dedupeKey: null,
        matchedLeadId: null,
        leadId: null,
        message: (row as { message?: string | null }).message ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })

    const mapped = recordsToProspectCompanies(importRecords, canonicalFilters.industry ?? null)
    const enriched = await enrichProspectSearchExternalCompanies(input.admin, mapped.companies, {
      query,
      filters: canonicalFilters,
      parsed,
    })
    const runSurvivors = enriched.companies
    const providerMetadata = (run.provider_metadata as Record<string, unknown>) ?? {}
    const batchSizeAtRun =
      readBatchSizeFromRunMetadata(providerMetadata) ?? DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE
    const runIntake = readRunIntakeLifecycle(providerMetadata)
    const runEligibleForIntakePromotion = isRunEligibleForIntakePromotion({
      runStatus: run.status as string,
      intake: runIntake,
    })

    runSurvivors.forEach((company, index) => {
      const dedupeHash = prospectSearchDedupeHash([
        "prospect_search",
        company.source_type,
        company.id,
        company.website ?? "",
      ])
      survivors.push({
        survivorKey: `${run.id}:${company.id}`,
        canonicalCompanyKey: company.id,
        company,
        runId: run.id as string,
        audienceId: (run.datamoon_audience_id as string | null) ?? null,
        discoveryDate: (run.completed_at as string | null) ?? (run.created_at as string),
        runStatus: run.status as string,
        runRank: index + 1,
        runSurvivorCount: runSurvivors.length,
        batchSizeAtRun,
        dedupeHash,
        runIntake,
        runEligibleForIntakePromotion,
      })
    })
  }

  const uniqueCanonical = new Set(survivors.map((row) => row.canonicalCompanyKey))

  return {
    survivors,
    completedRunCount: completedRuns.length,
    cumulativeSurvivorInstances: survivors.length,
    uniqueCanonicalSurvivors: uniqueCanonical.size,
  }
}
