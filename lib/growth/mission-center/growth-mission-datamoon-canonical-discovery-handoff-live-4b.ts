/** GE-AIOS-LIVE-4B — Mission-to-portfolio autonomous discovery continuity (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import {
  buildProspectSearchFiltersFromBusinessProfile,
  buildProspectSearchQueryFromBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import {
  missionLifecycleActivityLabel,
  type GrowthMissionLifecycleState,
  type GrowthObjectiveMissionRuntimeState,
} from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { fetchDatamoonAudienceImportRunById } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import type { DatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "@/lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import {
  attachAutonomousProspectSearchDatamoonMetadata,
  findActiveAutonomousProspectSearchDatamoonRun,
  isAutonomousProspectSearchDatamoonRun,
  isDatamoonAutonomousDiscoveryRunActive,
  isDatamoonAutonomousDiscoveryRunCompleted,
  readAutonomousProspectSearchDatamoonMetadata,
  readAutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY,
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
  type AutonomousProspectSearchDatamoonRunMetadata,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { runProspectSearchDatamoonAutonomousDiscovery } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"

export const GROWTH_MISSION_DATAMOON_CANONICAL_DISCOVERY_HANDOFF_LIVE_4B_QA_MARKER =
  "ge-aios-live-4b-mission-datamoon-canonical-discovery-handoff-v1" as const

const CANONICAL_DISCOVERY_AUTHORITY = "autonomous_portfolio" as const

const REQUIRED_CANONICAL_METADATA_FIELDS = [
  "qa_marker",
  "organization_id",
  "business_profile_fingerprint",
  "batch_size",
  "purpose",
  "authority",
] as const

export type MissionPortfolioDatamoonMetadataDiff = {
  missionMissingCanonicalFields: string[]
  portfolioHasCanonicalFields: string[]
  missionEligibleForPortfolioPoller: boolean
}

/** Client-safe metadata audit helper for cert scripts. */
export function diffMissionVsPortfolioDatamoonRunMetadata(input: {
  missionRunProviderMetadata: Record<string, unknown> | null | undefined
  portfolioRunProviderMetadata: Record<string, unknown> | null | undefined
}): MissionPortfolioDatamoonMetadataDiff {
  const missionMeta = input.missionRunProviderMetadata?.[
    AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY
  ] as Record<string, unknown> | undefined
  const portfolioMeta = input.portfolioRunProviderMetadata?.[
    AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY
  ] as Record<string, unknown> | undefined

  const missionMissingCanonicalFields = REQUIRED_CANONICAL_METADATA_FIELDS.filter(
    (field) => missionMeta?.[field] == null,
  ).map(String)

  const portfolioHasCanonicalFields = REQUIRED_CANONICAL_METADATA_FIELDS.filter(
    (field) => portfolioMeta?.[field] != null,
  ).map(String)

  return {
    missionMissingCanonicalFields,
    portfolioHasCanonicalFields,
    missionEligibleForPortfolioPoller: missionMissingCanonicalFields.length === 0,
  }
}

export function isDatamoonRunEligibleForCanonicalDiscoveryPoller(
  run: DatamoonAudienceImportRun,
  organizationId: string,
): boolean {
  const meta = readAutonomousProspectSearchDatamoonMetadata(run)
  return meta?.organization_id === organizationId
}

function buildCanonicalEnrollmentMetadata(input: {
  organizationId: string
  batchSize: number
  fingerprint: string
}): AutonomousProspectSearchDatamoonRunMetadata {
  return {
    qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    organization_id: input.organizationId,
    business_profile_fingerprint: input.fingerprint,
    batch_size: input.batchSize,
    purpose: "prospect_search_intake",
    read_only_proof: false,
    authority: CANONICAL_DISCOVERY_AUTHORITY,
  }
}

async function resolveEnrollmentProjection(
  admin: SupabaseClient,
  organizationId: string,
  batchSize: number,
  generatedAt: string,
) {
  const approved = await getActiveApprovedBusinessProfile(admin, organizationId).catch(() => null)
  if (!approved?.profile) return null

  return buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile: approved.profile,
    companyName: approved.companyName,
    organizationId,
    batchSize,
    generatedAt,
  })
}

export async function enrollMissionBoundDatamoonRunInCanonicalDiscovery(
  admin: SupabaseClient,
  input: {
    organizationId: string
    lastRunId: string | null | undefined
    batchSize: number
    generatedAt: string
  },
): Promise<{ enrolledRunId: string | null; alreadyCanonical: boolean }> {
  const runId = input.lastRunId?.trim()
  if (!runId) {
    return { enrolledRunId: null, alreadyCanonical: false }
  }

  const run = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!run || !isAutonomousProspectSearchDatamoonRun(run)) {
    return { enrolledRunId: null, alreadyCanonical: false }
  }

  if (isDatamoonRunEligibleForCanonicalDiscoveryPoller(run, input.organizationId)) {
    return { enrolledRunId: run.id, alreadyCanonical: true }
  }

  const projection = await resolveEnrollmentProjection(
    admin,
    input.organizationId,
    input.batchSize,
    input.generatedAt,
  )
  if (!projection) {
    return { enrolledRunId: null, alreadyCanonical: false }
  }

  const metadata = buildCanonicalEnrollmentMetadata({
    organizationId: input.organizationId,
    batchSize: input.batchSize,
    fingerprint: projection.fingerprint,
  })

  const enrolled = await attachAutonomousProspectSearchDatamoonMetadata(admin, run.id, metadata, {
    ge_aios_live_4b_mission_canonical_discovery_handoff:
      GROWTH_MISSION_DATAMOON_CANONICAL_DISCOVERY_HANDOFF_LIVE_4B_QA_MARKER,
    prospect_search_query: projection.request.name ?? run.runName,
    targeting_summary: projection.targetingSummary,
    targeting_strategy: projection.targetingSummary.targetingStrategy ?? null,
    firmographic_strategy: projection.targetingSummary.firmographicStrategy ?? null,
  })

  if (enrolled) {
    logGrowthEngine("growth_mission_datamoon_canonical_discovery_enrolled", {
      qa_marker: GROWTH_MISSION_DATAMOON_CANONICAL_DISCOVERY_HANDOFF_LIVE_4B_QA_MARKER,
      organization_id: input.organizationId,
      run_id: enrolled.id,
      run_status: enrolled.status,
    })
  }

  return {
    enrolledRunId: enrolled?.id ?? null,
    alreadyCanonical: false,
  }
}

function resolveLifecycleFromCanonicalRun(input: {
  run: DatamoonAudienceImportRun
  intakePushedCount: number
  previewCount: number
}): { lifecycleState: GrowthMissionLifecycleState; summary: string } {
  if (isDatamoonAutonomousDiscoveryRunActive(input.run)) {
    return {
      lifecycleState: "finding_leads",
      summary: "Monitoring Datamoon audience.",
    }
  }

  if (input.intakePushedCount > 0) {
    return {
      lifecycleState: "researching",
      summary: `Imported ${input.intakePushedCount} new records.`,
    }
  }

  if (isDatamoonAutonomousDiscoveryRunCompleted(input.run) && input.previewCount > 0) {
    return {
      lifecycleState: "finding_leads",
      summary: `Found ${input.previewCount} new preview leads.`,
    }
  }

  return {
    lifecycleState: "monitoring",
    summary: "Monitoring Datamoon audience.",
  }
}

export async function syncMissionRuntimeFromCanonicalDiscovery(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runtime: GrowthObjectiveMissionRuntimeState
  },
): Promise<GrowthObjectiveMissionRuntimeState | null> {
  const binding = input.runtime.datamoon
  if (!binding) return null

  const activeRun = await findActiveAutonomousProspectSearchDatamoonRun(admin, input.organizationId)
  const boundRun =
    activeRun ??
    (binding.lastRunId?.trim()
      ? await fetchDatamoonAudienceImportRunById(admin, binding.lastRunId)
      : null)

  if (!boundRun || !isDatamoonRunEligibleForCanonicalDiscoveryPoller(boundRun, input.organizationId)) {
    return null
  }

  const intake = readAutonomousRunIntakeLifecycleFields(boundRun)
  const previewCount = boundRun.previewCount ?? 0
  const recordsImported = intake.intake_pushed_count ?? binding.lastImportedCount ?? 0
  const newCompaniesFound = Math.max(previewCount, input.runtime.counters.newCompaniesFound ?? 0)
  const researchingCount =
    recordsImported > 0 ? recordsImported : input.runtime.counters.researchingCount ?? 0

  const lifecycle = resolveLifecycleFromCanonicalRun({
    run: boundRun,
    intakePushedCount: recordsImported,
    previewCount,
  })

  const counters = {
    ...input.runtime.counters,
    newCompaniesFound,
    recordsImported,
    researchingCount,
  }

  const datamoon = {
    ...binding,
    lastRunId: boundRun.id,
    lastPollAt: boundRun.lastPolledAt ?? binding.lastPollAt,
    lastImportedCount: recordsImported,
  }

  const unchanged =
    input.runtime.lifecycleState === lifecycle.lifecycleState &&
    input.runtime.datamoon?.lastRunId === datamoon.lastRunId &&
    input.runtime.datamoon?.lastPollAt === datamoon.lastPollAt &&
    input.runtime.counters.recordsImported === counters.recordsImported &&
    input.runtime.counters.newCompaniesFound === counters.newCompaniesFound

  if (unchanged) {
    return {
      ...input.runtime,
      datamoon,
      counters,
    }
  }

  return {
    ...input.runtime,
    lifecycleState: lifecycle.lifecycleState,
    activityLabel: missionLifecycleActivityLabel(lifecycle.lifecycleState, counters),
    datamoon,
    counters,
    events: [
      ...input.runtime.events,
      {
        id: `mre-${lifecycle.summary}-${boundRun.lastPolledAt ?? new Date().toISOString()}`,
        at: new Date().toISOString(),
        summary: lifecycle.summary,
        lifecycleState: lifecycle.lifecycleState,
      },
    ].slice(-20),
  }
}

export async function handoffMissionDatamoonDiscoveryCreationToCanonicalRuntime(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runtime: GrowthObjectiveMissionRuntimeState
    batchSize: number
    generatedAt: string
    actorUserId: string | null
  },
): Promise<GrowthObjectiveMissionRuntimeState | null> {
  const activeRun = await findActiveAutonomousProspectSearchDatamoonRun(admin, input.organizationId)
  if (activeRun) {
    return syncMissionRuntimeFromCanonicalDiscovery(admin, {
      organizationId: input.organizationId,
      runtime: input.runtime,
    })
  }

  const approved = await getActiveApprovedBusinessProfile(admin, input.organizationId).catch(() => null)
  if (!approved?.profile) return null

  const query = buildProspectSearchQueryFromBusinessProfile(approved.profile)
  const filters = buildProspectSearchFiltersFromBusinessProfile(approved.profile)

  const discovery = await runProspectSearchDatamoonAutonomousDiscovery(admin, {
    organizationId: input.organizationId,
    approvedProfile: approved.profile,
    companyName: approved.companyName,
    query,
    filters,
    limit: input.batchSize,
    generatedAt: input.generatedAt,
    createdBy: input.actorUserId,
    authority: CANONICAL_DISCOVERY_AUTHORITY,
  })

  if (!discovery.runId) return null

  logGrowthEngine("growth_mission_datamoon_canonical_discovery_handoff", {
    qa_marker: GROWTH_MISSION_DATAMOON_CANONICAL_DISCOVERY_HANDOFF_LIVE_4B_QA_MARKER,
    organization_id: input.organizationId,
    run_id: discovery.runId,
    job_created: discovery.jobCreated,
    job_reused: discovery.jobReused,
    job_active: discovery.jobActive,
    stop_reason: discovery.stopReason,
  })

  const binding = input.runtime.datamoon
  if (!binding) return null

  const counters = {
    ...input.runtime.counters,
    newCompaniesFound: discovery.rawCompanyCount ?? input.runtime.counters.newCompaniesFound ?? 0,
  }

  const lifecycleState: GrowthMissionLifecycleState = discovery.jobActive
    ? "finding_leads"
    : input.runtime.lifecycleState

  return {
    ...input.runtime,
    lifecycleState,
    activityLabel: missionLifecycleActivityLabel(lifecycleState, counters),
    datamoon: {
      ...binding,
      lastRunId: discovery.runId,
      lastPollAt: binding.lastPollAt,
      lastImportedCount: binding.lastImportedCount ?? 0,
    },
    counters,
    events: [
      ...input.runtime.events,
      {
        id: `mre-canonical-handoff-${discovery.runId}`,
        at: input.generatedAt,
        summary: discovery.jobActive
          ? "Canonical autonomous discovery owns this audience run."
          : "Datamoon audience refresh handed off.",
        lifecycleState,
      },
    ].slice(-20),
  }
}

export function missionDatamoonRunUsesCanonicalDiscoveryPrefix(runName: string): boolean {
  return runName.startsWith(`${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:`)
}
