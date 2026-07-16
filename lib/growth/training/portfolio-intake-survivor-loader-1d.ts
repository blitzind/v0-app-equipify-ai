/**
 * GE-AIOS-FIRST-CUSTOMER-PORTFOLIO-INTAKE-1D — Load Prospect Search survivors from production runs (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import {
  resolveDatamoonCompanyGeography,
  resolveDatamoonCompanyName,
  resolveDatamoonCompanyWebsite,
  resolveDatamoonProspectCompanyIdentityKey,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-company-identity"
import { normalizeDatamoonAudienceRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import type { DatamoonAudienceImportRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { applyDatamoonProviderIndustryIcpBridge } from "@/lib/growth/lead-sources/datamoon/datamoon-provider-industry-icp-bridge-1a"
import { DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  isRunEligibleForIntakePromotion,
  type AutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-intake-lifecycle-1f"
import { applyProspectSearchExternalCompanyFilters } from "@/lib/growth/prospect-search/prospect-search-external-filters"
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

function buildProviderEvidenceKeywords(
  normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>,
): string[] {
  return [
    normalized.primary_industry,
    normalized.job_title,
    normalized.department,
    ...(normalized.naics_codes ?? []).map((code) => `naics ${code}`),
    ...(normalized.sic_codes ?? []).map((code) => `sic ${code}`),
  ].filter((value): value is string => Boolean(value?.trim()))
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

function recordToProspectCompany(
  record: DatamoonAudienceImportRecord,
  index: number,
): GrowthProspectSearchCompanyResult {
  const normalized = record.normalized
  const companyGeo = resolveDatamoonCompanyGeography(normalized)
  const providerKeywords = buildProviderEvidenceKeywords(normalized)
  const bridge = applyDatamoonProviderIndustryIcpBridge({
    providerIndustry: normalized.primary_industry,
    keywords: providerKeywords,
    signals: [
      "Discovered via DataMoon audience search",
      ...(normalized.job_title ? [`Contact role: ${normalized.job_title}`] : []),
      ...(normalized.primary_industry ? [`Provider industry: ${normalized.primary_industry}`] : []),
    ],
  })

  return {
    id:
      resolveDatamoonProspectCompanyIdentityKey(normalized) ??
      record.dedupeKey?.trim() ??
      record.id,
    source_type: "external_discovered",
    company_name: resolveDatamoonCompanyName(normalized),
    website: resolveDatamoonCompanyWebsite(normalized),
    industry: normalized.primary_industry ?? null,
    subindustry: normalized.department,
    city: companyGeo.city,
    state: companyGeo.state,
    country: companyGeo.country,
    employees: null,
    revenue_range: null,
    location: companyGeo.location,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: normalized.source_confidence === "provider" ? 0.75 : 0.5,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals: bridge.signals,
    search_intent_category: null,
    growth_lead_id: record.matchedLeadId,
    prospect_id: null,
    customer_id: null,
    rank_score: Math.max(0.1, 100 - index) * 0.01,
    match_reasoning: [
      "Discovered via DataMoon — routed through canonical Prospect Search.",
      ...(bridge.metadata.bridgeApplied
        ? [`Provider industry bridge: ${bridge.metadata.mappedSSVAliases.join(", ")}`]
        : []),
    ],
    discovery_provider_type: "datamoon",
    discovery_provider_name: "DataMoon",
    discovery_source_badge: "DataMoon",
    keywords: bridge.keywords,
    notes: null,
  }
}

function consolidateImportRecords(records: DatamoonAudienceImportRecord[]) {
  const eligible = records.filter((row) => row.status === "preview" || row.status === "duplicate")
  const grouped = new Map<string, DatamoonAudienceImportRecord[]>()
  for (const record of eligible) {
    const key =
      resolveDatamoonProspectCompanyIdentityKey(record.normalized) ??
      record.dedupeKey?.trim() ??
      record.id
    const bucket = grouped.get(key) ?? []
    bucket.push(record)
    grouped.set(key, bucket)
  }
  const consolidated: DatamoonAudienceImportRecord[] = []
  for (const bucket of grouped.values()) {
    consolidated.push(bucket[0]!)
  }
  return { consolidated }
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
  const filters = buildProspectSearchFiltersFromBusinessProfile(profile)

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

    const { consolidated } = consolidateImportRecords(importRecords)
    const companies = consolidated
      .map((record, index) => recordToProspectCompany(record, index))
      .sort((a, b) => (b.rank_score ?? 0) - (a.rank_score ?? 0))
    const filtered = applyProspectSearchExternalCompanyFilters(companies, filters)
    const runSurvivors = filtered.companies
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
