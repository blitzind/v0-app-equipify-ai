import "server-only"

import { estimateCostUsd } from "@/lib/ai/pricing"
import type { AiProviderId, AiTaskId } from "@/lib/ai/types"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getAiEnvConfig } from "@/lib/ai/config"

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

  const { error } = await supabase.from("ai_usage_logs").insert(row)
  if (error && getAiEnvConfig().debug) {
    console.warn("[ai] usage log insert failed", error.message)
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
