/**
 * GE-AIOS-HOTFIX-16X-1 — Defensive defaults for Home runtime partial payloads.
 * Client-safe boundary normalization (no architecture changes).
 */

import { buildGrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import { GROWTH_SERVER_ORG_MEMORY_QA_MARKER } from "@/lib/growth/memory/storage/organization-memory-types"
import {
  GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
  emptyOrganizationalKnowledgeStore,
} from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "@/lib/growth/specialists/execution/sales-outcome-types"
import {
  GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER,
  type GrowthHomeRelationshipSnapshotEnrichment,
  type GrowthHomeWorkspaceSummaryPayload,
} from "@/lib/growth/home/growth-home-workspace-summary-types"
import type { AvaSpecialistOrchestratorResult } from "@/lib/growth/specialists/types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import type { GrowthHomeAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthHomeAvaHeroViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"

export const GROWTH_HOME_RUNTIME_HOTFIX_16X_1_QA_MARKER =
  "ge-aios-hotfix-16x-1-home-runtime-undefined-arrays-v1" as const

export function emptyGrowthHomeRelationshipSnapshots(): GrowthHomeRelationshipSnapshotEnrichment {
  return {
    qaMarker: GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER,
    byLeadId: {},
    meta: {
      attempted: 0,
      enriched: 0,
      degraded: true,
      warning: "relationship_snapshots_missing",
      queryCount: 0,
    },
  }
}

export function emptyGrowthHomeLeadPoolSummary() {
  return buildGrowthHomeLeadPoolSummary({
    visibleLeads: [],
    totalEstimatedCount: null,
    relationshipSnapshotCount: 0,
    degraded: true,
    fetchedHasMore: false,
  })
}

export function emptyGrowthHomeSalesOutcomes(generatedAt: string) {
  return {
    qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
    outcomes: [],
    dailySummary: {
      qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
      generatedAt,
      researched: 0,
      qualified: 0,
      strong_opportunities: 0,
      outreach_prepared: 0,
      meetings_prepared: 0,
      approvals_pending: 0,
    },
  }
}

export function emptyGrowthHomeOrganizationMemory(input: {
  organizationId: string
  generatedAt: string
}): import("@/lib/growth/memory/storage/organization-memory-types").GrowthHomeOrganizationMemoryPayload {
  return {
    qaMarker: GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
    store: {
      organizationId: input.organizationId,
      capturedAt: input.generatedAt,
      events: [],
      preferences: [],
    },
    source: "empty",
    degraded: true,
    warning: "organization_memory_missing",
  }
}

export function emptyGrowthHomeOrganizationKnowledge(input: {
  organizationId: string
  generatedAt: string
}): import("@/lib/growth/memory/knowledge/organization-knowledge-types").GrowthHomeOrganizationalKnowledgePayload {
  return {
    qaMarker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
    store: emptyOrganizationalKnowledgeStore(input),
    source: "empty",
    degraded: true,
    warning: "organization_knowledge_missing",
  }
}

/** Normalize workspace-summary payload when newer runtime fields are absent (production skew). */
export function normalizeGrowthHomeWorkspaceSummaryPayload(
  payload: Partial<GrowthHomeWorkspaceSummaryPayload> & { ok?: boolean },
): GrowthHomeWorkspaceSummaryPayload {
  const relationshipSnapshots =
    payload.relationshipSnapshots ?? emptyGrowthHomeRelationshipSnapshots()
  const leadPool = payload.leadPool ?? emptyGrowthHomeLeadPoolSummary()
  const generatedAt = payload.generatedAt ?? new Date().toISOString()
  const organizationId = payload.organizationalMemory?.store.organizationId ?? "local-organization"

  return {
    ...(payload as GrowthHomeWorkspaceSummaryPayload),
    briefing: null,
    salesOutcomes: payload.salesOutcomes ?? emptyGrowthHomeSalesOutcomes(generatedAt),
    organizationalMemory:
      payload.organizationalMemory ??
      emptyGrowthHomeOrganizationMemory({ organizationId, generatedAt }),
    organizationalKnowledge:
      payload.organizationalKnowledge ??
      emptyGrowthHomeOrganizationKnowledge({ organizationId, generatedAt }),
    relationshipSnapshots: {
      ...relationshipSnapshots,
      byLeadId: relationshipSnapshots.byLeadId ?? {},
      meta: {
        attempted: relationshipSnapshots.meta?.attempted ?? 0,
        enriched: relationshipSnapshots.meta?.enriched ?? 0,
        degraded: relationshipSnapshots.meta?.degraded ?? true,
        warning: relationshipSnapshots.meta?.warning ?? "relationship_snapshots_missing",
        queryCount: relationshipSnapshots.meta?.queryCount ?? 0,
      },
    },
    leadPool,
    missionDiscovery: payload.missionDiscovery ?? null,
    canonicalOperatorFocus: payload.canonicalOperatorFocus ?? null,
    canonicalOrganizationTraining: payload.canonicalOrganizationTraining ?? null,
  }
}

export function normalizeAvaWorkManagerResult(
  result: AvaWorkManagerResult | null | undefined,
): AvaWorkManagerResult | null {
  if (!result) return null

  return {
    ...result,
    work_plan: result.work_plan ?? [],
    blocked: result.blocked ?? [],
    completed_today: result.completed_today ?? [],
    deferred: result.deferred ?? [],
    interruptions: result.interruptions ?? [],
    operator_queue: result.operator_queue ?? [],
    all_work_items: result.all_work_items ?? [],
    specialist_orchestrator_result: result.specialist_orchestrator_result
      ? normalizeAvaSpecialistOrchestratorResult(result.specialist_orchestrator_result)
      : result.specialist_orchestrator_result ?? null,
  }
}

export function normalizeAvaSpecialistOrchestratorResult(
  result: AvaSpecialistOrchestratorResult | null | undefined,
): AvaSpecialistOrchestratorResult | null {
  if (!result) return null

  return {
    ...result,
    assignments: result.assignments ?? [],
    team_status: result.team_status ?? [],
    routed_work_items: result.routed_work_items ?? [],
  }
}

export function normalizeGrowthHomeAvaHeroViewModel(
  hero: GrowthHomeAvaHeroViewModel,
): GrowthHomeAvaHeroViewModel {
  const storyBlocks = hero.storyBlocks ?? hero.dailyBriefing?.story_blocks ?? []
  const dailyActivityNarrative =
    hero.dailyActivityNarrative ?? hero.dailyBriefing?.daily_activity_narrative ?? null

  return {
    ...hero,
    storyBlocks,
    dailyActivityNarrative,
    briefingNarrative:
      hero.briefingNarrative ??
      dailyActivityNarrative?.lines.map((row) => row.text) ??
      storyBlocks.map((block) => block.text),
    currentActivities: hero.currentActivities ?? [],
    sinceLastVisit: hero.sinceLastVisit ?? [],
    workManager: normalizeAvaWorkManagerResult(hero.workManager),
    specialistOrchestrator: normalizeAvaSpecialistOrchestratorResult(hero.specialistOrchestrator),
  }
}

export function normalizeGrowthHomeAiOsUxViewModel(
  aiOsUx: GrowthHomeAiOsUxViewModel,
): GrowthHomeAiOsUxViewModel {
  return {
    ...aiOsUx,
    waitingOnYou: aiOsUx.waitingOnYou ?? [],
    dailyWorkQueue: aiOsUx.dailyWorkQueue ?? [],
    throughput: aiOsUx.throughput ?? [],
    waitingOnYouOverflow: aiOsUx.waitingOnYouOverflow ?? 0,
    approveItemsCount: aiOsUx.approveItemsCount ?? 0,
    canonicalOperatorTask: aiOsUx.canonicalOperatorTask ?? null,
    canonicalApprovalSnapshot: aiOsUx.canonicalApprovalSnapshot ?? null,
    canonicalActiveMissions: aiOsUx.canonicalActiveMissions ?? null,
    canonicalOperatorFocus: aiOsUx.canonicalOperatorFocus ?? null,
    canonicalOperatorProgress: aiOsUx.canonicalOperatorProgress ?? null,
  }
}
