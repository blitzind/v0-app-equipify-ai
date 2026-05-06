import "server-only"

import { getAiEnvConfig } from "@/lib/ai/config"
import type { AiTaskId } from "@/lib/ai/types"
import { toSafeDebugPayload } from "@/lib/ai/redaction"

/** When `AI_DEBUG=1` or dev, log router / file-extraction diagnostics. */
export function aiDebugLog(event: string, payload: Record<string, unknown> = {}): void {
  if (!getAiEnvConfig().debug) return
  console.info(`[ai-debug] ${event}`, toSafeDebugPayload(payload))
}

export function aiDebugLogExtraction(args: {
  task: AiTaskId
  model: string
  attempt: number
  escalated: boolean
  reason?: string
  promptId?: string
  promptVersion?: number
}): void {
  aiDebugLog("openai_file_extraction", {
    task: args.task,
    provider: "openai",
    model: args.model,
    attempt: args.attempt,
    escalationPath: args.escalated,
    reason: args.reason,
    promptId: args.promptId,
    promptVersion: args.promptVersion,
  })
}
