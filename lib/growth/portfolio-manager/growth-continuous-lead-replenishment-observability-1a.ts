/**
 * AVA-CONTINUOUS-LEAD-REPLENISHMENT-1A — Discovery replenishment observability (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  selectNextDatamoonDiscoverySearchSlice,
  summarizeDiscoverySearchSliceState,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a"
import {
  emptyDatamoonDiscoverySearchSliceState,
  GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import { readDiscoverySearchSliceStateFromPortfolioMemory } from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-state-1a"
import { parsePortfolioManagerMemoryFromStore } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { buildActiveCandidateInventorySnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-candidate-inventory-1a"
import { GROWTH_AUTONOMOUS_CANDIDATE_INVENTORY_1A_QA_MARKER } from "@/lib/growth/portfolio-manager/growth-autonomous-candidate-inventory-1a"
import { resolveAutonomousPortfolioDiscoveryExecutionPlan } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a"
import { buildDatamoonAutonomousDiscoveryHealthSnapshot } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-health-1a"
import { findLatestIntakePendingAutonomousProspectSearchDatamoonRun } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import { AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { isExternalDiscoveryLeadIntakeSource } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"

export const AVA_CONTINUOUS_LEAD_REPLENISHMENT_1A_QA_MARKER =
  "ava-continuous-lead-replenishment-1a-v1" as const

export const AVA_DISCOVERY_SEARCH_DIVERSITY_AND_EXHAUSTION_1A_QA_MARKER =
  GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER

export type DiscoveryReplenishmentState =
  | "healthy"
  | "replenishing"
  | "provider_wait"
  | "intake_pending"
  | "blocked"

function isExternalDiscoveryMetadata(metadata: Record<string, unknown>): boolean {
  const intake = resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata(metadata)
  return isExternalDiscoveryLeadIntakeSource(intake)
}

async function loadDraftFactoryInventoryStates(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Map<string, { state: string; pausedReason?: string | null }>> {
  const { data } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, paused_reason")
    .eq("organization_id", organizationId)

  return new Map(
    (data ?? []).map((row) => [
      String(row.lead_id),
      { state: String(row.state), pausedReason: (row.paused_reason as string | null) ?? null },
    ]),
  )
}

async function countNewExternalLeadsSince(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<number> {
  const { data } = await admin
    .schema("growth")
    .from("leads")
    .select("id, metadata, created_at")
    .eq("promoted_organization_id", organizationId)
    .gte("created_at", sinceIso)

  return (data ?? []).filter((row) =>
    isExternalDiscoveryMetadata((row.metadata ?? {}) as Record<string, unknown>),
  ).length
}

export async function loadContinuousLeadReplenishmentObservability(
  admin: SupabaseClient,
  input: {
    organizationId?: string
    generatedAt?: string
  } = {},
): Promise<Record<string, unknown>> {
  const organizationId = input.organizationId ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const now = Date.parse(generatedAt)
  const windows = {
    h1: new Date(now - 3600000).toISOString(),
    h6: new Date(now - 6 * 3600000).toISOString(),
    h24: new Date(now - 24 * 3600000).toISOString(),
    d7: new Date(now - 7 * 24 * 3600000).toISOString(),
  }

  const [
    snapshot,
    approvedProfile,
    missionDiscovery,
    datamoonHealth,
    intakePendingRun,
    draftFactoryStateByLeadId,
    recentRuns,
    newestExternalLead,
  ] = await Promise.all([
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId, generatedAt }),
    getActiveApprovedBusinessProfile(admin, organizationId).catch(() => null),
    loadGrowthHomeMissionDiscoverySnapshot(admin, { organizationId }).catch(() => null),
    buildDatamoonAutonomousDiscoveryHealthSnapshot(admin).catch(() => null),
    findLatestIntakePendingAutonomousProspectSearchDatamoonRun(admin, organizationId).catch(
      () => null,
    ),
    loadDraftFactoryInventoryStates(admin, organizationId),
    admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select(
        "id, status, created_at, completed_at, preview_count, imported_count, duplicate_count, provider_metadata, error_message",
      )
      .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
      .filter(
        "provider_metadata->autonomous_prospect_search_1a->>organization_id",
        "eq",
        organizationId,
      )
      .order("created_at", { ascending: false })
      .limit(10)
      .then((r) => r.data ?? []),
    admin
      .schema("growth")
      .from("leads")
      .select("id, company_name, website, created_at, metadata")
      .eq("promoted_organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then((r) =>
        (r.data ?? []).find((row) =>
          isExternalDiscoveryMetadata((row.metadata ?? {}) as Record<string, unknown>),
        ) ?? null,
      ),
  ])

  if (!snapshot) {
    return {
      qaMarker: AVA_CONTINUOUS_LEAD_REPLENISHMENT_1A_QA_MARKER,
      organizationId,
      error: "portfolio_snapshot_unavailable",
    }
  }

  const inventory = buildActiveCandidateInventorySnapshot({
    organizationId,
    leads: snapshot.portfolioLeads,
    eligibleLeadCount: snapshot.eligibleLeadCount,
    draftFactoryStateByLeadId,
  })

  const portfolioManager = buildGrowthPortfolioManagerSnapshot({
    organizationId,
    generatedAt,
    leads: snapshot.portfolioLeads,
    eligibleLeadCount: snapshot.eligibleLeadCount,
    approvedProfile: approvedProfile?.profile ?? null,
    organizationalMemory: snapshot.organizationalMemory.store,
    missionDiscovery,
    draftFactoryStateByLeadId,
    intakePendingPending: Boolean(intakePendingRun),
  })

  const portfolioMemory = parsePortfolioManagerMemoryFromStore(snapshot.organizationalMemory.store)
  const sliceState =
    readDiscoverySearchSliceStateFromPortfolioMemory(portfolioMemory) ??
    emptyDatamoonDiscoverySearchSliceState()
  const sliceSummary = summarizeDiscoverySearchSliceState(sliceState)
  const currentSlice =
    sliceState.currentSliceKey != null ? sliceState.slices[sliceState.currentSliceKey] ?? null : null
  const nextSearchSlice =
    approvedProfile?.profile != null
      ? selectNextDatamoonDiscoverySearchSlice({
          projection: projectApprovedBusinessProfileToLeadDiscovery(
            approvedProfile.profile,
            approvedProfile.companyName,
          ),
          state: sliceState,
          generatedAt,
        })
      : null

  const executionPlan = resolveAutonomousPortfolioDiscoveryExecutionPlan(portfolioManager.replenishment)

  const [newH1, newH6, newH24, newD7] = await Promise.all([
    countNewExternalLeadsSince(admin, organizationId, windows.h1),
    countNewExternalLeadsSince(admin, organizationId, windows.h6),
    countNewExternalLeadsSince(admin, organizationId, windows.h24),
    countNewExternalLeadsSince(admin, organizationId, windows.d7),
  ])

  const lastSuccessfulRun =
    recentRuns.find((row) => row.status === "completed" && (row.preview_count ?? 0) > 0) ??
    recentRuns.find((row) => row.status === "completed") ??
    null

  const lastProviderRun = recentRuns[0] ?? null
  const buildingRun = recentRuns.find((row) => row.status === "building") ?? null

  let discoveryState: DiscoveryReplenishmentState = "blocked"
  if (buildingRun) {
    discoveryState = "provider_wait"
  } else if (intakePendingRun) {
    discoveryState = "intake_pending"
  } else if (executionPlan.action === "start_new" || executionPlan.action === "resume_active") {
    discoveryState = "replenishing"
  } else if (portfolioManager.health.healthState === "healthy") {
    discoveryState = "healthy"
  } else if (executionPlan.action === "resume_intake_pending") {
    discoveryState = "intake_pending"
  }

  return {
    qaMarker: AVA_CONTINUOUS_LEAD_REPLENISHMENT_1A_QA_MARKER,
    candidateInventoryQaMarker: GROWTH_AUTONOMOUS_CANDIDATE_INVENTORY_1A_QA_MARKER,
    organizationId,
    generatedAt,
    newCompaniesVelocity: {
      externalDiscovery: { h1: newH1, h6: newH6, h24: newH24, d7: newD7 },
    },
    activeCandidateInventory: inventory,
    portfolioHealth: portfolioManager.health,
    replenishment: portfolioManager.replenishment,
    executionPlan,
    missionDiscovery,
    datamoonHealth,
    lastDiscovery: portfolioManager.memory.lastDiscoveryAt,
    lastProviderRun: lastProviderRun
      ? {
          id: lastProviderRun.id,
          status: lastProviderRun.status,
          createdAt: lastProviderRun.created_at,
          completedAt: lastProviderRun.completed_at,
          previewCount: lastProviderRun.preview_count,
          importedCount: lastProviderRun.imported_count,
        }
      : null,
    lastSuccessfulDataMoonRun: lastSuccessfulRun,
    intakePendingRun: intakePendingRun
      ? {
          id: intakePendingRun.id,
          status: intakePendingRun.status,
          previewCount: intakePendingRun.previewCount,
          completedAt: intakePendingRun.completedAt,
        }
      : null,
    lastNewCompanyIngested: newestExternalLead
      ? {
          id: newestExternalLead.id,
          companyName: newestExternalLead.company_name,
          website: newestExternalLead.website,
          createdAt: newestExternalLead.created_at,
        }
      : null,
    discoveryState,
    nextReplenishmentReason: executionPlan.reason ?? portfolioManager.replenishment.reason,
    recentAutonomousRuns: recentRuns,
    discoverySearchSlice: {
      qaMarker: AVA_DISCOVERY_SEARCH_DIVERSITY_AND_EXHAUSTION_1A_QA_MARKER,
      currentSearchSlice: portfolioMemory.lastDiscoverySearchSliceSelection
        ? {
            sliceKey: portfolioMemory.lastDiscoverySearchSliceSelection.sliceKey,
            vertical: portfolioMemory.lastDiscoverySearchSliceSelection.clusterId,
            geography: portfolioMemory.lastDiscoverySearchSliceSelection.geoBucketLabel,
            topicVariantIndex: portfolioMemory.lastDiscoverySearchSliceSelection.topicVariantIndex,
            selectionReason: portfolioMemory.lastDiscoverySearchSliceSelection.selectionReason,
          }
        : null,
      sliceNovelty: currentSlice
        ? {
            lastSelected: currentSlice.lastSelectedCount,
            lastNew: currentSlice.lastPushedCount,
            lastExisting: currentSlice.lastExistingCount,
            lastNoveltyRate: currentSlice.lastNoveltyRate,
          }
        : null,
      consecutiveLowNoveltyRuns: currentSlice?.consecutiveLowNoveltyRuns ?? 0,
      exhaustedSlices: sliceSummary.exhaustedSliceKeys,
      nextSearchSlice: nextSearchSlice
        ? {
            sliceKey: nextSearchSlice.sliceKey,
            vertical: nextSearchSlice.clusterId,
            geography: nextSearchSlice.geoBucketLabel,
            topicVariantIndex: nextSearchSlice.topicVariantIndex,
            selectionReason: nextSearchSlice.selectionReason,
          }
        : null,
      sliceStateSummary: sliceSummary,
    },
  }
}
