/**
 * GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Provider budget gate for scheduler sub-ticks (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getBudgetCapForResource,
  type GrowthRuntimeResourceType,
} from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { remainingBudget } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-service"

export async function checkSchedulerProviderBudgetGate(
  admin: SupabaseClient,
  input: {
    organizationId: string
    resourceType: GrowthRuntimeResourceType
    windowKind?: "hourly" | "daily"
    volume?: number
  },
): Promise<{ allowed: boolean; remaining: number; cap: number }> {
  const windowKind = input.windowKind ?? "daily"
  const cap = getBudgetCapForResource(input.resourceType, windowKind)
  if (cap <= 0) {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, cap: 0 }
  }
  const remaining = await remainingBudget(admin, {
    organizationId: input.organizationId,
    resourceType: input.resourceType,
    windowKind,
  })
  const volume = Math.max(1, input.volume ?? 1)
  return {
    allowed: remaining >= volume,
    remaining,
    cap,
  }
}
