import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAiTask } from "@/lib/ai/router"
import type { AiTaskResult } from "@/lib/ai/types"
import { dispatchWorkflowTriggers } from "@/lib/workflows/dispatch"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { ASSISTANT_TASK_MAP, buildOperationalAssistantSystemPrompt } from "./registry"
import { operationalAssistantCardSchema, type OperationalAssistantCard } from "./schema"
import { gatherOperationalAssistantContext } from "./context"
import type { OperationalAssistantId } from "./types"

export type RunOperationalAssistantOptions = {
  /** Skip ai_cache read/write (debug). */
  skipCache?: boolean
  /** When false, do not emit workflow trigger `ai_assistant_digest_ready`. */
  emitWorkflow?: boolean
}

/**
 * Runs one operational assistant via the AI router (structured JSON + usage + optional cache).
 */
export async function runOperationalAssistant(
  supabase: SupabaseClient,
  organizationId: string,
  assistantId: OperationalAssistantId,
  options?: RunOperationalAssistantOptions,
): Promise<AiTaskResult<OperationalAssistantCard>> {
  const task = ASSISTANT_TASK_MAP[assistantId]
  const contextPayload = await gatherOperationalAssistantContext(supabase, organizationId, assistantId)
  const system = buildOperationalAssistantSystemPrompt(assistantId)
  const user = `CONTEXT (JSON):\n${JSON.stringify(contextPayload)}`

  const result = await runAiTask({
    task,
    organizationId,
    input: { system, user },
    schema: operationalAssistantCardSchema,
    taskOverrides: {
      cacheable: true,
      allowResponseCaching: true,
      cacheTtlSeconds: 900,
    },
    cacheKeyExtras: { assistant: assistantId },
    cacheSchemaVersion: "op_card_v1",
    skipCache: options?.skipCache === true,
  })

  if (
    result.ok &&
    options?.emitWorkflow !== false &&
    organizationId.trim()
  ) {
    const admin = createServiceRoleClient()
    if (admin) {
      const summary = result.output.summary?.slice(0, 600) ?? ""
      void dispatchWorkflowTriggers({
        supabase: admin,
        organizationId: organizationId.trim(),
        triggerType: "ai_assistant_digest_ready",
        ctx: {
          organization_id: organizationId.trim(),
          trigger_type: "ai_assistant_digest_ready",
          today: new Date().toISOString().slice(0, 10),
          ai_assistant: {
            assistant_id: assistantId,
            summary,
            alert_count: result.output.alerts.length,
            recommendation_count: result.output.recommendations.length,
          },
        },
        sourceType: "ai_assistant",
        sourceId: assistantId,
      }).catch(() => {})
    }
  }

  return result
}
