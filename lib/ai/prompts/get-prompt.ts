import "server-only"

import { getTaskDefinition } from "@/lib/ai/tasks"
import type { AiTaskId } from "@/lib/ai/types"
import { AI_PROMPT_REGISTRY } from "@/lib/ai/prompts/registry"
import type { GetPromptOptions, ResolvedAiPrompt } from "@/lib/ai/prompts/types"

/** Replace `{{key}}` in template. Empty strings are allowed. */
export function applyUserPromptTemplate(template: string, vars: Record<string, string>): string {
  let out = template
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(val ?? "")
  }
  const leftover = out.match(/\{\{([a-zA-Z0-9_]+)\}\}/g)
  if (leftover?.length) {
    throw new Error(`Prompt template has unreplaced placeholders: ${leftover.join(", ")}`)
  }
  return out
}

/** Metadata only — safe for ai_usage_logs (no prompt body). */
export function promptMetadataForLog(p: Pick<ResolvedAiPrompt, "promptId" | "version" | "schemaVersion">): {
  promptId: string
  promptVersion: number
  schemaVersion: string
} {
  return {
    promptId: p.promptId,
    promptVersion: p.version,
    schemaVersion: p.schemaVersion,
  }
}

/**
 * Returns the active prompt for a task (or a pinned version). Throws if the task is not prompt-managed
 * or registry invariants are violated.
 */
export function getPromptForTask(taskId: AiTaskId, options?: GetPromptOptions): ResolvedAiPrompt {
  const def = getTaskDefinition(taskId)
  if (!def.promptId?.trim()) {
    throw new Error(
      `Task "${taskId}" is not prompt-managed. Add promptId to AI_TASK_REGISTRY or use a non-registry code path.`,
    )
  }
  const pid = def.promptId.trim()
  const candidates = AI_PROMPT_REGISTRY.filter((p) => p.promptId === pid)
  if (candidates.length === 0) {
    throw new Error(`No AI prompts registered for promptId "${pid}" (task "${taskId}").`)
  }

  if (options?.version != null) {
    const pinned = candidates.find((p) => p.version === options.version)
    if (!pinned) {
      throw new Error(`No prompt "${pid}" at version ${options.version}.`)
    }
    return pinned
  }

  const active = candidates.filter((p) => p.active)
  if (active.length !== 1) {
    throw new Error(
      `Prompt "${pid}" must have exactly one active version; found ${active.length}. Fix AI_PROMPT_REGISTRY.`,
    )
  }
  return active[0]!
}
