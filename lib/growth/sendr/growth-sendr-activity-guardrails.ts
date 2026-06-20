import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { consumeSendrBudget, recordSendrGuardrailFailure } from "@/lib/growth/sendr/growth-sendr-guardrails"
import { resolveBudgetWindowStart } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-window"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export type SendrActivityAccessResult = {
  allowed: boolean
  reason: string | null
  throttled?: boolean
}

export async function assertSendrActivityAccess(
  admin: SupabaseClient,
  organizationId: string,
): Promise<SendrActivityAccessResult> {
  try {
    const enabled = await isRuntimeKillSwitchEnabled(admin, "sendr_activity_enabled")
    if (!enabled) {
      return { allowed: false, reason: "sendr_activity_disabled" }
    }

    const refreshBudget = await consumeSendrBudget(admin, {
      organizationId,
      resourceType: "sendr_activity_refreshes",
    })
    if (!refreshBudget.allowed) {
      await recordSendrGuardrailFailure(admin, refreshBudget.reason ?? "sendr_activity_throttled")
      return {
        allowed: false,
        reason: refreshBudget.reason ?? "sendr_activity_throttled",
        throttled: true,
      }
    }

    const activityBudget = await consumeSendrBudget(admin, {
      organizationId,
      resourceType: "sendr_activity",
    })
    if (!activityBudget.allowed) {
      await recordSendrGuardrailFailure(admin, activityBudget.reason ?? "sendr_activity_throttled")
      return {
        allowed: false,
        reason: activityBudget.reason ?? "sendr_activity_throttled",
        throttled: true,
      }
    }

    return { allowed: true, reason: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : "sendr_activity_failed"
    try {
      await recordSendrGuardrailFailure(admin, message)
    } catch {
      // never throw from observability path
    }
    return { allowed: false, reason: message }
  }
}

async function countBudgetToday(
  admin: SupabaseClient,
  organizationId: string,
  resourceType: string,
): Promise<number> {
  const windowStart = resolveBudgetWindowStart("daily")
  const { data, error } = await admin
    .schema("growth")
    .from("runtime_budgets")
    .select("count")
    .eq("organization_id", organizationId)
    .eq("resource_type", resourceType)
    .eq("window_kind", "daily")
    .eq("window_start", windowStart)
    .maybeSingle()
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return Number((data as { count?: number } | null)?.count ?? 0)
}

export async function countSendrActivityLoadsToday(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  return countBudgetToday(admin, organizationId, "sendr_activity")
}

export async function countSendrFeedRefreshesToday(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  return countBudgetToday(admin, organizationId, "sendr_activity_refreshes")
}
