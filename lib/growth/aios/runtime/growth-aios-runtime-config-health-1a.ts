import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { isCommunicationStrategyEnabled } from "@/lib/growth/contact-verification/communication-strategy-feature"
import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { DOCUMENTED_EQUIPIFY_AI_OS_PRODUCTION_ORG_ID } from "@/lib/growth/growth-engine-workspace-organization"
import { isSchedulerEligibilityMigrationReady } from "@/lib/growth/objectives/growth-objective-repository"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  GROWTH_AIOS_LIVE_RUNTIME_CONFIG_PROOF_1A_QA_MARKER,
  type GrowthAiosRuntimeConfigHealthSnapshot,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-types"

function isOrganizationEnvPresent(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GROWTH_ENGINE_AI_ORG_ID?.trim())
}

function isOrganizationEnvValidUuid(env: NodeJS.ProcessEnv = process.env): boolean {
  return getGrowthEngineAiOrgId(env) !== null
}

async function countSchedulerObjectives(
  admin: SupabaseClient,
  input: { schedulerMigrationReady: boolean },
): Promise<{ activeObjectiveCount: number | null; dueRunningObjectiveCount: number | null }> {
  const objectivesTable = admin.schema("growth").from("organization_growth_objectives")
  const nowIso = new Date().toISOString()

  const activeResult = await objectivesTable
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("emergency_stop_active", false)

  if (activeResult.error) {
    return { activeObjectiveCount: null, dueRunningObjectiveCount: null }
  }

  if (!input.schedulerMigrationReady) {
    return {
      activeObjectiveCount: activeResult.count ?? null,
      dueRunningObjectiveCount: null,
    }
  }

  const dueResult = await objectivesTable
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("emergency_stop_active", false)
    .eq("scheduler_runtime_running", true)
    .lte("scheduler_wake_at", nowIso)

  return {
    activeObjectiveCount: activeResult.count ?? null,
    dueRunningObjectiveCount: dueResult.error ? null : dueResult.count ?? null,
  }
}

/** GE-AIOS-LIVE-RUNTIME-CONFIG-PROOF-1A — deployed-runtime configuration health (no secrets). */
export async function buildGrowthAiosRuntimeConfigHealthSnapshot(
  admin: SupabaseClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<GrowthAiosRuntimeConfigHealthSnapshot> {
  const organizationId = getGrowthEngineAiOrgId(env)
  const organizationConfigured = isOrganizationEnvPresent(env)
  const organizationValidUuid = isOrganizationEnvValidUuid(env)

  let organizationMatchesApprovedBusinessProfile = false
  if (organizationId) {
    const approvedProfile = await getActiveApprovedBusinessProfile(admin, organizationId)
    organizationMatchesApprovedBusinessProfile =
      approvedProfile != null && organizationId === DOCUMENTED_EQUIPIFY_AI_OS_PRODUCTION_ORG_ID
  }

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const schedulerMigrationReady = await isSchedulerEligibilityMigrationReady(admin)
  const objectiveCounts = await countSchedulerObjectives(admin, { schedulerMigrationReady })

  const nativeDecisionEngineEnabled = isNativeRevenueDecisionEngineEnabled(env)
  const communicationStrategyEnabled = isCommunicationStrategyEnabled(env)
  const dailyRevenueWorkQueueEnabled = isDailyRevenueWorkQueueEnabled(env)

  const ok =
    organizationConfigured &&
    organizationValidUuid &&
    organizationMatchesApprovedBusinessProfile &&
    nativeDecisionEngineEnabled &&
    dailyRevenueWorkQueueEnabled &&
    communicationStrategyEnabled &&
    !killSwitches.autonomy_outbound_enabled &&
    schedulerMigrationReady

  return {
    ok,
    qaMarker: GROWTH_AIOS_LIVE_RUNTIME_CONFIG_PROOF_1A_QA_MARKER,
    organizationConfigured,
    organizationValidUuid,
    organizationMatchesApprovedBusinessProfile,
    nativeDecisionEngineEnabled,
    dailyRevenueWorkQueueEnabled,
    communicationStrategyEnabled,
    outboundEnabled: killSwitches.autonomy_outbound_enabled,
    schedulerMigrationReady,
    activeObjectiveCount: objectiveCounts.activeObjectiveCount,
    dueRunningObjectiveCount: objectiveCounts.dueRunningObjectiveCount,
  }
}
