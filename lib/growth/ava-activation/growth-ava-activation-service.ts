/** GE-AIOS-LAUNCH-1C — One-time Ava activation (existing runtime kill switches only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthAvaEmploymentStats } from "@/lib/growth/ava-activation/growth-ava-employment-stats-loader-1c"
import { evaluateGrowthAvaActivationReadiness } from "@/lib/growth/ava-activation/growth-ava-activation-readiness-1c"
import {
  GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
  type GrowthAvaActivationState,
} from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import {
  getAiTeammateOnboardingCompletedForUser,
  getOrganizationAiTeammateAutonomousActivation,
  setOrganizationAiTeammateAutonomousActivation,
} from "@/lib/growth/settings/growth-ai-teammate-identity-repository"
import { buildConnectedMailboxesDashboard } from "@/lib/growth/mailboxes/connected-mailboxes-dashboard"
import { buildGrowthOperatorSetupHealth } from "@/lib/growth/operational/ge-v1-2-operator-setup-health-service"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import {
  getRuntimeKillSwitchStates,
  setRuntimeKillSwitch,
} from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { runGrowthAvaActivationImmediateProductionTick } from "@/lib/growth/ava-activation/growth-ava-activation-immediate-tick-burn-in-1a"
import type { GrowthAvaActivationImmediateTick } from "@/lib/growth/ava-activation/growth-ava-activation-immediate-tick-burn-in-1a"

export async function loadGrowthAvaActivationState(input: {
  admin: SupabaseClient
  organizationId: string
  actorUserId: string
  generatedAt: string
  salesOutcomes: GrowthHomeSalesOutcomesPayload
  missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null
}): Promise<GrowthAvaActivationState> {
  const actorUserId = input.actorUserId.trim()
  if (!actorUserId || actorUserId === "undefined") {
    throw new Error("actorUserId is required for Ava activation state.")
  }

  const [
    killSwitches,
    activationRecord,
    onboardingCompleted,
    approvedProfile,
    objectives,
    mailboxesDashboard,
    setupHealth,
    autonomySettings,
  ] = await Promise.all([
    getRuntimeKillSwitchStates(input.admin),
    getOrganizationAiTeammateAutonomousActivation(input.admin, input.organizationId),
    getAiTeammateOnboardingCompletedForUser(input.admin, actorUserId),
    getActiveApprovedBusinessProfile(input.admin, input.organizationId),
    listGrowthObjectives(input.admin, input.organizationId),
    buildConnectedMailboxesDashboard(input.admin),
    buildGrowthOperatorSetupHealth(input.admin, {
      organizationId: input.organizationId,
      userId: actorUserId,
    }),
    fetchGrowthAutonomySettings(input.admin, input.organizationId),
  ])

  const connectedMailboxes = mailboxesDashboard.summary.connectedMailboxes
  const expiredMailboxes = mailboxesDashboard.summary.disconnectedMailboxes
  const mailboxWarnings = setupHealth.warningCount

  const readiness = evaluateGrowthAvaActivationReadiness({
    businessProfileApproved: Boolean(approvedProfile),
    objectives,
    mailboxWarnings,
    expiredMailboxes,
    connectedMailboxes,
    aiTeammateOnboardingCompleted: onboardingCompleted,
    approvalPolicies: autonomySettings.approvalPolicies,
  })

  const autonomyEnabled = killSwitches.autonomy_enabled === true
  const objectiveModeEnabled = killSwitches.autonomy_objective_mode_enabled === true

  const activatedAt =
    activationRecord?.autonomousActivatedAt ??
    (autonomyEnabled && objectiveModeEnabled ? approvedProfile?.approvedAt ?? null : null)

  const activated = activatedAt != null && autonomyEnabled && objectiveModeEnabled

  const employment = activated
    ? await buildGrowthAvaEmploymentStats({
        admin: input.admin,
        organizationId: input.organizationId,
        activatedAt,
        salesOutcomes: input.salesOutcomes,
        missionDiscovery: input.missionDiscovery,
        generatedAt: input.generatedAt,
      })
    : null

  return {
    qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
    activated,
    activatedAt,
    autonomyEnabled,
    objectiveModeEnabled,
    readiness,
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

  const activation = await loadGrowthAvaActivationState(input)

  const immediateTick = shouldRunImmediateTick
    ? await runGrowthAvaActivationImmediateProductionTick({
        admin: input.admin,
        organizationId: input.organizationId,
      })
    : null

  return { activation, immediateTick }
}
