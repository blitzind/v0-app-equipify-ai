import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_AUTONOMY_CHANNEL_PREPARE_BUDGET_RESOURCE, GROWTH_AUTONOMY_CHANNEL_SEND_BUDGET_RESOURCE } from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import { GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET } from "@/lib/growth/autonomy/growth-autonomy-config"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import type {
  GrowthAutonomyCapability,
  GrowthAutonomyChannelKey,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { GROWTH_AUTONOMY_QA_MARKER } from "@/lib/growth/autonomy/growth-autonomy-types"
import {
  evaluateBudgetAllowance,
  resolveBudgetWindowStart,
  shouldRollBudgetWindow,
} from "@/lib/growth/runtime-guardrails/growth-runtime-budget-window"
import type { GrowthRuntimeResourceType } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function budgetsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("runtime_budgets")
}

export type GrowthAutonomyBudgetSnapshot = {
  resourceType: GrowthRuntimeResourceType
  cap: number
  consumed: number
  remaining: number
  exceeded: boolean
}

export async function getAutonomyBudgetSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    capability: GrowthAutonomyCapability
  },
): Promise<GrowthAutonomyBudgetSnapshot | null> {
  const budgetKey = GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET[input.capability]
  if (!budgetKey) return null

  const settings = await fetchGrowthAutonomySettings(admin, input.organizationId)
  const cap = settings.dailyBudgetLimits[budgetKey] ?? 0
  if (cap <= 0) {
    return {
      resourceType: budgetKey as GrowthRuntimeResourceType,
      cap,
      consumed: 0,
      remaining: 0,
      exceeded: true,
    }
  }

  const windowStart = resolveBudgetWindowStart("daily")
  const { data, error } = await budgetsTable(admin)
    .select("count, window_start")
    .eq("organization_id", input.organizationId)
    .eq("resource_type", budgetKey)
    .eq("window_kind", "daily")
    .eq("window_start", windowStart)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const row = data as { count?: number; window_start?: string } | null
  const consumed =
    row && !shouldRollBudgetWindow("daily", String(row.window_start ?? "")) ? Number(row.count ?? 0) : 0

  return {
    resourceType: budgetKey as GrowthRuntimeResourceType,
    cap,
    consumed,
    remaining: Math.max(0, cap - consumed),
    exceeded: consumed >= cap,
  }
}

export async function consumeAutonomyBudget(
  admin: SupabaseClient,
  input: {
    organizationId: string
    capability: GrowthAutonomyCapability
    volume?: number
  },
): Promise<{ allowed: boolean; reason: string | null; snapshot: GrowthAutonomyBudgetSnapshot | null }> {
  const budgetKey = GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET[input.capability]
  if (!budgetKey) {
    return { allowed: true, reason: null, snapshot: null }
  }

  const settings = await fetchGrowthAutonomySettings(admin, input.organizationId)
  const cap = settings.dailyBudgetLimits[budgetKey] ?? 0
  if (cap <= 0) {
    return {
      allowed: false,
      reason: "Autonomy daily budget disabled for this capability.",
      snapshot: {
        resourceType: budgetKey as GrowthRuntimeResourceType,
        cap,
        consumed: 0,
        remaining: 0,
        exceeded: true,
      },
    }
  }

  const volume = Math.max(1, input.volume ?? 1)
  const windowStart = resolveBudgetWindowStart("daily")
  const { data, error } = await budgetsTable(admin)
    .select("count, window_start")
    .eq("organization_id", input.organizationId)
    .eq("resource_type", budgetKey)
    .eq("window_kind", "daily")
    .eq("window_start", windowStart)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const row = data as { count?: number; window_start?: string } | null
  const currentCount =
    row && !shouldRollBudgetWindow("daily", String(row.window_start ?? "")) ? Number(row.count ?? 0) : 0

  const allowance = evaluateBudgetAllowance({ currentCount, cap, volume })
  const snapshot: GrowthAutonomyBudgetSnapshot = {
    resourceType: budgetKey as GrowthRuntimeResourceType,
    cap,
    consumed: currentCount,
    remaining: allowance.remaining,
    exceeded: !allowance.allowed,
  }

  if (!allowance.allowed) {
    return {
      allowed: false,
      reason: allowance.reason ?? "Autonomy daily budget exceeded.",
      snapshot,
    }
  }

  const nextCount = currentCount + volume
  const { error: upsertError } = await budgetsTable(admin).upsert(
    {
      organization_id: input.organizationId,
      resource_type: budgetKey,
      window_kind: "daily",
      window_start: windowStart,
      count: nextCount,
      qa_marker: GROWTH_AUTONOMY_QA_MARKER,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,resource_type,window_kind,window_start" },
  )

  if (upsertError) throw new Error(upsertError.message)

  return {
    allowed: true,
    reason: null,
    snapshot: {
      ...snapshot,
      consumed: nextCount,
      remaining: Math.max(0, cap - nextCount),
      exceeded: false,
    },
  }
}

export async function getChannelPrepareBudgetSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    channel: GrowthAutonomyChannelKey
    maxPreparedPerDay: number
  },
): Promise<GrowthAutonomyBudgetSnapshot> {
  const resourceType = GROWTH_AUTONOMY_CHANNEL_PREPARE_BUDGET_RESOURCE[input.channel]
  const cap = Math.max(0, Math.floor(input.maxPreparedPerDay))
  if (cap <= 0) {
    return {
      resourceType: resourceType as GrowthRuntimeResourceType,
      cap,
      consumed: 0,
      remaining: 0,
      exceeded: true,
    }
  }

  const windowStart = resolveBudgetWindowStart("daily")
  const { data, error } = await budgetsTable(admin)
    .select("count, window_start")
    .eq("organization_id", input.organizationId)
    .eq("resource_type", resourceType)
    .eq("window_kind", "daily")
    .eq("window_start", windowStart)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const row = data as { count?: number; window_start?: string } | null
  const consumed =
    row && !shouldRollBudgetWindow("daily", String(row.window_start ?? "")) ? Number(row.count ?? 0) : 0

  return {
    resourceType: resourceType as GrowthRuntimeResourceType,
    cap,
    consumed,
    remaining: Math.max(0, cap - consumed),
    exceeded: consumed >= cap,
  }
}

export async function consumeChannelPrepareBudget(
  admin: SupabaseClient,
  input: {
    organizationId: string
    channel: GrowthAutonomyChannelKey
    maxPreparedPerDay: number
    volume?: number
  },
): Promise<{ allowed: boolean; reason: string | null; snapshot: GrowthAutonomyBudgetSnapshot | null }> {
  const snapshot = await getChannelPrepareBudgetSnapshot(admin, input)
  if (snapshot.exceeded) {
    return {
      allowed: false,
      reason: `${input.channel} daily prepare budget exceeded or disabled.`,
      snapshot,
    }
  }

  const volume = Math.max(1, input.volume ?? 1)
  const allowance = evaluateBudgetAllowance({
    currentCount: snapshot.consumed,
    cap: snapshot.cap,
    volume,
  })
  if (!allowance.allowed) {
    return {
      allowed: false,
      reason: allowance.reason ?? `${input.channel} daily prepare budget exceeded.`,
      snapshot,
    }
  }

  const resourceType = GROWTH_AUTONOMY_CHANNEL_PREPARE_BUDGET_RESOURCE[input.channel]
  const windowStart = resolveBudgetWindowStart("daily")
  const nextCount = snapshot.consumed + volume
  const { error: upsertError } = await budgetsTable(admin).upsert(
    {
      organization_id: input.organizationId,
      resource_type: resourceType,
      window_kind: "daily",
      window_start: windowStart,
      count: nextCount,
      qa_marker: GROWTH_AUTONOMY_QA_MARKER,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,resource_type,window_kind,window_start" },
  )

  if (upsertError) throw new Error(upsertError.message)

  return {
    allowed: true,
    reason: null,
    snapshot: {
      ...snapshot,
      consumed: nextCount,
      remaining: Math.max(0, snapshot.cap - nextCount),
      exceeded: false,
    },
  }
}

export async function getChannelSendBudgetSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    channel: GrowthAutonomyChannelKey
    maxSendsPerDay: number
  },
): Promise<GrowthAutonomyBudgetSnapshot> {
  const resourceType = GROWTH_AUTONOMY_CHANNEL_SEND_BUDGET_RESOURCE[input.channel]
  const cap = Math.max(0, Math.floor(input.maxSendsPerDay))
  if (cap <= 0) {
    return {
      resourceType: resourceType as GrowthRuntimeResourceType,
      cap,
      consumed: 0,
      remaining: 0,
      exceeded: true,
    }
  }

  const windowStart = resolveBudgetWindowStart("daily")
  const { data, error } = await budgetsTable(admin)
    .select("count, window_start")
    .eq("organization_id", input.organizationId)
    .eq("resource_type", resourceType)
    .eq("window_kind", "daily")
    .eq("window_start", windowStart)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const row = data as { count?: number; window_start?: string } | null
  const consumed =
    row && !shouldRollBudgetWindow("daily", String(row.window_start ?? "")) ? Number(row.count ?? 0) : 0

  return {
    resourceType: resourceType as GrowthRuntimeResourceType,
    cap,
    consumed,
    remaining: Math.max(0, cap - consumed),
    exceeded: consumed >= cap,
  }
}

export async function consumeChannelSendBudget(
  admin: SupabaseClient,
  input: {
    organizationId: string
    channel: GrowthAutonomyChannelKey
    maxSendsPerDay: number
    volume?: number
  },
): Promise<{ allowed: boolean; reason: string | null; snapshot: GrowthAutonomyBudgetSnapshot | null }> {
  const snapshot = await getChannelSendBudgetSnapshot(admin, input)
  if (snapshot.exceeded) {
    return {
      allowed: false,
      reason: `${input.channel} daily send budget exceeded or disabled.`,
      snapshot,
    }
  }

  const volume = Math.max(1, input.volume ?? 1)
  const allowance = evaluateBudgetAllowance({
    currentCount: snapshot.consumed,
    cap: snapshot.cap,
    volume,
  })
  if (!allowance.allowed) {
    return {
      allowed: false,
      reason: allowance.reason ?? `${input.channel} daily send budget exceeded.`,
      snapshot,
    }
  }

  const resourceType = GROWTH_AUTONOMY_CHANNEL_SEND_BUDGET_RESOURCE[input.channel]
  const windowStart = resolveBudgetWindowStart("daily")
  const nextCount = snapshot.consumed + volume
  const { error: upsertError } = await budgetsTable(admin).upsert(
    {
      organization_id: input.organizationId,
      resource_type: resourceType,
      window_kind: "daily",
      window_start: windowStart,
      count: nextCount,
      qa_marker: GROWTH_AUTONOMY_QA_MARKER,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,resource_type,window_kind,window_start" },
  )

  if (upsertError) throw new Error(upsertError.message)

  return {
    allowed: true,
    reason: null,
    snapshot: {
      ...snapshot,
      consumed: nextCount,
      remaining: Math.max(0, snapshot.cap - nextCount),
      exceeded: false,
    },
  }
}
