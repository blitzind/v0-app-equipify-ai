/** GE-AIOS-LAUNCH-1C — One-time Ava activation (existing runtime kill switches only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthAvaEmploymentStats } from "@/lib/growth/ava-activation/growth-ava-employment-stats-loader-1c"
import {
  type GrowthAvaActivationState,
} from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { applyScaleResearchBudgetForProductionOrg } from "@/lib/growth/ava-activation/growth-scale-research-budget-1b"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import {
  setOrganizationAiTeammateAutonomousActivation,
} from "@/lib/growth/settings/growth-ai-teammate-identity-repository"
import {
  setRuntimeKillSwitch,
} from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { runGrowthAvaActivationImmediateProductionTick } from "@/lib/growth/ava-activation/growth-ava-activation-immediate-tick-burn-in-1a"
import type { GrowthAvaActivationImmediateTick } from "@/lib/growth/ava-activation/growth-ava-activation-immediate-tick-burn-in-1a"
import { loadGrowthAvaActivationStateCore } from "@/lib/growth/training/growth-canonical-organization-training-projection-1d-hotfix"

/** Minimum daily research runs enabled on activation when budget was disabled (0 = off). */
export const GROWTH_AVA_ACTIVATION_RESEARCH_DAILY_BUDGET_LAUNCH_1D = 500 as const

export async function ensureScaleResearchBudgetForActivatedOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  await applyScaleResearchBudgetForProductionOrg(admin, organizationId)
}

async function ensureActivationResearchBudgetEnabled(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  await applyScaleResearchBudgetForProductionOrg(admin, organizationId)
}

export async function loadGrowthAvaActivationState(input: {
  admin: SupabaseClient
  organizationId: string
  actorUserId: string
  generatedAt: string
  salesOutcomes: GrowthHomeSalesOutcomesPayload
  missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null
}): Promise<GrowthAvaActivationState> {
  const core = await loadGrowthAvaActivationStateCore({
    admin: input.admin,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    generatedAt: input.generatedAt,
  })

  const employment = core.activated
    ? await buildGrowthAvaEmploymentStats({
        admin: input.admin,
        organizationId: input.organizationId,
        activatedAt: core.activatedAt,
        salesOutcomes: input.salesOutcomes,
        missionDiscovery: input.missionDiscovery,
        generatedAt: input.generatedAt,
      })
    : null

  return {
    ...core,
    employment,
  }
}

export async function activateGrowthAvaAutonomousMode(input: {
  admin: SupabaseClient
  organizationId: string
  actorUserId: string
  generatedAt: string
  salesOutcomes: GrowthHomeSalesOutcomesPayload
  missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null
}): Promise<{
  activation: GrowthAvaActivationState
  immediateTick: GrowthAvaActivationImmediateTick | null
}> {
  const current = await loadGrowthAvaActivationState(input)

  if (!current.readiness.ready) {
    throw new Error("Setup is not complete. Finish the remaining steps before activating Ava.")
  }

  const shouldRunImmediateTick =
    !current.activated || !current.autonomyEnabled || !current.objectiveModeEnabled

  if (!current.autonomyEnabled) {
    await setRuntimeKillSwitch(input.admin, { key: "autonomy_enabled", enabled: true })
  }
  if (!current.objectiveModeEnabled) {
    await setRuntimeKillSwitch(input.admin, { key: "autonomy_objective_mode_enabled", enabled: true })
  }

  if (!current.activatedAt) {
    await setOrganizationAiTeammateAutonomousActivation(input.admin, {
      organizationId: input.organizationId,
      activatedByUserId: input.actorUserId,
      activatedAt: input.generatedAt,
    })
  }

  if (shouldRunImmediateTick) {
    await ensureActivationResearchBudgetEnabled(input.admin, input.organizationId)
  await ensureScaleResearchBudgetForActivatedOrg(input.admin, input.organizationId)
  }

  const activation = await loadGrowthAvaActivationState(input)

  const immediateTick = shouldRunImmediateTick
    ? await runGrowthAvaActivationImmediateProductionTick({
        admin: input.admin,
        organizationId: input.organizationId,
      })
    : null

  return { activation, immediateTick }
}
