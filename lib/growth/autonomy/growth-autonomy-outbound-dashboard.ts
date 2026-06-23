/** GE-AUTO-1E — Outbound autonomy dashboard read model (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUTONOMY_CHANNEL_KEYS,
  GROWTH_AUTONOMY_CHANNEL_SEND_BUDGET_RESOURCE,
} from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import { GROWTH_AUTONOMY_QA_MARKER } from "@/lib/growth/autonomy/growth-autonomy-types"
import {
  evaluateBudgetAllowance,
  resolveBudgetWindowStart,
  shouldRollBudgetWindow,
} from "@/lib/growth/runtime-guardrails/growth-runtime-budget-window"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export type GrowthAutonomyOutboundDashboard = {
  qa_marker: typeof GROWTH_AUTONOMY_QA_MARKER
  emergencyStopActive: boolean
  masterOutboundEnabled: boolean
  shadowModeEnabled: boolean
  autonomousSendsToday: number
  wouldSendToday: number
  wouldQueueToday: number
  confidenceDistribution: Array<{ bucket: string; count: number }>
  topTriggers: Array<{ trigger: string; count: number }>
  channelBudgetUsage: Array<{ channel: string; sentToday: number; cap: number; remaining: number }>
  orgOutboundBudget: { cap: number; consumed: number; remaining: number }
}

async function readBudgetCount(
  admin: SupabaseClient,
  organizationId: string,
  resourceType: string,
): Promise<number> {
  const windowStart = resolveBudgetWindowStart("daily")
  const { data, error } = await admin
    .schema("growth")
    .from("runtime_budgets")
    .select("count, window_start")
    .eq("organization_id", organizationId)
    .eq("resource_type", resourceType)
    .eq("window_kind", "daily")
    .eq("window_start", windowStart)
    .maybeSingle()
  if (error?.message?.includes("does not exist")) return 0
  if (error) throw new Error(error.message)
  const row = data as { count?: number; window_start?: string } | null
  if (!row || shouldRollBudgetWindow("daily", String(row.window_start ?? ""))) return 0
  return Number(row.count ?? 0)
}

export async function loadGrowthAutonomyOutboundDashboard(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthAutonomyOutboundDashboard> {
  const settings = await fetchGrowthAutonomySettings(admin, organizationId)
  const killSwitches = await getRuntimeKillSwitchStates(admin)

  const channelBudgetUsage = []
  for (const channel of GROWTH_AUTONOMY_CHANNEL_KEYS) {
    const cap = settings.channelPermissions[channel]?.max_sends_per_day ?? 0
    const consumed = await readBudgetCount(
      admin,
      organizationId,
      GROWTH_AUTONOMY_CHANNEL_SEND_BUDGET_RESOURCE[channel],
    )
    channelBudgetUsage.push({
      channel,
      sentToday: consumed,
      cap,
      remaining: Math.max(0, cap - consumed),
    })
  }

  const orgCap = settings.dailyBudgetLimits.autonomous_outbound_actions ?? 0
  const orgConsumed = await readBudgetCount(admin, organizationId, "autonomous_outbound_actions")
  const orgAllowance = evaluateBudgetAllowance({
    currentCount: orgConsumed,
    cap: orgCap,
    volume: 0,
  })

  return {
    qa_marker: GROWTH_AUTONOMY_QA_MARKER,
    emergencyStopActive: !killSwitches.autonomy_enabled,
    masterOutboundEnabled: Boolean(killSwitches.autonomy_outbound_enabled),
    shadowModeEnabled: settings.outboundControls.shadowModeEnabled,
    autonomousSendsToday: orgConsumed,
    wouldSendToday: 0,
    wouldQueueToday: 0,
    confidenceDistribution: [],
    topTriggers: [],
    channelBudgetUsage,
    orgOutboundBudget: {
      cap: orgCap,
      consumed: orgConsumed,
      remaining: orgAllowance.remaining,
    },
  }
}
