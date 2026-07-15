/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — DataMoon provider adapter for canonical Prospect Search (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  resolveDatamoonCompanyGeography,
  resolveDatamoonCompanyName,
  resolveDatamoonCompanyWebsite,
  resolveDatamoonProspectCompanyIdentityKey,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-company-identity"
import { normalizeDatamoonAudienceRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import { pollDatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-service"
import type { DatamoonAudienceImportRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  autonomousDiscoveryStopReasonMessage,
  evaluateAutonomousProspectDiscoveryProviderPolicy,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "@/lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import {
  attachAutonomousProspectSearchDatamoonMetadata,
  buildAutonomousProspectSearchDatamoonProviderMetadata,
  findActiveAutonomousProspectSearchDatamoonRun,
  isDatamoonAutonomousDiscoveryRunActive,
  isDatamoonAutonomousDiscoveryRunCompleted,
  isDatamoonAutonomousDiscoveryRunFailed,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import {
  DATAMOON_AUTONOMOUS_SINGLE_FLIGHT_ACTIVE_RUN_ERROR,
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
  type AutonomousProspectSearchDatamoonRunMetadata,
  type DatamoonAutonomousDiscoveryStopReason,
  type ProspectSearchDiscoveryAuthority,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { startDatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-service"

export type RunProspectSearchDatamoonAutonomousDiscoveryInput = {
  organizationId: string
  approvedProfile: BusinessProfileDraftContent
  companyName?: string | null
  query: string
  filters: GrowthProspectSearchFilters
  limit: number
  generatedAt: string
  createdBy?: string | null
  authority: ProspectSearchDiscoveryAuthority
  readOnlyProof?: boolean
  discoveriesToday?: number
  maximumDailyDiscovery?: number
}

export type DatamoonProspectSearchNormalizationStats = {
  raw_record_count: number
  normalized_company_count: number
  unique_company_count: number
  duplicate_contacts_consolidated: number
  company_identity_missing_count: number
}

export type RunProspectSearchDatamoonAutonomousDiscoveryResult = {
  qaMarker: typeof GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER
  companies: GrowthProspectSearchCompanyResult[]
  built_query: string
  stopReason: DatamoonAutonomousDiscoveryStopReason | null
  jobActive: boolean
  jobReused: boolean
  jobCreated: boolean
  rawCompanyCount: number
  normalizedCompanyCount: number
  normalizationStats: DatamoonProspectSearchNormalizationStats | null
  providerStatusLabel: string
  providerStatusMessage: string
  runId: string | null
  targetingSummary: ReturnType<
    typeof buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile
  >["targetingSummary"] | null
}

function buildProviderEvidenceKeywords(normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>): string[] {
  return [
    normalized.primary_industry,
    normalized.job_title,
    normalized.department,
    ...normalized.naics_codes.map((code) => `naics ${code}`),
    ...normalized.sic_codes.map((code) => `sic ${code}`),
  ].filter((value): value is string => Boolean(value?.trim()))
}

function datamoonRecordToProspectCompany(
  record: DatamoonAudienceImportRecord,
  index: number,
  filterIndustry?: string | null,
): GrowthProspectSearchCompanyResult {
  const normalized = record.normalized
  const companyName = resolveDatamoonCompanyName(normalized)
  const website = resolveDatamoonCompanyWebsite(normalized)
  const companyGeo = resolveDatamoonCompanyGeography(normalized)
  const id =
    resolveDatamoonProspectCompanyIdentityKey(normalized) ??
    record.dedupeKey?.trim() ??
    `datamoon-${record.id}`
  const providerKeywords = buildProviderEvidenceKeywords(normalized)
  const industry = normalized.primary_industry ?? filterIndustry ?? null

  return {
    id,
    source_type: "external_discovered",
    company_name: companyName,
    website,
    industry,
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
    signals: [
      "Discovered via DataMoon audience search",
      ...(normalized.job_title ? [`Contact role: ${normalized.job_title}`] : []),
      ...(normalized.primary_industry ? [`Provider industry: ${normalized.primary_industry}`] : []),
    ],
    search_intent_category: null,
    growth_lead_id: record.matchedLeadId,
    prospect_id: null,
    customer_id: null,
    rank_score: Math.max(0.1, 100 - index) * 0.01,
    match_reasoning: [
      "Discovered via DataMoon — routed through canonical Prospect Search.",
      normalized.contact_name ? `Contact signal: ${normalized.contact_name}` : "Company-level discovery record.",
      ...(companyGeo.location ? [`Company geography: ${companyGeo.location}`] : []),
      ...(normalized.company_domain ? [`Company domain: ${normalized.company_domain}`] : []),
    ],
    discovery_provider_type: "datamoon",
    discovery_provider_name: "DataMoon",
    discovery_source_badge: "DataMoon",
    keywords: providerKeywords,
    notes: [
      normalized.provider_company_id ? `Provider company id: ${normalized.provider_company_id}` : null,
      normalized.company_linkedin_url ? `Company LinkedIn: ${normalized.company_linkedin_url}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" | ") || null,
  }
}

function consolidateDatamoonAudienceImportRecords(
  records: DatamoonAudienceImportRecord[],
): { records: DatamoonAudienceImportRecord[]; duplicateContactsConsolidated: number } {
  const eligible = records.filter((record) => record.status === "preview" || record.status === "duplicate")
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
  let duplicateContactsConsolidated = 0

  for (const bucket of grouped.values()) {
    const [primary, ...duplicates] = bucket
    if (!primary) continue
    duplicateContactsConsolidated += Math.max(0, bucket.length - 1)

    const contactNames = bucket
      .map((record) => record.normalized.contact_name?.trim())
      .filter((value): value is string => Boolean(value))
    const mergedContacts = [...new Set(contactNames)]

    consolidated.push({
      ...primary,
      message:
        mergedContacts.length > 1
          ? `Consolidated ${mergedContacts.length} contacts at the same company.`
          : primary.message,
      normalized: {
        ...primary.normalized,
        contact_name: mergedContacts[0] ?? primary.normalized.contact_name,
      },
    })
  }

  return { records: consolidated, duplicateContactsConsolidated }
}

function recordsToProspectCompanies(
  records: DatamoonAudienceImportRecord[],
  filterIndustry?: string | null,
): { companies: GrowthProspectSearchCompanyResult[]; stats: DatamoonProspectSearchNormalizationStats } {
  const consolidated = consolidateDatamoonAudienceImportRecords(records)
  const companies = consolidated.records.map((record, index) =>
    datamoonRecordToProspectCompany(record, index, filterIndustry),
  )

  const company_identity_missing_count = companies.filter(
    (company) => !company.company_name?.trim() && !company.website?.trim(),
  ).length

  return {
    companies,
    stats: {
      raw_record_count: records.filter((record) => record.status === "preview" || record.status === "duplicate")
        .length,
      normalized_company_count: companies.length,
      unique_company_count: companies.length,
      duplicate_contacts_consolidated: consolidated.duplicateContactsConsolidated,
      company_identity_missing_count,
    },
  }
}

function providerBlockedResult(
  stopReason: DatamoonAutonomousDiscoveryStopReason,
  built_query: string,
): RunProspectSearchDatamoonAutonomousDiscoveryResult {
  return {
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    companies: [],
    built_query,
    stopReason,
    jobActive: stopReason === "datamoon_request_active",
    jobReused: false,
    jobCreated: false,
    rawCompanyCount: 0,
    normalizedCompanyCount: 0,
    normalizationStats: null,
    providerStatusLabel: stopReason,
    providerStatusMessage: autonomousDiscoveryStopReasonMessage(stopReason),
    runId: null,
    targetingSummary: null,
  }
}

async function resumeAutonomousProspectSearchDatamoonDiscoveryFromActiveRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    query: string
    filters: GrowthProspectSearchFilters
    activeRun: Awaited<ReturnType<typeof findActiveAutonomousProspectSearchDatamoonRun>>
    targetingSummary: ReturnType<
      typeof buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile
    >["targetingSummary"]
    readOnlyProof?: boolean
  },
): Promise<RunProspectSearchDatamoonAutonomousDiscoveryResult | null> {
  if (!input.activeRun) return null

  if (input.readOnlyProof) {
    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      companies: [],
      built_query: input.query,
      stopReason: "datamoon_request_active",
      jobActive: true,
      jobReused: true,
      jobCreated: false,
      rawCompanyCount: input.activeRun.loadingCount,
      normalizedCompanyCount: 0,
      normalizationStats: null,
      providerStatusLabel: "datamoon_request_active",
      providerStatusMessage: autonomousDiscoveryStopReasonMessage("datamoon_request_active"),
      runId: input.activeRun.id,
      targetingSummary: input.targetingSummary,
    }
  }

  const polled = await pollDatamoonAudienceImportRun(admin, input.activeRun.id)
  if (!polled.ok) {
    return providerBlockedResult("datamoon_provider_error", input.query)
  }

  const run = polled.run
  if (isDatamoonAutonomousDiscoveryRunActive(run)) {
    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      companies: [],
      built_query: input.query,
      stopReason: "datamoon_request_active",
      jobActive: true,
      jobReused: true,
      jobCreated: false,
      rawCompanyCount: run.loadingCount,
      normalizedCompanyCount: 0,
      normalizationStats: null,
      providerStatusLabel: "datamoon_request_active",
      providerStatusMessage: autonomousDiscoveryStopReasonMessage("datamoon_request_active"),
      runId: run.id,
      targetingSummary: input.targetingSummary,
    }
  }

  if (isDatamoonAutonomousDiscoveryRunFailed(run)) {
    return providerBlockedResult("datamoon_job_failed", input.query)
  }

  if (isDatamoonAutonomousDiscoveryRunCompleted(run)) {
    const mapped = recordsToProspectCompanies(polled.records, input.filters.industry ?? null)
    const stopReason = mapped.companies.length === 0 ? "datamoon_zero_results" : null
    logGrowthEngine("prospect_search_datamoon_autonomous_discovery_normalized", {
      qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      organization_id: input.organizationId,
      run_id: run.id,
      ...mapped.stats,
    })
    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      companies: mapped.companies,
      built_query: input.query,
      stopReason,
      jobActive: false,
      jobReused: true,
      jobCreated: false,
      rawCompanyCount: polled.records.length,
      normalizedCompanyCount: mapped.companies.length,
      normalizationStats: mapped.stats,
      providerStatusLabel: stopReason ?? "datamoon_completed",
      providerStatusMessage:
        stopReason != null
          ? autonomousDiscoveryStopReasonMessage(stopReason)
          : `DataMoon returned ${mapped.companies.length} company candidate(s).`,
      runId: run.id,
      targetingSummary: input.targetingSummary,
    }
  }

  return null
}

function buildAutonomousProspectSearchDatamoonRunMetadata(
  input: RunProspectSearchDatamoonAutonomousDiscoveryInput,
  fingerprint: string,
): AutonomousProspectSearchDatamoonRunMetadata {
  return {
    qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    organization_id: input.organizationId,
    business_profile_fingerprint: fingerprint,
    batch_size: input.limit,
    purpose: "prospect_search_intake",
    read_only_proof: input.readOnlyProof === true,
    authority: input.authority,
  }
}

export async function runProspectSearchDatamoonAutonomousDiscovery(
  admin: SupabaseClient,
  input: RunProspectSearchDatamoonAutonomousDiscoveryInput,
): Promise<RunProspectSearchDatamoonAutonomousDiscoveryResult> {
  const policy = evaluateAutonomousProspectDiscoveryProviderPolicy({
    authority: input.authority,
    discoveriesToday: input.discoveriesToday,
    maximumDailyDiscovery: input.maximumDailyDiscovery,
  })

  const projection = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile: input.approvedProfile,
    companyName: input.companyName,
    organizationId: input.organizationId,
    batchSize: input.limit,
    generatedAt: input.generatedAt,
  })

  if (!policy.eligible && policy.stopReason) {
    return providerBlockedResult(policy.stopReason, input.query)
  }

  const activeRun = await findActiveAutonomousProspectSearchDatamoonRun(admin, input.organizationId)
  if (activeRun) {
    const resumed = await resumeAutonomousProspectSearchDatamoonDiscoveryFromActiveRun(admin, {
      organizationId: input.organizationId,
      query: input.query,
      filters: input.filters,
      activeRun,
      targetingSummary: projection.targetingSummary,
      readOnlyProof: input.readOnlyProof,
    })
    if (resumed) return resumed
  }

  const reservationMetadata = buildAutonomousProspectSearchDatamoonRunMetadata(
    input,
    projection.fingerprint,
  )

  const started = await startDatamoonAudienceImportRun(
    admin,
    projection.request,
    { userId: input.createdBy ?? null },
    {
      autonomousProspectSearchReservation: {
        organizationId: input.organizationId,
        providerMetadata: buildAutonomousProspectSearchDatamoonProviderMetadata(
          reservationMetadata,
          {
            prospect_search_query: input.query,
            targeting_summary: projection.targetingSummary,
          },
        ),
      },
    },
  )

  if (!started.ok) {
    if (started.error === DATAMOON_AUTONOMOUS_SINGLE_FLIGHT_ACTIVE_RUN_ERROR) {
      const concurrentActiveRun = await findActiveAutonomousProspectSearchDatamoonRun(
        admin,
        input.organizationId,
      )
      const resumed = await resumeAutonomousProspectSearchDatamoonDiscoveryFromActiveRun(admin, {
        organizationId: input.organizationId,
        query: input.query,
        filters: input.filters,
        activeRun: concurrentActiveRun,
        targetingSummary: projection.targetingSummary,
        readOnlyProof: input.readOnlyProof,
      })
      if (resumed) {
        logGrowthEngine("prospect_search_datamoon_autonomous_discovery_single_flight_resumed", {
          qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
          organization_id: input.organizationId,
          run_id: resumed.runId,
        })
        return resumed
      }
    }

    const stopReason: DatamoonAutonomousDiscoveryStopReason =
      started.error === "datamoon_provider_disabled"
        ? "datamoon_disabled"
        : "datamoon_provider_error"
    return providerBlockedResult(stopReason, input.query)
  }

  await attachAutonomousProspectSearchDatamoonMetadata(admin, started.run.id, reservationMetadata, {
    prospect_search_query: input.query,
    targeting_summary: projection.targetingSummary,
  })

  logGrowthEngine("prospect_search_datamoon_autonomous_discovery_started", {
    qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    organization_id: input.organizationId,
    run_id: started.run.id,
    batch_size: input.limit,
    read_only_proof: input.readOnlyProof === true,
    authority: input.authority,
  })

  if (input.readOnlyProof) {
    const polled = await pollDatamoonAudienceImportRun(admin, started.run.id)
    const rawCount = polled.ok ? polled.records.length : 0
    const mapped = polled.ok
      ? recordsToProspectCompanies(polled.records, input.filters.industry ?? null)
      : { companies: [], stats: null }

    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      companies: [],
      built_query: input.query,
      stopReason: mapped.companies.length === 0 && rawCount === 0 ? "datamoon_zero_results" : null,
      jobActive: polled.ok ? isDatamoonAutonomousDiscoveryRunActive(polled.run) : true,
      jobReused: false,
      jobCreated: true,
      rawCompanyCount: rawCount,
      normalizedCompanyCount: mapped.companies.length,
      normalizationStats: mapped.stats,
      providerStatusLabel: polled.ok ? polled.run.status : "datamoon_provider_error",
      providerStatusMessage: polled.ok
        ? `Read-only proof: ${rawCount} raw, ${mapped.companies.length} normalized.`
        : "Read-only proof poll failed.",
      runId: started.run.id,
      targetingSummary: projection.targetingSummary,
    }
  }

  return {
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    companies: [],
    built_query: input.query,
    stopReason: "datamoon_request_active",
    jobActive: true,
    jobReused: false,
    jobCreated: true,
    rawCompanyCount: 0,
    normalizedCompanyCount: 0,
    normalizationStats: null,
    providerStatusLabel: "datamoon_queued",
    providerStatusMessage: "DataMoon discovery job queued — results will arrive on a future scheduler tick.",
    runId: started.run.id,
    targetingSummary: projection.targetingSummary,
  }
}

export function summarizeDatamoonProspectSearchProof(input: {
  result: RunProspectSearchDatamoonAutonomousDiscoveryResult
  icpPassCount: number
  duplicateCount: number
  projectedAdmissionCount: number
}): Record<string, unknown> {
  return {
    qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    request_accepted: input.result.jobCreated || input.result.jobReused,
    job_created: input.result.jobCreated,
    existing_job_reused: input.result.jobReused,
    provider_status: input.result.providerStatusLabel,
    raw_company_count: input.result.rawCompanyCount,
    normalized_count: input.result.normalizedCompanyCount,
    normalization_stats: input.result.normalizationStats,
    icp_filter_pass_count: input.icpPassCount,
    duplicate_count: input.duplicateCount,
    projected_admission_count: input.projectedAdmissionCount,
    stop_reason: input.result.stopReason,
    targeting_summary: input.result.targetingSummary,
  }
}

/** Normalize raw provider records for proof/diagnostics without persisting contacts. */
export function normalizeDatamoonProviderRecordsForProspectSearch(
  rawRecords: Record<string, unknown>[],
): GrowthProspectSearchCompanyResult[] {
  return recordsToProspectCompanies(
    rawRecords.map((raw, index) => {
      const normalized = normalizeDatamoonAudienceRecord(raw)
      return {
        id: `proof-${index}`,
        runId: "proof",
        recordIndex: index,
        status: "preview" as const,
        normalized,
        dedupeRule: null,
        dedupeKey: normalized.company_domain ?? normalized.company_name,
        matchedLeadId: null,
        leadId: null,
        message: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }),
    null,
  ).companies
}
