import "server-only"

import { estimateCostUsd } from "@/lib/ai/pricing"
import type { AiProviderId, AiTaskId } from "@/lib/ai/types"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getAiEnvConfig } from "@/lib/ai/config"
import { redactSensitiveText, toSafeAiMetadata } from "@/lib/ai/redaction"
import { createAiAlert } from "@/lib/ai/alerts/create-ai-alert"

const MAX_FAILURE_REASON_LEN = 500

/** Safe short string for DB — never pass raw prompts or customer content. */
export function safeAiFailureReason(message: string | null | undefined): string | null {
  if (!message?.trim()) return null
  const t = redactSensitiveText(message)
  if (t.length <= MAX_FAILURE_REASON_LEN) return t
  return `${t.slice(0, MAX_FAILURE_REASON_LEN)}…`
}

export type AiUsageLogInsert = {
  organization_id: string
  task: AiTaskId
  provider: AiProviderId
  model: string
  prompt_tokens: number
  completion_tokens: number
  estimated_cost: number
  duration_ms: number
  success: boolean
  failure_reason?: string | null
  cache_hit?: boolean
  budget_blocked?: boolean
  /** Operational only — no prompts, PDF text, or customer messages. */
  metadata?: Record<string, unknown> | null
}

function tryServiceRole() {
  try {
    return createServiceRoleSupabaseClient()
  } catch {
    return null
  }
}

export async function recordAiUsageLog(row: AiUsageLogInsert): Promise<void> {
  const supabase = tryServiceRole()
  if (!supabase) {
    if (getAiEnvConfig().debug) {
      console.warn("[ai] usage log skipped (no service role client)", row.task)
    }
    return
  }

  const insertPayload = {
    organization_id: row.organization_id,
    task: row.task,
    provider: row.provider,
    model: row.model,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    estimated_cost: row.estimated_cost,
    duration_ms: row.duration_ms,
    success: row.success,
    failure_reason: row.failure_reason ?? null,
    cache_hit: row.cache_hit ?? false,
    budget_blocked: row.budget_blocked ?? false,
    metadata: toSafeAiMetadata(row.metadata),
  }

  const { data, error } = await supabase.from("ai_usage_logs").insert(insertPayload).select("id").single()
  if (error && getAiEnvConfig().debug) {
    console.warn("[ai] usage log insert failed", error.message)
    return
  }

  const usageLogId = (data as { id?: string } | null)?.id
  const estimatedCost = row.estimated_cost ?? 0
  const metadata = toSafeAiMetadata(row.metadata)

  if (estimatedCost >= 0.25) {
    await createAiAlert({
      organizationId: row.organization_id,
      alertType: "high_cost_single_request",
      severity: estimatedCost >= 1 ? "critical" : "warning",
      title: "High-cost single AI request",
      message: `Task "${row.task}" recorded a single request cost of $${estimatedCost.toFixed(4)}.`,
      metadata: {
        task: row.task,
        provider: row.provider,
        model: row.model,
        estimatedCost,
        usageLogId,
        threshold: 0.25,
      },
      dedupeWindowMinutes: 60,
    })
  }

  if (row.success === false && row.budget_blocked !== true) {
    const sinceIso = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: failRows } = await supabase
      .from("ai_usage_logs")
      .select("id")
      .eq("organization_id", row.organization_id)
      .eq("task", row.task)
      .eq("success", false)
      .gte("created_at", sinceIso)
      .limit(20)
    const failCount = (failRows ?? []).length
    if (failCount >= 5) {
      await createAiAlert({
        organizationId: row.organization_id,
        alertType: "repeated_task_failures",
        severity: "warning",
        title: "Repeated AI task failures",
        message: `Task "${row.task}" has ${failCount} failed requests in the last 30 minutes.`,
        metadata: {
          task: row.task,
          provider: row.provider,
          model: row.model,
          usageLogId,
          count: failCount,
          threshold: 5,
        },
        dedupeWindowMinutes: 30,
      })
    }

    const { data: providerFailRows } = await supabase
      .from("ai_usage_logs")
      .select("id")
      .eq("organization_id", row.organization_id)
      .eq("provider", row.provider)
      .eq("success", false)
      .gte("created_at", sinceIso)
      .limit(40)
    const providerFailCount = (providerFailRows ?? []).length
    if (providerFailCount >= 8) {
      await createAiAlert({
        organizationId: row.organization_id,
        alertType: "provider_failure_spike",
        severity: "critical",
        title: "AI provider failure spike",
        message: `Provider "${row.provider}" has ${providerFailCount} failures in the last 30 minutes.`,
        metadata: {
          provider: row.provider,
          task: row.task,
          model: row.model,
          usageLogId,
          count: providerFailCount,
          threshold: 8,
        },
        dedupeWindowMinutes: 20,
      })
    }
  }
}

export function sumUsage(
  parts: Array<{ promptTokens: number; completionTokens: number; model: string }>,
): { promptTokens: number; completionTokens: number; estimatedCostUsd: number } {
  let promptTokens = 0
  let completionTokens = 0
  let cost = 0
  for (const p of parts) {
    promptTokens += p.promptTokens
    completionTokens += p.completionTokens
    cost += estimateCostUsd(p.model, p.promptTokens, p.completionTokens)
  }
  return { promptTokens, completionTokens, estimatedCostUsd: Math.round(cost * 1_000_000) / 1_000_000 }
}
