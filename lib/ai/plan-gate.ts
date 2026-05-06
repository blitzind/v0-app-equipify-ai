import "server-only"

import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import type { AiModelRef, AiTaskDefinition } from "@/lib/ai/types"
import { isPlanGatingDisabled, planMeetsMinimum, planRank } from "@/lib/ai/plan-ai-config"
import type { PlanId } from "@/lib/plans"
import { recordAiUsageLog } from "@/lib/ai/usage"
import { getPromptForTask, promptMetadataForLog } from "@/lib/ai/prompts"
import { buildAiUsageOperationalMetadata } from "@/lib/ai/redaction"
import { createAiAlert } from "@/lib/ai/alerts/create-ai-alert"

export { PLAN_AI_INCLUDED_MONTHLY_BUDGET_USD } from "@/lib/ai/plan-ai-config"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function monthStartUtcIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

function tryServiceRole() {
  try {
    return createServiceRoleSupabaseClient()
  } catch {
    return null
  }
}

export async function fetchOrganizationPlanId(organizationId: string): Promise<PlanId> {
  if (!UUID_RE.test(organizationId)) return "solo"
  const svc = tryServiceRole()
  if (!svc) return "solo"
  const { data } = await svc
    .from("organization_subscriptions")
    .select("plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()
  return normalizePlanIdForRead((data as { plan_id?: string | null } | null)?.plan_id ?? "solo")
}

async function getTaskMtdCounts(
  organizationId: string,
  task: string,
): Promise<{ requests: number; costUsd: number }> {
  if (!UUID_RE.test(organizationId)) return { requests: 0, costUsd: 0 }
  const svc = tryServiceRole()
  if (!svc) return { requests: 0, costUsd: 0 }

  const since = monthStartUtcIso()
  let requests = 0
  let costUsd = 0
  const pageSize = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await svc
      .from("ai_usage_logs")
      .select("estimated_cost")
      .eq("organization_id", organizationId)
      .eq("task", task)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error || !data?.length) break
    for (const row of data) {
      requests++
      const v = row.estimated_cost
      const n = typeof v === "number" ? v : Number(v)
      costUsd += Number.isFinite(n) ? n : 0
    }
    if (data.length < pageSize) break
    offset += pageSize
    if (offset > 500_000) break
  }
  return { requests, costUsd }
}

export type AiPlanGateFailureCode = "plan_tier" | "plan_request_limit" | "plan_cost_limit"

export type AiPlanGateResult =
  | { ok: true; planId: PlanId }
  | {
      ok: false
      message: string
      code: AiPlanGateFailureCode
      failureReason: string
    }

/**
 * Evaluate subscription tier + per-task limits (does not log — callers may log after deny).
 */
export async function evaluateAiPlanGate(params: {
  organizationId: string
  taskDef: AiTaskDefinition
}): Promise<AiPlanGateResult> {
  const { organizationId, taskDef } = params
  if (!organizationId?.trim()) {
    return { ok: true, planId: "solo" }
  }

  const planId = await fetchOrganizationPlanId(organizationId.trim())

  if (isPlanGatingDisabled()) {
    return { ok: true, planId }
  }

  const enabled = taskDef.enabledPlans
  if (enabled && enabled.length > 0) {
    const allowed = new Set(enabled.map((p) => p))
    if (!allowed.has(planId)) {
      return {
        ok: false,
        code: "plan_tier",
        failureReason: "plan_tier",
        message:
          "This AI capability is not enabled for your current plan. Upgrade under Billing to unlock it.",
      }
    }
  }

  const required = taskDef.requiredPlan ?? "solo"
  if (!planMeetsMinimum(planId, required)) {
    const needLabel =
      required === "growth"
        ? "Growth"
        : required === "scale"
          ? "Scale"
          : required === "core"
            ? "Core"
            : "Solo"
    return {
      ok: false,
      code: "plan_tier",
      failureReason: "plan_tier",
      message: `This AI task requires ${needLabel} plan or higher. Upgrade under Billing to continue.`,
    }
  }

  const reqCap = taskDef.monthlyRequestLimit
  if (reqCap != null && reqCap >= 0) {
    const { requests } = await getTaskMtdCounts(organizationId.trim(), taskDef.id)
    if (requests >= reqCap) {
      return {
        ok: false,
        code: "plan_request_limit",
        failureReason: "plan_request_limit",
        message: `Monthly request limit reached for task "${taskDef.id}" on your plan. Upgrade or wait until next month.`,
      }
    }
  }

  const costCapCents = taskDef.monthlyCostLimitCents
  if (costCapCents != null && costCapCents >= 0) {
    const { costUsd } = await getTaskMtdCounts(organizationId.trim(), taskDef.id)
    const mtdCents = Math.round(costUsd * 100)
    if (mtdCents >= costCapCents) {
      return {
        ok: false,
        code: "plan_cost_limit",
        failureReason: "plan_cost_limit",
        message: `Monthly AI spend limit for "${taskDef.label}" has been reached for your workspace.`,
      }
    }
  }

  return { ok: true, planId }
}

export async function logAiPlanGateDenial(params: {
  organizationId: string
  taskDef: AiTaskDefinition
  primaryRef: AiModelRef
  durationMs: number
  gate: Extract<AiPlanGateResult, { ok: false }>
  skipUsageLog?: boolean
}): Promise<void> {
  if (params.skipUsageLog) return
  const orgPlan = await fetchOrganizationPlanId(params.organizationId)
  let promptMeta: Record<string, string | number> | undefined
  if (params.taskDef.promptId?.trim()) {
    try {
      const pr = getPromptForTask(params.taskDef.id)
      promptMeta = promptMetadataForLog(pr) as Record<string, string | number>
    } catch {
      promptMeta = undefined
    }
  }
  await recordAiUsageLog({
    organization_id: params.organizationId,
    task: params.taskDef.id,
    provider: params.primaryRef.provider,
    model: params.primaryRef.model,
    prompt_tokens: 0,
    completion_tokens: 0,
    estimated_cost: 0,
    duration_ms: params.durationMs,
    success: false,
    failure_reason: params.gate.failureReason,
    cache_hit: false,
    budget_blocked: false,
    metadata: buildAiUsageOperationalMetadata({
      task: params.taskDef.id,
      provider: params.primaryRef.provider,
      model: params.primaryRef.model,
      attemptCount: 0,
      planBlocked: true,
      durationMs: params.durationMs,
      promptMeta,
    }),
  })
  await createAiAlert({
    organizationId: params.organizationId,
    alertType: "plan_limit_blocked",
    severity: "warning",
    title: "AI request blocked by plan limits",
    message: `Task "${params.taskDef.id}" was blocked due to subscription plan limits.`,
    metadata: {
      task: params.taskDef.id,
      provider: params.primaryRef.provider,
      model: params.primaryRef.model,
      count: 1,
      threshold: params.gate.code,
      sourceType: "plan_gate",
      sourceId: orgPlan,
    },
    dedupeWindowMinutes: 60,
  })
}

/** Human-readable minimum plan for UI (matches billing tier names). */
export function requiredPlanLabel(plan: PlanId): string {
  switch (plan) {
    case "scale":
      return "Scale"
    case "growth":
      return "Growth"
    case "core":
      return "Core"
    default:
      return "Solo"
  }
}

/** Display name for the workspace's current subscription tier. */
export function planTierDisplayName(plan: PlanId): string {
  return requiredPlanLabel(plan)
}

/** Whether an org on `planId` may run this task (for UI hints — server always re-validates). */
export function isTaskAllowedOnPlan(taskDef: AiTaskDefinition, planId: PlanId): boolean {
  if (isPlanGatingDisabled()) return true
  if (taskDef.enabledPlans?.length) {
    return taskDef.enabledPlans.includes(planId)
  }
  const req = taskDef.requiredPlan ?? "solo"
  return planRank(planId) >= planRank(req)
}
