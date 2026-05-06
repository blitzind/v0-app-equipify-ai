import "server-only"

import { aiDebugLog } from "@/lib/ai/ai-debug"
import { runAiTask } from "@/lib/ai/router"
import { applyUserPromptTemplate, getPromptForTask } from "@/lib/ai/prompts"

/**
 * Normalize noisy OCR text using task `OCR_cleanup` from the AI registry.
 * Prefer this over ad-hoc OpenAI calls for OCR post-processing.
 */
export async function runOcrCleanupPlainText(args: {
  organizationId: string
  rawText: string
}): Promise<{ ok: true; text: string } | { ok: false; error: Error }> {
  const prompt = getPromptForTask("OCR_cleanup")
  const user = applyUserPromptTemplate(prompt.userPromptTemplate, { rawText: args.rawText })

  const result = await runAiTask({
    task: "OCR_cleanup",
    organizationId: args.organizationId,
    input: {
      system: prompt.systemPrompt,
      user,
    },
    taskOverrides: {
      structuredMode: "none",
    },
    cacheSchemaVersion: prompt.schemaVersion,
  })

  if (!result.ok) {
    aiDebugLog("ocr_cleanup_failed", {
      message: result.error.message,
      escalationReasons: result.meta.escalationReasons,
      promptId: prompt.promptId,
      promptVersion: prompt.version,
    })
    return { ok: false, error: result.error }
  }

  return { ok: true, text: result.output }
}
