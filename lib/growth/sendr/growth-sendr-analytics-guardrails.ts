import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { consumeSendrBudget, recordSendrGuardrailFailure } from "@/lib/growth/sendr/growth-sendr-guardrails"
import { resolveBudgetWindowStart } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-window"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export type SendrAnalyticsAccessResult = {
  allowed: boolean
  reason: string | null
  throttled?: boolean
}

export async function assertSendrAnalyticsAccess(
  admin: SupabaseClient,
  organizationId: string,
): Promise<SendrAnalyticsAccessResult> {
  try {
    const enabled = await isRuntimeKillSwitchEnabled(admin, "sendr_analytics_enabled")
    if (!enabled) {
      return { allowed: false, reason: "sendr_analytics_disabled" }
    }

    const refreshBudget = await consumeSendrBudget(admin, {
      organizationId,
      resourceType: "sendr_dashboard_refreshes",
    })
    if (!refreshBudget.allowed) {
      await recordSendrGuardrailFailure(admin, refreshBudget.reason ?? "sendr_analytics_throttled")
      return {
        allowed: false,
        reason: refreshBudget.reason ?? "sendr_analytics_throttled",
        throttled: true,
      }
    }

    const analyticsBudget = await consumeSendrBudget(admin, {
      organizationId,
      resourceType: "sendr_analytics",
    })
    if (!analyticsBudget.allowed) {
      await recordSendrGuardrailFailure(admin, analyticsBudget.reason ?? "sendr_analytics_throttled")
      return {
        allowed: false,
        reason: analyticsBudget.reason ?? "sendr_analytics_throttled",
        throttled: true,
      }
    }

    return { allowed: true, reason: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : "sendr_analytics_failed"
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

export async function countSendrAnalyticsLoadsToday(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  return countBudgetToday(admin, organizationId, "sendr_analytics")
}

export async function countSendrDashboardRefreshesToday(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  return countBudgetToday(admin, organizationId, "sendr_dashboard_refreshes")
}
