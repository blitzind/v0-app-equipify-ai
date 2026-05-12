import "server-only"

import { isAidenPreparedIntentLlmEnabled } from "@/lib/aiden/intent/aiden-prepared-intent-llm-enabled"
import { mergeDeterministicAndLlmPreparedIntent, type PreparedWorkspaceIntentParseResult } from "@/lib/aiden/intent/merge-prepared-intent-llm"
import { parseAidenPreparedWorkspaceIntent } from "@/lib/aiden/intent/parse-aiden-intent"
import type { ParseAidenIntentInputOptions } from "@/lib/aiden/intent/intent-types"
import { tryParsePreparedWorkspaceIntentWithLlm } from "@/lib/aiden/intent/parse-aiden-prepared-intent-llm"

export async function parsePreparedWorkspaceIntentWithOptionalLlm(params: {
  organizationId: string
  userMessage: string
  options?: ParseAidenIntentInputOptions
}): Promise<PreparedWorkspaceIntentParseResult> {
  const options = params.options ?? {}
  const deterministic = parseAidenPreparedWorkspaceIntent(params.userMessage, options)

  if (!isAidenPreparedIntentLlmEnabled()) {
    return mergeDeterministicAndLlmPreparedIntent(deterministic, null, options)
  }

  const llm = await tryParsePreparedWorkspaceIntentWithLlm({
    organizationId: params.organizationId,
    userMessage: params.userMessage,
    deterministic,
    options,
  })

  return mergeDeterministicAndLlmPreparedIntent(deterministic, llm, options, { llmAttempted: true })
}
