/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — DataMoon provider adapter for canonical Prospect Search (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  resolveDatamoonCompanyName,
  resolveDatamoonCompanyWebsite,
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
  findActiveAutonomousProspectSearchDatamoonRun,
  isDatamoonAutonomousDiscoveryRunActive,
  isDatamoonAutonomousDiscoveryRunCompleted,
  isDatamoonAutonomousDiscoveryRunFailed,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import {
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
  providerStatusLabel: string
  providerStatusMessage: string
  runId: string | null
  targetingSummary: ReturnType<
    typeof buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile
  >["targetingSummary"] | null
}

function datamoonRecordToProspectCompany(
  record: DatamoonAudienceImportRecord,
  index: number,
  filterIndustry?: string | null,
): GrowthProspectSearchCompanyResult {
  const normalized = record.normalized
  const companyName = resolveDatamoonCompanyName(normalized)
  const website = resolveDatamoonCompanyWebsite(normalized)
  const id = record.dedupeKey?.trim() || `datamoon-${record.id}`

  return {
    id,
    source_type: "external_discovered",
    company_name: companyName,
    website,
    industry: filterIndustry ?? null,
    subindustry: null,
    city: normalized.city,
    state: normalized.state,
    country: normalized.country,
    employees: null,
    revenue_range: null,
    location: [normalized.city, normalized.state, normalized.country].filter(Boolean).join(", ") || null,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: normalized.source_confidence === "provider" ? 0.75 : 0.5,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals: ["Discovered via DataMoon audience search"],
    search_intent_category: null,
    growth_lead_id: record.matchedLeadId,
    prospect_id: null,
    customer_id: null,
    rank_score: Math.max(0.1, 100 - index) * 0.01,
    match_reasoning: [
      "Discovered via DataMoon — routed through canonical Prospect Search.",
      normalized.contact_name ? `Contact signal: ${normalized.contact_name}` : "Company-level discovery record.",
    ],
    discovery_provider_type: "datamoon",
    discovery_provider_name: "DataMoon",
    discovery_source_badge: "DataMoon",
    keywords: [],
    notes: null,
  }
}

function recordsToProspectCompanies(
  records: DatamoonAudienceImportRecord[],
  filterIndustry?: string | null,
): GrowthProspectSearchCompanyResult[] {
  return records
    .filter((record) => record.status === "preview" || record.status === "duplicate")
    .map((record, index) => datamoonRecordToProspectCompany(record, index, filterIndustry))
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
    providerStatusLabel: stopReason,
    providerStatusMessage: autonomousDiscoveryStopReasonMessage(stopReason),
    runId: null,
    targetingSummary: null,
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
  if (activeRun && !input.readOnlyProof) {
    const polled = await pollDatamoonAudienceImportRun(admin, activeRun.id)
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
        providerStatusLabel: "datamoon_request_active",
        providerStatusMessage: autonomousDiscoveryStopReasonMessage("datamoon_request_active"),
        runId: run.id,
        targetingSummary: projection.targetingSummary,
      }
    }

    if (isDatamoonAutonomousDiscoveryRunFailed(run)) {
      return providerBlockedResult("datamoon_job_failed", input.query)
    }

    if (isDatamoonAutonomousDiscoveryRunCompleted(run)) {
      const companies = recordsToProspectCompanies(polled.records, input.filters.industry ?? null)
      const stopReason = companies.length === 0 ? "datamoon_zero_results" : null
      return {
        qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
        companies,
        built_query: input.query,
        stopReason,
        jobActive: false,
        jobReused: true,
        jobCreated: false,
        rawCompanyCount: polled.records.length,
        normalizedCompanyCount: companies.length,
        providerStatusLabel: stopReason ?? "datamoon_completed",
        providerStatusMessage:
          stopReason != null
            ? autonomousDiscoveryStopReasonMessage(stopReason)
            : `DataMoon returned ${companies.length} company candidate(s).`,
        runId: run.id,
        targetingSummary: projection.targetingSummary,
      }
    }
  }

  if (activeRun && input.readOnlyProof) {
    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      companies: [],
      built_query: input.query,
      stopReason: "datamoon_request_active",
      jobActive: true,
      jobReused: true,
      jobCreated: false,
      rawCompanyCount: activeRun.loadingCount,
      normalizedCompanyCount: 0,
      providerStatusLabel: "datamoon_request_active",
      providerStatusMessage: autonomousDiscoveryStopReasonMessage("datamoon_request_active"),
      runId: activeRun.id,
      targetingSummary: projection.targetingSummary,
    }
  }

  const started = await startDatamoonAudienceImportRun(
    admin,
    projection.request,
    { userId: input.createdBy ?? null },
  )

  if (!started.ok) {
    const stopReason: DatamoonAutonomousDiscoveryStopReason =
      started.error === "datamoon_provider_disabled"
        ? "datamoon_disabled"
        : "datamoon_provider_error"
    return providerBlockedResult(stopReason, input.query)
  }

  const metadata: AutonomousProspectSearchDatamoonRunMetadata = {
    qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    organization_id: input.organizationId,
    business_profile_fingerprint: projection.fingerprint,
    batch_size: input.limit,
    purpose: "prospect_search_intake",
    read_only_proof: input.readOnlyProof === true,
    authority: input.authority,
  }

  await attachAutonomousProspectSearchDatamoonMetadata(admin, started.run.id, metadata, {
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
    const companies = polled.ok
      ? recordsToProspectCompanies(polled.records, input.filters.industry ?? null)
      : []

    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      companies: [],
      built_query: input.query,
      stopReason: companies.length === 0 && rawCount === 0 ? "datamoon_zero_results" : null,
      jobActive: polled.ok ? isDatamoonAutonomousDiscoveryRunActive(polled.run) : true,
      jobReused: false,
      jobCreated: true,
      rawCompanyCount: rawCount,
      normalizedCompanyCount: companies.length,
      providerStatusLabel: polled.ok ? polled.run.status : "datamoon_provider_error",
      providerStatusMessage: polled.ok
        ? `Read-only proof: ${rawCount} raw, ${companies.length} normalized.`
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
  return rawRecords.map((raw, index) => {
    const normalized = normalizeDatamoonAudienceRecord(raw)
    return datamoonRecordToProspectCompany(
      {
        id: `proof-${index}`,
        runId: "proof",
        recordIndex: index,
        status: "preview",
        normalized,
        dedupeRule: null,
        dedupeKey: normalized.company_domain ?? normalized.company_name,
        matchedLeadId: null,
        leadId: null,
        message: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      index,
      null,
    )
  })
}
