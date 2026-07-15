/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Prospect Search invocation for autonomous replenishment (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  portfolioManagerMemoryPreferencePayload,
  recordPortfolioDiscoveryMemory,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import {
  GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
  type AutonomousPortfolioDiscoveryDisposition,
  type AutonomousPortfolioDiscoveryExecutionAction,
  type GrowthPortfolioReplenishmentDecision,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { upsertOrganizationMemoryPreferences } from "@/lib/growth/memory/storage/organization-memory-repository"
import { executeBulkPushToLeadInbox } from "@/lib/growth/prospect-search/prospect-search-push-to-inbox"
import { runProspectSearch } from "@/lib/growth/prospect-search/prospect-search-repository"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthPortfolioManagerMemory } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  autonomousDiscoveryStopReasonMessage,
  type DatamoonAutonomousDiscoveryStopReason,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import { resolveAutonomousPortfolioDiscoveryExecutionPlan } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a"

export type AutonomousPortfolioDiscoveryTickResult = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER
  organizationId: string
  ran: boolean
  skippedReason: string | null
  searched: number
  pushed: number
  alreadyExists: number
  suppressed: number
  failed: number
  disposition?: AutonomousPortfolioDiscoveryDisposition
  executionAction?: AutonomousPortfolioDiscoveryExecutionAction
  datamoonJobActive?: boolean
  datamoonJobCreated?: boolean
  datamoonJobReused?: boolean
  datamoonStopReason?: string | null
  datamoonRunId?: string | null
  datamoonRawCompanyCount?: number
  datamoonNormalizedCompanyCount?: number
  datamoonFilteredCompanyCount?: number
}

type DatamoonPortfolioSearchSignals = {
  datamoonJobActive: boolean
  datamoonJobCreated: boolean
  datamoonJobReused: boolean
  datamoonStopReason: string | null
  datamoonRunId: string | null
  datamoonRawCompanyCount: number
  datamoonNormalizedCompanyCount: number
  providerStatusMessage: string | null
}

function readDatamoonPortfolioSearchSignals(search: {
  datamoon_autonomous_discovery_job_active?: boolean
  datamoon_autonomous_discovery_job_created?: boolean
  datamoon_autonomous_discovery_job_reused?: boolean
  datamoon_autonomous_discovery_stop_reason?: string | null
  datamoon_autonomous_discovery_run_id?: string | null
  datamoon_autonomous_discovery_raw_company_count?: number
  datamoon_autonomous_discovery_normalized_company_count?: number
  provider_status_message?: string | null
}): DatamoonPortfolioSearchSignals {
  return {
    datamoonJobActive: search.datamoon_autonomous_discovery_job_active === true,
    datamoonJobCreated: search.datamoon_autonomous_discovery_job_created === true,
    datamoonJobReused: search.datamoon_autonomous_discovery_job_reused === true,
    datamoonStopReason: search.datamoon_autonomous_discovery_stop_reason ?? null,
    datamoonRunId: search.datamoon_autonomous_discovery_run_id ?? null,
    datamoonRawCompanyCount: search.datamoon_autonomous_discovery_raw_company_count ?? 0,
    datamoonNormalizedCompanyCount:
      search.datamoon_autonomous_discovery_normalized_company_count ?? 0,
    providerStatusMessage: search.provider_status_message ?? null,
  }
}

function resolvePortfolioDiscoveryDisposition(input: {
  executionAction: AutonomousPortfolioDiscoveryExecutionAction
  datamoon: DatamoonPortfolioSearchSignals
  searched: number
  pushed: number
}): AutonomousPortfolioDiscoveryDisposition {
  if (input.datamoon.datamoonStopReason === "datamoon_job_failed") {
    return "active_discovery_failed"
  }

  if (input.datamoon.datamoonJobActive) {
    return input.executionAction === "resume_active"
      ? "active_discovery_still_building"
      : "new_discovery_started"
  }

  if (input.pushed > 0 || input.searched > 0) {
    return "active_discovery_completed"
  }

  if (input.executionAction === "resume_active" && input.datamoon.datamoonJobReused) {
    return "active_discovery_polled"
  }

  if (input.executionAction === "start_new" && input.datamoon.datamoonJobCreated) {
    return "new_discovery_started"
  }

  if (input.datamoon.datamoonStopReason != null) {
    return "discovery_skipped"
  }

  return "discovery_skipped"
}

function buildPortfolioDiscoverySkippedReason(input: {
  datamoonStopReason: string | null
  providerStatusMessage: string | null
  datamoonJobActive: boolean
}): string {
  if (input.datamoonStopReason) {
    return autonomousDiscoveryStopReasonMessage(
      input.datamoonStopReason as DatamoonAutonomousDiscoveryStopReason,
    )
  }

  if (input.datamoonJobActive) {
    return "DataMoon discovery job active — awaiting provider results."
  }

  if (input.providerStatusMessage?.trim()) {
    return input.providerStatusMessage.trim()
  }

  return "No matching companies returned from Prospect Search."
}

function buildPortfolioDiscoveryTickResult(input: {
  organizationId: string
  ran: boolean
  skippedReason: string | null
  searched: number
  pushed: number
  alreadyExists: number
  suppressed: number
  failed: number
  executionAction: AutonomousPortfolioDiscoveryExecutionAction
  datamoon: DatamoonPortfolioSearchSignals
  filteredCompanyCount?: number
}): AutonomousPortfolioDiscoveryTickResult {
  const disposition = input.ran
    ? resolvePortfolioDiscoveryDisposition({
        executionAction: input.executionAction,
        datamoon: input.datamoon,
        searched: input.searched,
        pushed: input.pushed,
      })
    : "discovery_skipped"

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    organizationId: input.organizationId,
    ran: input.ran,
    skippedReason: input.skippedReason,
    searched: input.searched,
    pushed: input.pushed,
    alreadyExists: input.alreadyExists,
    suppressed: input.suppressed,
    failed: input.failed,
    disposition,
    executionAction: input.executionAction,
    datamoonJobActive: input.datamoon.datamoonJobActive,
    datamoonJobCreated: input.datamoon.datamoonJobCreated,
    datamoonJobReused: input.datamoon.datamoonJobReused,
    datamoonStopReason: input.datamoon.datamoonStopReason,
    datamoonRunId: input.datamoon.datamoonRunId,
    datamoonRawCompanyCount: input.datamoon.datamoonRawCompanyCount,
    datamoonNormalizedCompanyCount: input.datamoon.datamoonNormalizedCompanyCount,
    datamoonFilteredCompanyCount: input.filteredCompanyCount ?? 0,
  }
}

export function buildProspectSearchQueryFromBusinessProfile(
  profile: BusinessProfileDraftContent,
  companyName?: string | null,
): string {
  const projection = projectApprovedBusinessProfileToLeadDiscovery(profile, companyName)
  const industry = projection.industries[0] ?? projection.topics[0] ?? "companies"
  const geo = projection.geography.state
    ? `${projection.geography.state} United States`
    : "United States"
  return `Find ${industry} companies in ${geo}`
}

export function buildProspectSearchFiltersFromBusinessProfile(
  profile: BusinessProfileDraftContent,
): GrowthProspectSearchFilters {
  const projection = projectApprovedBusinessProfileToLeadDiscovery(profile)
  const persona = projection.buyerPersonas[0] ?? projection.jobTitles[0] ?? null
  return {
    industry: projection.industries[0] ?? null,
    location: projection.geography.state ?? projection.geography.country ?? null,
    keywords: projection.keywords.slice(0, 8),
    naics_codes: profile.idealCustomers.preferredNaicsCodes ?? [],
    excluded_naics_codes: profile.idealCustomers.excludedNaicsCodes ?? [],
    sic_codes: profile.idealCustomers.preferredSicCodes ?? [],
    excluded_sic_codes: profile.idealCustomers.excludedSicCodes ?? [],
    decision_maker_role: persona,
    title_contains: persona,
    employee_size_bands: undefined,
    suppression_mode: "hide_suppressed",
    existing_account_mode: "exclude_existing",
  }
}

export async function runAutonomousPortfolioDiscoveryBatch(
  admin: SupabaseClient,
  input: {
    organizationId: string
    approvedProfile: BusinessProfileDraftContent
    companyName?: string | null
    batchSize: number
    generatedAt: string
    memory: GrowthPortfolioManagerMemory
    createdBy?: string | null
    maximumDailyDiscovery?: number
    executionAction?: AutonomousPortfolioDiscoveryExecutionAction
  },
): Promise<AutonomousPortfolioDiscoveryTickResult> {
  const batchSize = Math.max(1, Math.min(100, Math.floor(input.batchSize)))
  const executionAction = input.executionAction ?? "start_new"
  const query = buildProspectSearchQueryFromBusinessProfile(input.approvedProfile, input.companyName)
  const filters = buildProspectSearchFiltersFromBusinessProfile(input.approvedProfile)

  const search = await runProspectSearch(admin, {
    query,
    filters,
    discovery_mode: "discover_external",
    discovery_authority: "autonomous_portfolio",
    organization_id: input.organizationId,
    approved_profile: input.approvedProfile,
    company_name: input.companyName,
    discoveries_today: input.memory.discoveriesToday,
    maximum_daily_discovery: input.maximumDailyDiscovery,
    generated_at: input.generatedAt,
    limit: batchSize,
    page_size: batchSize,
    result_mode: "queue",
    created_by: input.createdBy ?? null,
  })

  const datamoon = readDatamoonPortfolioSearchSignals(search)

  if (datamoon.datamoonJobActive) {
    return buildPortfolioDiscoveryTickResult({
      organizationId: input.organizationId,
      ran: true,
      skippedReason: buildPortfolioDiscoverySkippedReason(datamoon),
      searched: 0,
      pushed: 0,
      alreadyExists: 0,
      suppressed: 0,
      failed: 0,
      executionAction,
      datamoon,
    })
  }

  const selected = search.companies.slice(0, batchSize).map((company) => ({
    source_type: company.source_type,
    id: company.id,
    company_name: company.company_name,
  }))

  if (selected.length === 0) {
    return buildPortfolioDiscoveryTickResult({
      organizationId: input.organizationId,
      ran: true,
      skippedReason: buildPortfolioDiscoverySkippedReason(datamoon),
      searched: 0,
      pushed: 0,
      alreadyExists: 0,
      suppressed: 0,
      failed: 0,
      executionAction,
      datamoon,
      filteredCompanyCount: search.total_companies ?? 0,
    })
  }

  const push = await executeBulkPushToLeadInbox(admin, {
    query,
    filters,
    discovery_mode: "discover_external",
    selected,
  })

  const updatedMemory = recordPortfolioDiscoveryMemory({
    memory: input.memory,
    generatedAt: input.generatedAt,
    discoveredCount: push.pushed,
    qualityScore: push.pushed > 0 ? Math.min(100, 60 + push.pushed) : null,
    admissionRate:
      push.pushed + push.already_exists > 0
        ? push.pushed / (push.pushed + push.already_exists)
        : null,
  })

  await upsertOrganizationMemoryPreferences(admin, {
    organizationId: input.organizationId,
    preferences: [
      portfolioManagerMemoryPreferencePayload(
        input.organizationId,
        updatedMemory,
        input.generatedAt,
      ),
    ],
  }).catch(() => 0)

  logGrowthEngine("autonomous_portfolio_discovery_batch", {
    qa_marker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    organization_id: input.organizationId,
    batch_size: batchSize,
    execution_action: executionAction,
    disposition: resolvePortfolioDiscoveryDisposition({
      executionAction,
      datamoon,
      searched: selected.length,
      pushed: push.pushed,
    }),
    datamoon_run_id: datamoon.datamoonRunId,
    searched: selected.length,
    pushed: push.pushed,
    already_exists: push.already_exists,
    external_filter_diagnostics: search.external_filter_diagnostics ?? null,
    datamoon_normalization_stats:
      (search as { datamoon_autonomous_discovery_normalization_stats?: unknown })
        .datamoon_autonomous_discovery_normalization_stats ?? null,
  })

  return buildPortfolioDiscoveryTickResult({
    organizationId: input.organizationId,
    ran: true,
    skippedReason: null,
    searched: selected.length,
    pushed: push.pushed,
    alreadyExists: push.already_exists,
    suppressed: push.suppressed,
    failed: push.failed,
    executionAction,
    datamoon,
    filteredCompanyCount: search.total_companies ?? selected.length,
  })
}

export async function tickAutonomousPortfolioDiscoveryReplenishment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    approvedProfile: BusinessProfileDraftContent | null
    companyName?: string | null
    replenishment: GrowthPortfolioReplenishmentDecision
    memory: GrowthPortfolioManagerMemory
    generatedAt: string
    createdBy?: string | null
    maximumDailyDiscovery?: number
  },
): Promise<AutonomousPortfolioDiscoveryTickResult> {
  if (!input.approvedProfile) {
    return {
      qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      organizationId: input.organizationId,
      ran: false,
      skippedReason: "Approved Business Profile required.",
      searched: 0,
      pushed: 0,
      alreadyExists: 0,
      suppressed: 0,
      failed: 0,
      disposition: "discovery_skipped",
      executionAction: "skip",
    }
  }

  const executionPlan = resolveAutonomousPortfolioDiscoveryExecutionPlan(input.replenishment)
  if (executionPlan.action === "skip") {
    return {
      qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      organizationId: input.organizationId,
      ran: false,
      skippedReason: executionPlan.reason,
      searched: 0,
      pushed: 0,
      alreadyExists: 0,
      suppressed: 0,
      failed: 0,
      disposition: "discovery_skipped",
      executionAction: "skip",
    }
  }

  return runAutonomousPortfolioDiscoveryBatch(admin, {
    organizationId: input.organizationId,
    approvedProfile: input.approvedProfile,
    companyName: input.companyName,
    batchSize: executionPlan.batchSize,
    generatedAt: input.generatedAt,
    memory: input.memory,
    createdBy: input.createdBy,
    maximumDailyDiscovery: input.maximumDailyDiscovery,
    executionAction: executionPlan.action,
  })
}
