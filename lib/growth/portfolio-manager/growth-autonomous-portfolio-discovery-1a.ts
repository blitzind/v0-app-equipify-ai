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
  type GrowthPortfolioReplenishmentDecision,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { upsertOrganizationMemoryPreferences } from "@/lib/growth/memory/storage/organization-memory-repository"
import { executeBulkPushToLeadInbox } from "@/lib/growth/prospect-search/prospect-search-push-to-inbox"
import { runProspectSearch } from "@/lib/growth/prospect-search/prospect-search-repository"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthPortfolioManagerMemory } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

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
  datamoonJobActive?: boolean
  datamoonJobCreated?: boolean
  datamoonStopReason?: string | null
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
  },
): Promise<AutonomousPortfolioDiscoveryTickResult> {
  const batchSize = Math.max(1, Math.min(100, Math.floor(input.batchSize)))
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

  const datamoonJobActive =
    (search as { datamoon_autonomous_discovery_job_active?: boolean }).datamoon_autonomous_discovery_job_active ===
    true
  const datamoonStopReason =
    (search as { datamoon_autonomous_discovery_stop_reason?: string | null })
      .datamoon_autonomous_discovery_stop_reason ?? null

  if (datamoonJobActive) {
    return {
      qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      organizationId: input.organizationId,
      ran: true,
      skippedReason: "DataMoon discovery job active — awaiting provider results.",
      searched: 0,
      pushed: 0,
      alreadyExists: 0,
      suppressed: 0,
      failed: 0,
      datamoonJobActive: true,
      datamoonStopReason,
    }
  }

  const selected = search.companies.slice(0, batchSize).map((company) => ({
    source_type: company.source_type,
    id: company.id,
    company_name: company.company_name,
  }))

  if (selected.length === 0) {
    return {
      qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      organizationId: input.organizationId,
      ran: true,
      skippedReason: "No matching companies returned from Prospect Search.",
      searched: 0,
      pushed: 0,
      alreadyExists: 0,
      suppressed: 0,
      failed: 0,
    }
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
    searched: selected.length,
    pushed: push.pushed,
    already_exists: push.already_exists,
  })

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    organizationId: input.organizationId,
    ran: true,
    skippedReason: null,
    searched: selected.length,
    pushed: push.pushed,
    alreadyExists: push.already_exists,
    suppressed: push.suppressed,
    failed: push.failed,
  }
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
    }
  }

  if (!input.replenishment.shouldReplenish || input.replenishment.batchSize <= 0) {
    return {
      qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      organizationId: input.organizationId,
      ran: false,
      skippedReason: input.replenishment.reason,
      searched: 0,
      pushed: 0,
      alreadyExists: 0,
      suppressed: 0,
      failed: 0,
    }
  }

  return runAutonomousPortfolioDiscoveryBatch(admin, {
    organizationId: input.organizationId,
    approvedProfile: input.approvedProfile,
    companyName: input.companyName,
    batchSize: input.replenishment.batchSize,
    generatedAt: input.generatedAt,
    memory: input.memory,
    createdBy: input.createdBy,
    maximumDailyDiscovery: input.maximumDailyDiscovery,
  })
}
