/** GE-AIOS-RUNTIME-SCALE-1B — Idempotent production research budget migration (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGrowthAutonomySettings,
  upsertGrowthAutonomySettings,
} from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import { getAutonomyBudgetSnapshot } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import {
  GROWTH_ORG_RESEARCH_HEADROOM_PER_DAY,
  GROWTH_ORG_RESEARCH_TARGET_PER_DAY,
  GROWTH_RUNTIME_SCALE_1A_QA_MARKER,
} from "@/lib/growth/specialists/execution/growth-runtime-scale-1a"

export const GROWTH_RUNTIME_SCALE_1B_QA_MARKER = "ge-aios-runtime-scale-1b-policy-activation-v1" as const

export type ScaleResearchBudgetMigrationResult = {
  qaMarker: typeof GROWTH_RUNTIME_SCALE_1B_QA_MARKER
  organizationId: string
  beforeCap: number
  afterCap: number
  migrated: boolean
  skippedReason: string | null
  enforcedCap: number | null
  budgetConsumed: number | null
  budgetRemaining: number | null
}

/** Canonical migration — does not depend on Home page load. */
export async function applyScaleResearchBudgetForProductionOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<ScaleResearchBudgetMigrationResult> {
  const settings = await fetchGrowthAutonomySettings(admin, organizationId)
  const beforeCap = settings.dailyBudgetLimits.autonomous_research_runs ?? 0

  if (beforeCap >= GROWTH_ORG_RESEARCH_TARGET_PER_DAY) {
    const snapshot = await getAutonomyBudgetSnapshot(admin, {
      organizationId,
      capability: "research",
    }).catch(() => null)
    return {
      qaMarker: GROWTH_RUNTIME_SCALE_1B_QA_MARKER,
      organizationId,
      beforeCap,
      afterCap: beforeCap,
      migrated: false,
      skippedReason: "already_at_target",
      enforcedCap: snapshot?.cap ?? beforeCap,
      budgetConsumed: snapshot?.consumed ?? null,
      budgetRemaining: snapshot?.remaining ?? null,
    }
  }

  const next = await upsertGrowthAutonomySettings(admin, organizationId, {
    dailyBudgetLimits: {
      ...settings.dailyBudgetLimits,
      autonomous_research_runs: GROWTH_ORG_RESEARCH_TARGET_PER_DAY,
    },
    capabilityToggles: {
      ...settings.capabilityToggles,
      research: true,
    },
  })

  const afterCap = next.dailyBudgetLimits.autonomous_research_runs ?? 0
  const snapshot = await getAutonomyBudgetSnapshot(admin, {
    organizationId,
    capability: "research",
  }).catch(() => null)

  return {
    qaMarker: GROWTH_RUNTIME_SCALE_1B_QA_MARKER,
    organizationId,
    beforeCap,
    afterCap,
    migrated: afterCap >= GROWTH_ORG_RESEARCH_TARGET_PER_DAY,
    skippedReason: null,
    enforcedCap: snapshot?.cap ?? afterCap,
    budgetConsumed: snapshot?.consumed ?? null,
    budgetRemaining: snapshot?.remaining ?? null,
  }
}

export function resolveScaleResearchHeadroomCap(configuredCap: number): number {
  return Math.max(configuredCap, GROWTH_ORG_RESEARCH_HEADROOM_PER_DAY)
}

export { GROWTH_RUNTIME_SCALE_1A_QA_MARKER, GROWTH_ORG_RESEARCH_TARGET_PER_DAY, GROWTH_ORG_RESEARCH_HEADROOM_PER_DAY }
