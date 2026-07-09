/**
 * GE-AIOS-HOTFIX-16X-1 — Defensive defaults for Home runtime partial payloads.
 * Client-safe boundary normalization (no architecture changes).
 */

import { buildGrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
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

/** Normalize workspace-summary payload when newer runtime fields are absent (production skew). */
export function normalizeGrowthHomeWorkspaceSummaryPayload(
  payload: Partial<GrowthHomeWorkspaceSummaryPayload> & { ok?: boolean },
): GrowthHomeWorkspaceSummaryPayload {
  const relationshipSnapshots =
    payload.relationshipSnapshots ?? emptyGrowthHomeRelationshipSnapshots()
  const leadPool = payload.leadPool ?? emptyGrowthHomeLeadPoolSummary()

  return {
    ...(payload as GrowthHomeWorkspaceSummaryPayload),
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

  return {
    ...hero,
    storyBlocks,
    briefingNarrative: hero.briefingNarrative ?? storyBlocks.map((block) => block.text),
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
  }
}
