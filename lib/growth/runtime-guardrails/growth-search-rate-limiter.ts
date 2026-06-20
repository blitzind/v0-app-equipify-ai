import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  consumeBudget,
  remainingBudget,
} from "@/lib/growth/runtime-guardrails/growth-runtime-budget-service"
import type { GrowthRuntimeResourceType } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  consumeUserBudget,
  remainingUserBudget,
} from "@/lib/growth/runtime-guardrails/growth-runtime-user-budget-service"
import { probeRuntimeTable } from "@/lib/growth/runtime-guardrails/growth-runtime-schema-probe"

export type ProspectSearchOperation = "search" | "estimate" | "refresh" | "hydration"

const OPERATION_RESOURCE_MAP: Record<ProspectSearchOperation, GrowthRuntimeResourceType> = {
  search: "searches",
  estimate: "estimates",
  refresh: "refreshes",
  hydration: "hydrations",
}

export type SearchRateLimitResult = {
  allowed: boolean
  reason: string | null
  remaining: number
  blockedBy?: "org" | "user" | "kill_switch"
}

export async function checkProspectSearchRateLimit(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId?: string | null
    operation: ProspectSearchOperation
  },
): Promise<SearchRateLimitResult> {
  const searchEnabled = await isRuntimeKillSwitchEnabled(admin, "search_execution_enabled")
  if (!searchEnabled) {
    return {
      allowed: false,
      reason: "Search execution disabled by kill switch.",
      remaining: 0,
      blockedBy: "kill_switch",
    }
  }

  const resourceType = OPERATION_RESOURCE_MAP[input.operation]
  const orgRemaining = await remainingBudget(admin, {
    organizationId: input.organizationId,
    resourceType,
    windowKind: "hourly",
  })

  if (orgRemaining <= 0) {
    return {
      allowed: false,
      reason: "Hourly org search budget exceeded.",
      remaining: 0,
      blockedBy: "org",
    }
  }

  if (input.userId) {
    const userTableProbe = await probeRuntimeTable(admin, "runtime_user_budgets")
    if (!userTableProbe.missing) {
      const userRemaining = await remainingUserBudget(admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        resourceType,
        windowKind: "hourly",
      })
      if (userRemaining <= 0) {
        return {
          allowed: false,
          reason: "Hourly user search budget exceeded.",
          remaining: 0,
          blockedBy: "user",
        }
      }
      return {
        allowed: true,
        reason: null,
        remaining: Math.min(orgRemaining, userRemaining),
      }
    }
  }

  return { allowed: true, reason: null, remaining: orgRemaining }
}

export async function recordProspectSearchAudit(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId?: string | null
    operation: ProspectSearchOperation
    query?: string
    rowsReturned?: number
    rowsHydrated?: number
    durationMs?: number
  },
): Promise<void> {
  const probe = await probeRuntimeTable(admin, "runtime_search_audit_log")
  if (probe.missing) return

  const { error } = await admin.schema("growth").from("runtime_search_audit_log").insert({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    operation: input.operation,
    query: input.query?.slice(0, 500) ?? null,
    rows_returned: input.rowsReturned ?? 0,
    rows_hydrated: input.rowsHydrated ?? 0,
    duration_ms: input.durationMs ?? 0,
    qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
  })
  if (error) throw new Error(error.message)
}

export async function withProspectSearchGuardrails<T>(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId?: string | null
    operation: ProspectSearchOperation
    query?: string
    execute: () => Promise<{ result: T; rowsReturned: number; rowsHydrated?: number }>
  },
): Promise<{ ok: true; result: T } | { ok: false; error: string; status: number }> {
  const started = Date.now()
  const limit = await checkProspectSearchRateLimit(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    operation: input.operation,
  })

  if (!limit.allowed) {
    return { ok: false, error: limit.reason ?? "rate_limited", status: 429 }
  }

  const resourceType = OPERATION_RESOURCE_MAP[input.operation]
  const orgConsumed = await consumeBudget(admin, {
    organizationId: input.organizationId,
    resourceType,
    windowKind: "hourly",
    volume: 1,
  })
  if (!orgConsumed.allowed) {
    return { ok: false, error: orgConsumed.reason ?? "rate_limited", status: 429 }
  }

  if (input.userId) {
    const userTableProbe = await probeRuntimeTable(admin, "runtime_user_budgets")
    if (!userTableProbe.missing) {
      const userConsumed = await consumeUserBudget(admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        resourceType,
        windowKind: "hourly",
        volume: 1,
      })
      if (!userConsumed.allowed) {
        return { ok: false, error: userConsumed.reason ?? "rate_limited", status: 429 }
      }
    }
  }

  const { result, rowsReturned, rowsHydrated } = await input.execute()

  await recordProspectSearchAudit(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    operation: input.operation,
    query: input.query,
    rowsReturned,
    rowsHydrated,
    durationMs: Date.now() - started,
  }).catch(() => undefined)

  return { ok: true, result }
}
