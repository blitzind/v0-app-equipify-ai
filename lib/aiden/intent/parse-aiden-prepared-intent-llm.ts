import "server-only"

import { runAiTask } from "@/lib/ai/server"
import { AidenPreparedWorkspaceIntentLlmSchema, normalizeLlmIntentOutput } from "@/lib/aiden/intent/aiden-prepared-intent-llm-schema"
import type { AidenPreparedWorkspaceIntentLlmOutput } from "@/lib/aiden/intent/aiden-prepared-intent-llm-schema"
import { buildAidenPreparedIntentLlmPrompt } from "@/lib/aiden/intent/build-aiden-prepared-intent-llm-prompt"
import type { AidenParsedPreparedIntent, ParseAidenIntentInputOptions } from "@/lib/aiden/intent/intent-types"

/**
 * Calls the LLM to propose a prepared-workspace intent. On any failure, returns null so callers fall back to deterministic parsing only.
 */
export async function tryParsePreparedWorkspaceIntentWithLlm(params: {
  organizationId: string
  userMessage: string
  deterministic: AidenParsedPreparedIntent
  options: ParseAidenIntentInputOptions
}): Promise<AidenPreparedWorkspaceIntentLlmOutput | null> {
  const prompt = buildAidenPreparedIntentLlmPrompt({
    userMessage: params.userMessage,
    deterministicSummary: {
      status: params.deterministic.status,
      actionId: params.deterministic.actionId,
      confidenceScore: params.deterministic.confidenceScore,
      missingFields: params.deterministic.missingFields,
    },
  })

  const result = await runAiTask({
    task: "aiden_prepared_workspace_intent_llm",
    organizationId: params.organizationId,
    input: { system: prompt.system, user: prompt.user },
    schema: AidenPreparedWorkspaceIntentLlmSchema,
  })

  if (!result.ok) return null

  const normalized = normalizeLlmIntentOutput(result.output)
  if (!normalized.ok) return null
  return normalized.value
}
