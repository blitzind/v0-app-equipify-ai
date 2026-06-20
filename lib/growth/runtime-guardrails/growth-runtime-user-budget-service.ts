import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getUserBudgetCapForResource,
  GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
  type GrowthRuntimeBudgetWindowKind,
  type GrowthRuntimeResourceType,
} from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import {
  evaluateBudgetAllowance,
  resolveBudgetWindowStart,
  shouldRollBudgetWindow,
} from "@/lib/growth/runtime-guardrails/growth-runtime-budget-window"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"
import { recordRuntimeHealthThrottle, recordRuntimeHealthWrite } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

function userBudgetsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("runtime_user_budgets")
}

export type UserBudgetConsumeResult = {
  allowed: boolean
  consumed: number
  remaining: number
  cap: number
  reason: string | null
}

async function fetchUserBudgetRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
    windowStart: string
  },
): Promise<{ count: number; windowStart: string } | null> {
  const { data, error } = await userBudgetsTable(admin)
    .select("count, window_start")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("resource_type", input.resourceType)
    .eq("window_kind", input.windowKind)
    .eq("window_start", input.windowStart)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    count: Number((data as { count: number }).count),
    windowStart: String((data as { window_start: string }).window_start),
  }
}

export async function remainingUserBudget(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
  },
): Promise<number> {
  const cap = getUserBudgetCapForResource(input.resourceType, input.windowKind)
  if (cap <= 0) return Number.MAX_SAFE_INTEGER

  const windowStart = resolveBudgetWindowStart(input.windowKind)
  const row = await fetchUserBudgetRow(admin, { ...input, windowStart })
  return Math.max(0, cap - (row?.count ?? 0))
}

export async function consumeUserBudget(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
    volume?: number
  },
): Promise<UserBudgetConsumeResult> {
  const volume = Math.max(1, input.volume ?? 1)
  const cap = getUserBudgetCapForResource(input.resourceType, input.windowKind)
  if (cap <= 0) {
    return { allowed: true, consumed: 0, remaining: Number.MAX_SAFE_INTEGER, cap: 0, reason: null }
  }

  const windowStart = resolveBudgetWindowStart(input.windowKind)
  const existing = await fetchUserBudgetRow(admin, { ...input, windowStart })
  const currentCount =
    existing && !shouldRollBudgetWindow(input.windowKind, existing.windowStart)
      ? existing.count
      : 0

  const allowance = evaluateBudgetAllowance({ currentCount, cap, volume })
  if (!allowance.allowed) {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: input.organizationId,
      resourceType: `${input.resourceType}:user`,
      severity: "warning",
      message: allowance.reason ?? "User budget exceeded.",
      context: { userId: input.userId, windowKind: input.windowKind, cap, currentCount, volume },
    })
    await recordRuntimeHealthThrottle(admin, 1)
    return {
      allowed: false,
      consumed: currentCount,
      remaining: allowance.remaining,
      cap,
      reason: allowance.reason,
    }
  }

  const nextCount = currentCount + volume
  const { error } = await userBudgetsTable(admin).upsert(
    {
      organization_id: input.organizationId,
      user_id: input.userId,
      resource_type: input.resourceType,
      window_kind: input.windowKind,
      window_start: windowStart,
      count: nextCount,
      qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "organization_id,user_id,resource_type,window_kind,window_start",
    },
  )

  if (error) throw new Error(error.message)
  await recordRuntimeHealthWrite(admin, 1)

  return {
    allowed: true,
    consumed: nextCount,
    remaining: Math.max(0, cap - nextCount),
    cap,
    reason: null,
  }
}

export async function getUserBudgetSnapshot(
  admin: SupabaseClient,
  input: { organizationId: string; userId: string },
): Promise<
  Array<{
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
    count: number
    cap: number
    remaining: number
  }>
> {
  const searchResources: GrowthRuntimeResourceType[] = [
    "searches",
    "estimates",
    "refreshes",
    "hydrations",
  ]
  const windowStart = resolveBudgetWindowStart("hourly")
  const rows: Array<{
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
    count: number
    cap: number
    remaining: number
  }> = []

  for (const resourceType of searchResources) {
    const cap = getUserBudgetCapForResource(resourceType, "hourly")
    if (cap <= 0) continue
    const row = await fetchUserBudgetRow(admin, {
      organizationId: input.organizationId,
      userId: input.userId,
      resourceType,
      windowKind: "hourly",
      windowStart,
    })
    const count = row?.count ?? 0
    rows.push({
      resourceType,
      windowKind: "hourly",
      count,
      cap,
      remaining: Math.max(0, cap - count),
    })
  }

  return rows
}
