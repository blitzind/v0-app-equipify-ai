import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getBudgetCapForResource,
  GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
  type GrowthRuntimeBudgetWindowKind,
  type GrowthRuntimeResourceType,
} from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import {
  evaluateBudgetAllowance,
  resolveBudgetWindowStart,
  shouldRollBudgetWindow,
} from "@/lib/growth/runtime-guardrails/growth-runtime-budget-window"
import type {
  GrowthOrganizationBudgetSnapshot,
  GrowthRuntimeBudgetConsumeResult,
  GrowthRuntimeBudgetRow,
} from "@/lib/growth/runtime-guardrails/growth-runtime-budget-types"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"
import {
  recordRuntimeHealthThrottle,
  recordRuntimeHealthWrite,
} from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

function budgetsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("runtime_budgets")
}

function mapBudgetRow(row: Record<string, unknown>): GrowthRuntimeBudgetRow {
  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    resourceType: String(row.resource_type ?? "") as GrowthRuntimeResourceType,
    windowKind: String(row.window_kind ?? "") as GrowthRuntimeBudgetWindowKind,
    windowStart: String(row.window_start ?? ""),
    count: Number(row.count ?? 0),
    updatedAt: String(row.updated_at ?? ""),
  }
}

async function fetchBudgetRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
    windowStart: string
  },
): Promise<GrowthRuntimeBudgetRow | null> {
  const { data, error } = await budgetsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("resource_type", input.resourceType)
    .eq("window_kind", input.windowKind)
    .eq("window_start", input.windowStart)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapBudgetRow(data as Record<string, unknown>)
}

export async function getOrganizationBudgets(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthOrganizationBudgetSnapshot> {
  const windowStarts = {
    hourly: resolveBudgetWindowStart("hourly"),
    daily: resolveBudgetWindowStart("daily"),
    monthly: resolveBudgetWindowStart("monthly"),
  }

  const resourceTypes: GrowthRuntimeResourceType[] = [
    "searches",
    "estimates",
    "refreshes",
    "hydrations",
    "enrichments",
    "wake_evaluations",
    "media_events",
    "sequence_enrollments",
    "automation_executions",
    "headless_objectives",
  ]

  const budgets: GrowthOrganizationBudgetSnapshot["budgets"] = []

  for (const resourceType of resourceTypes) {
    for (const windowKind of ["hourly", "daily", "monthly"] as const) {
      const cap = getBudgetCapForResource(resourceType, windowKind)
      if (cap <= 0) continue

      const row = await fetchBudgetRow(admin, {
        organizationId,
        resourceType,
        windowKind,
        windowStart: windowStarts[windowKind],
      })
      const count = row?.count ?? 0
      budgets.push({
        resourceType,
        windowKind,
        count,
        cap,
        remaining: Math.max(0, cap - count),
      })
    }
  }

  return { organizationId, budgets }
}

export async function remainingBudget(
  admin: SupabaseClient,
  input: {
    organizationId: string
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
  },
): Promise<number> {
  const cap = getBudgetCapForResource(input.resourceType, input.windowKind)
  if (cap <= 0) return Number.MAX_SAFE_INTEGER

  const windowStart = resolveBudgetWindowStart(input.windowKind)
  const row = await fetchBudgetRow(admin, { ...input, windowStart })
  return Math.max(0, cap - (row?.count ?? 0))
}

export async function consumeBudget(
  admin: SupabaseClient,
  input: {
    organizationId: string
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
    volume?: number
  },
): Promise<GrowthRuntimeBudgetConsumeResult> {
  const volume = Math.max(1, input.volume ?? 1)
  const cap = getBudgetCapForResource(input.resourceType, input.windowKind)
  const windowStart = resolveBudgetWindowStart(input.windowKind)

  const existing = await fetchBudgetRow(admin, { ...input, windowStart })
  const currentCount =
    existing && !shouldRollBudgetWindow(input.windowKind, existing.windowStart)
      ? existing.count
      : 0

  const allowance = evaluateBudgetAllowance({ currentCount, cap, volume })
  if (!allowance.allowed) {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: input.organizationId,
      resourceType: input.resourceType,
      severity: "warning",
      message: allowance.reason ?? "Budget exceeded.",
      context: { windowKind: input.windowKind, cap, currentCount, volume },
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
  const { error } = await budgetsTable(admin).upsert(
    {
      organization_id: input.organizationId,
      resource_type: input.resourceType,
      window_kind: input.windowKind,
      window_start: windowStart,
      count: nextCount,
      qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,resource_type,window_kind,window_start" },
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

export async function resetBudgetWindow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
  },
): Promise<void> {
  const windowStart = resolveBudgetWindowStart(input.windowKind)
  const { error } = await budgetsTable(admin)
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("resource_type", input.resourceType)
    .eq("window_kind", input.windowKind)
    .eq("window_start", windowStart)

  if (error) throw new Error(error.message)
}
